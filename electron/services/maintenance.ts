import { existsSync, readdirSync, rmdirSync, statSync, unlinkSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { getDatabase } from '../db/client'
import { getPlaylists } from '../db/repositories/playlistsRepo'
import { getAllSettings } from '../db/repositories/settingsRepo'
import { getAllTracks } from '../db/repositories/tracksRepo'
import { buildCsv } from '../utils/csv'
import { getArtworkCacheDir, getDatabasePath, resolveUserDataPath } from '../utils/paths'
import packageJson from '../../package.json'

function getSavedScanWarningSummary(libraryScanState: unknown) {
  if (!libraryScanState || typeof libraryScanState !== 'object') {
    return {
      warningCount: null,
      warningDetailLimit: null,
      savedWarningDetailCount: 0
    }
  }

  const scanState = libraryScanState as {
    warningCount?: unknown
    warningDetailLimit?: unknown
    warnings?: unknown
  }

  return {
    warningCount: typeof scanState.warningCount === 'number' ? scanState.warningCount : null,
    warningDetailLimit:
      typeof scanState.warningDetailLimit === 'number' ? scanState.warningDetailLimit : null,
    savedWarningDetailCount: Array.isArray(scanState.warnings) ? scanState.warnings.length : 0
  }
}

export function buildLibraryCsv() {
  const header = [
    'id',
    'title',
    'artist',
    'album',
    'duration_seconds',
    'format',
    'bitrate',
    'sample_rate',
    'favorite',
    'path',
    'cover_path',
    'lyric_path',
    'created_at',
    'updated_at'
  ]
  const rows = getAllTracks().map((track) => [
    track.id,
    track.title,
    track.artist,
    track.album,
    Math.round(track.duration || 0),
    track.format,
    track.bitrate ?? '',
    track.sampleRate ?? '',
    track.isFavorite ? 'yes' : 'no',
    track.path,
    track.coverPath ?? '',
    track.lyricPath ?? '',
    track.createdAt,
    track.updatedAt
  ])

  return buildCsv([header, ...rows])
}

export function getLibrarySourceInfo(sourcePath: string) {
  const parsedPath = sourcePath.trim()

  if (!parsedPath) {
    return {
      path: parsedPath,
      exists: false,
      type: 'missing' as const
    }
  }

  try {
    if (!existsSync(parsedPath)) {
      return {
        path: parsedPath,
        exists: false,
        type: 'missing' as const
      }
    }

    const sourceStats = statSync(parsedPath)

    return {
      path: parsedPath,
      exists: true,
      type: sourceStats.isDirectory()
        ? 'folder' as const
        : sourceStats.isFile()
          ? 'file' as const
          : 'other' as const
    }
  } catch {
    return {
      path: parsedPath,
      exists: false,
      type: 'missing' as const
    }
  }
}

export function getAppStorageInfo() {
  const userDataPath = resolveUserDataPath()
  const databasePath = getDatabasePath()
  const artworkCacheDir = getArtworkCacheDir()
  const databaseSizeBytes = existsSync(databasePath) ? statSync(databasePath).size : 0
  const artworkCacheUsage = getDirectoryUsage(artworkCacheDir)

  return {
    userDataPath,
    databasePath,
    databaseSizeBytes,
    artworkCacheDir,
    artworkCacheSizeBytes: artworkCacheUsage.sizeBytes,
    artworkCacheFileCount: artworkCacheUsage.fileCount
  }
}

function getDirectoryUsage(directoryPath: string) {
  let sizeBytes = 0
  let fileCount = 0
  const pendingDirectories = [directoryPath]

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()

    if (!currentDirectory) {
      continue
    }

    let entries: Array<Dirent<string>>

    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      try {
        sizeBytes += statSync(entryPath).size
        fileCount += 1
      } catch {
        // Ignore files that disappear while storage info is being calculated.
      }
    }
  }

  return {
    sizeBytes,
    fileCount
  }
}

function getDirectoryFiles(directoryPath: string) {
  const files: string[] = []
  const pendingDirectories = [directoryPath]

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()

    if (!currentDirectory) {
      continue
    }

    let entries: Array<Dirent<string>>

    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath)
        continue
      }

      if (entry.isFile()) {
        files.push(entryPath)
      }
    }
  }

  return files
}

function normalizeFilePath(filePath: string) {
  return path.normalize(filePath).toLowerCase()
}

function removeEmptyDirectories(rootDirectory: string) {
  const directories: string[] = []
  const pendingDirectories = [rootDirectory]

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()

    if (!currentDirectory) {
      continue
    }

    let entries: Array<Dirent<string>>

    try {
      entries = readdirSync(currentDirectory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const directoryPath = path.join(currentDirectory, entry.name)
        directories.push(directoryPath)
        pendingDirectories.push(directoryPath)
      }
    }
  }

  let removedDirectoryCount = 0

  for (const directoryPath of directories.reverse()) {
    try {
      if (readdirSync(directoryPath).length === 0) {
        rmdirSync(directoryPath)
        removedDirectoryCount += 1
      }
    } catch {
      // Empty directory cleanup is best effort.
    }
  }

  return removedDirectoryCount
}

export function cleanupArtworkCache() {
  const artworkCacheDir = getArtworkCacheDir()
  const playlists = getPlaylists()
  const referencedCoverPaths = new Set(
    [
      ...getAllTracks().map((track) => track.coverPath),
      ...playlists.map((playlist) => playlist.coverPath)
    ]
      .filter((coverPath): coverPath is string => Boolean(coverPath))
      .map(normalizeFilePath)
  )
  const cacheFiles = getDirectoryFiles(artworkCacheDir)
  let deletedCount = 0
  let reclaimedBytes = 0

  for (const cacheFile of cacheFiles) {
    if (referencedCoverPaths.has(normalizeFilePath(cacheFile))) {
      continue
    }

    try {
      const sizeBytes = statSync(cacheFile).size
      unlinkSync(cacheFile)
      deletedCount += 1
      reclaimedBytes += sizeBytes
    } catch {
      // Cache cleanup is best effort; files can disappear while scanning.
    }
  }
  const removedDirectoryCount = removeEmptyDirectories(artworkCacheDir)

  return {
    checkedCount: cacheFiles.length,
    deletedCount,
    reclaimedBytes,
    removedDirectoryCount
  }
}

export function checkDatabaseHealth() {
  const database = getDatabase()
  const integrityRows = database.pragma('integrity_check') as Array<{ integrity_check: string }>
  const foreignKeyRows = database.pragma('foreign_key_check') as Array<unknown>
  const pageCountRows = database.pragma('page_count') as Array<{ page_count: number }>
  const freePageCountRows = database.pragma('freelist_count') as Array<{ freelist_count: number }>
  const integrityMessage = integrityRows.map((row) => row.integrity_check).join('; ') || 'unknown'
  const foreignKeyIssueCount = foreignKeyRows.length
  const message =
    foreignKeyIssueCount > 0
      ? `${integrityMessage}; ${foreignKeyIssueCount} foreign key issue${foreignKeyIssueCount === 1 ? '' : 's'}`
      : integrityMessage

  return {
    ok: integrityMessage.toLowerCase() === 'ok' && foreignKeyIssueCount === 0,
    message,
    foreignKeyIssueCount,
    pageCount: pageCountRows[0]?.page_count ?? 0,
    freePageCount: freePageCountRows[0]?.freelist_count ?? 0
  }
}

export function optimizeDatabase() {
  const databasePath = getDatabasePath()
  const beforeSizeBytes = existsSync(databasePath) ? statSync(databasePath).size : 0
  const database = getDatabase()

  database.pragma('optimize')
  database.pragma('wal_checkpoint(TRUNCATE)')
  database.exec('VACUUM')

  const afterSizeBytes = existsSync(databasePath) ? statSync(databasePath).size : 0

  return {
    beforeSizeBytes,
    afterSizeBytes,
    reclaimedBytes: Math.max(0, beforeSizeBytes - afterSizeBytes)
  }
}

export function buildDiagnosticsReport() {
  const settings = getAllSettings()
  const libraryPaths = Array.isArray(settings.libraryPaths) ? settings.libraryPaths : []
  const tracks = getAllTracks()
  const playlists = getPlaylists()
  const storage = getAppStorageInfo()
  const databaseHealth = checkDatabaseHealth()
  const scanWarningSummary = getSavedScanWarningSummary(settings.libraryScanState)

  return {
    generatedAt: new Date().toISOString(),
    app: {
      name: 'PulseLocal',
      version: packageJson.version,
      reportVersion: 1,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron ?? null
    },
    storage,
    databaseHealth,
    library: {
      trackCount: tracks.length,
      favoriteCount: tracks.filter((track) => track.isFavorite).length,
      albumCount: new Set(tracks.map((track) => `${track.artist}::${track.album}`)).size,
      artistTagCount: new Set(tracks.map((track) => track.artist)).size,
      sourceCount: libraryPaths.length,
      sourceInfo: libraryPaths.map(getLibrarySourceInfo),
      lastScanState: settings.libraryScanState ?? null,
      lastScanWarningCount: scanWarningSummary.warningCount,
      lastScanWarningDetailLimit: scanWarningSummary.warningDetailLimit,
      savedScanWarningDetailCount: scanWarningSummary.savedWarningDetailCount
    },
    playlists: {
      count: playlists.length,
      totalPlaylistTracks: playlists.reduce((sum, playlist) => sum + (playlist.trackCount ?? 0), 0)
    },
    settings: {
      theme: settings.theme ?? null,
      trayEnabled: settings.trayEnabled ?? null,
      globalShortcutsEnabled: settings.globalShortcutsEnabled ?? null,
      minimizeToTray: settings.minimizeToTray ?? null,
      hasPlayerState: Boolean(settings.playerState),
      hasShellState: Boolean(settings.shellState),
      hasWindowState: Boolean(settings.windowState),
      hasSearchState: Boolean(settings.searchState),
      hasLibraryViewState: Boolean(settings.libraryViewState),
      hasPlaylistViewState: Boolean(settings.playlistViewState)
    }
  }
}
