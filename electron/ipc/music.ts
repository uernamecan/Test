import { dialog, ipcMain, shell } from 'electron'
import { existsSync, promises as fsPromises, statSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { setTrackFavorite } from '../db/repositories/favoritesRepo'
import {
  addTrackToPlaylist,
  createPlaylist,
  createPlaylistWithTracks,
  deletePlaylist,
  getPlaylistById,
  getPlaylists,
  getPlaylistTracks,
  moveTrackInPlaylist,
  refreshAllPlaylistCovers,
  renamePlaylist,
  removeTrackFromPlaylist
} from '../db/repositories/playlistsRepo'
import {
  addHistoryEntry,
  clearHistory,
  getRecentHistory,
  removeHistoryEntry,
  removeTrackHistory
} from '../db/repositories/historyRepo'
import { getDatabase } from '../db/client'
import { getAllTracks, searchTracks } from '../db/repositories/tracksRepo'
import { importAudioFiles, syncLibrary } from '../services/library'
import { parseLyricsFile } from '../services/lyrics'
import { readM3uPlaylistPaths, writeM3uPlaylist } from '../services/m3u'
import {
  buildDiagnosticsReport,
  buildLibraryCsv,
  checkDatabaseHealth,
  cleanupArtworkCache,
  getAppStorageInfo,
  getLibrarySourceInfo,
  optimizeDatabase
} from '../services/maintenance'
import { resolveUserDataPath } from '../utils/paths'

const librarySourcePathsSchema = z.array(z.string().min(1)).max(1000)
const playlistNameSchema = z.string().trim().min(1).max(80)
const keywordSchema = z.string().trim()
const filePathSchema = z.string().trim().min(1).max(4096)
const playlistIdSchema = z.string().trim().min(1)
const trackIdSchema = z.string().trim().min(1)
const playlistTrackPayloadSchema = z.object({
  playlistId: z.string().min(1),
  trackId: z.string().min(1)
})
const playlistWithTracksPayloadSchema = z.object({
  name: playlistNameSchema,
  trackIds: z.array(trackIdSchema).max(10000)
})
const playlistTrackMovePayloadSchema = playlistTrackPayloadSchema.extend({
  targetPosition: z.number().int().min(0)
})
const historyIdSchema = z.string().trim().min(1)
const favoritePayloadSchema = z.object({
  trackId: z.string().trim().min(1),
  isFavorite: z.boolean()
})
const lyricPathSchema = filePathSchema.refine(
  (filePath) => path.extname(filePath).toLowerCase() === '.lrc',
  'Lyrics must be loaded from a .lrc file.'
)
const m3uPathSchema = filePathSchema.refine(
  (filePath) => ['.m3u', '.m3u8'].includes(path.extname(filePath).toLowerCase()),
  'Playlist files must use .m3u or .m3u8.'
)
const historyLimitSchema = z.number().int().min(1).max(50)

function sanitizeFileName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'playlist'
}

function ensureM3uExtension(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.m3u' || extension === '.m3u8') {
    return filePath
  }

  return `${filePath}.m3u8`
}

function ensureSqliteBackupExtension(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.db' || extension === '.sqlite' || extension === '.sqlite3') {
    return filePath
  }

  return `${filePath}.db`
}

function getBackupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function ensureJsonExtension(filePath: string) {
  return path.extname(filePath).toLowerCase() === '.json' ? filePath : `${filePath}.json`
}

function ensureCsvExtension(filePath: string) {
  return path.extname(filePath).toLowerCase() === '.csv' ? filePath : `${filePath}.csv`
}

function parseExistingFilePath(filePath: unknown) {
  const parsedPath = filePathSchema.parse(filePath)

  if (!existsSync(parsedPath)) {
    throw new Error('The requested file no longer exists on disk.')
  }

  if (!statSync(parsedPath).isFile()) {
    throw new Error('The requested path is not a file.')
  }

  return parsedPath
}

function parseExistingPath(filePath: unknown) {
  const parsedPath = filePathSchema.parse(filePath)

  if (!existsSync(parsedPath)) {
    throw new Error('The requested path no longer exists on disk.')
  }

  return parsedPath
}

function parseExistingLyricPath(filePath: unknown) {
  return lyricPathSchema.parse(parseExistingFilePath(filePath))
}

function parseExistingM3uPath(filePath: unknown) {
  return m3uPathSchema.parse(parseExistingFilePath(filePath))
}

export function registerMusicIpcHandlers() {
  ipcMain.handle('music:selectFolders', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select music folders'
    })

    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('music:selectAudioFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select audio files',
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg']
        }
      ]
    })

    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('music:scanLibrary', async (_event, paths) => {
    const sourcePaths = librarySourcePathsSchema.parse(paths)
    return syncLibrary(sourcePaths)
  })

  ipcMain.handle('music:importAudioFiles', async (_event, paths) => {
    const audioFilePaths = librarySourcePathsSchema.parse(paths)
    return importAudioFiles(audioFilePaths)
  })

  ipcMain.handle('music:getLibrarySourceInfo', async (_event, paths) => {
    const sourcePaths = librarySourcePathsSchema.parse(paths)
    return sourcePaths.map(getLibrarySourceInfo)
  })

  ipcMain.handle('music:getAllTracks', async () => {
    return getAllTracks()
  })

  ipcMain.handle('music:searchTracks', async (_event, keyword) => {
    return searchTracks(keywordSchema.parse(keyword))
  })

  ipcMain.handle('music:showTrackInFolder', async (_event, trackPath) => {
    shell.showItemInFolder(parseExistingFilePath(trackPath))
    return true
  })

  ipcMain.handle('music:openTrackFile', async (_event, trackPath) => {
    const errorMessage = await shell.openPath(parseExistingFilePath(trackPath))

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    return true
  })

  ipcMain.handle('music:showLibrarySourceInFolder', async (_event, sourcePath) => {
    shell.showItemInFolder(parseExistingPath(sourcePath))
    return true
  })

  ipcMain.handle('music:openLibrarySourcePath', async (_event, sourcePath) => {
    const errorMessage = await shell.openPath(parseExistingPath(sourcePath))

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    return true
  })

  ipcMain.handle('music:getAppStorageInfo', async () => {
    return getAppStorageInfo()
  })

  ipcMain.handle('music:openAppStorageFolder', async () => {
    const errorMessage = await shell.openPath(resolveUserDataPath())

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    return true
  })

  ipcMain.handle('music:backupDatabase', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Back up music database',
      defaultPath: `pulselocal-backup-${getBackupTimestamp()}.db`,
      filters: [
        {
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const filePath = ensureSqliteBackupExtension(result.filePath)

    await getDatabase().backup(filePath)

    return {
      filePath,
      sizeBytes: existsSync(filePath) ? statSync(filePath).size : 0
    }
  })

  ipcMain.handle('music:checkDatabaseHealth', async () => {
    return checkDatabaseHealth()
  })

  ipcMain.handle('music:optimizeDatabase', async () => {
    return optimizeDatabase()
  })

  ipcMain.handle('music:cleanupArtworkCache', async () => {
    return cleanupArtworkCache()
  })

  ipcMain.handle('music:exportDiagnosticsReport', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export diagnostics report',
      defaultPath: `pulselocal-diagnostics-${getBackupTimestamp()}.json`,
      filters: [
        {
          name: 'JSON Report',
          extensions: ['json']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const filePath = ensureJsonExtension(result.filePath)
    const report = buildDiagnosticsReport()

    await fsPromises.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    return {
      filePath,
      sizeBytes: existsSync(filePath) ? statSync(filePath).size : 0
    }
  })

  ipcMain.handle('music:exportLibraryCsv', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export library CSV',
      defaultPath: `pulselocal-library-${getBackupTimestamp()}.csv`,
      filters: [
        {
          name: 'CSV File',
          extensions: ['csv']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const filePath = ensureCsvExtension(result.filePath)
    const csv = buildLibraryCsv()

    await fsPromises.writeFile(filePath, `${csv}\n`, 'utf8')

    return {
      filePath,
      sizeBytes: existsSync(filePath) ? statSync(filePath).size : 0,
      trackCount: getAllTracks().length
    }
  })

  ipcMain.handle('music:setTrackFavorite', async (_event, payload) => {
    const parsedPayload = favoritePayloadSchema.parse(payload)
    return setTrackFavorite(parsedPayload.trackId, parsedPayload.isFavorite)
  })

  ipcMain.handle('music:getLyrics', async (_event, lyricPath) => {
    return parseLyricsFile(parseExistingLyricPath(lyricPath))
  })

  ipcMain.handle('history:getRecent', async (_event, limit) => {
    const parsedLimit = typeof limit === 'number' ? historyLimitSchema.parse(limit) : 10
    return getRecentHistory(parsedLimit)
  })

  ipcMain.handle('history:addEntry', async (_event, trackId) => {
    return addHistoryEntry(trackIdSchema.parse(trackId))
  })

  ipcMain.handle('history:clear', async () => {
    return clearHistory()
  })

  ipcMain.handle('history:removeEntry', async (_event, historyId) => {
    return removeHistoryEntry(historyIdSchema.parse(historyId))
  })

  ipcMain.handle('history:removeTrack', async (_event, trackId) => {
    return removeTrackHistory(trackIdSchema.parse(trackId))
  })

  ipcMain.handle('playlist:create', async (_event, name) => {
    return createPlaylist(playlistNameSchema.parse(name))
  })

  ipcMain.handle('playlist:createWithTracks', async (_event, payload) => {
    const parsedPayload = playlistWithTracksPayloadSchema.parse(payload)
    return createPlaylistWithTracks(parsedPayload.name, parsedPayload.trackIds)
  })

  ipcMain.handle('playlist:getAll', async () => {
    return getPlaylists()
  })

  ipcMain.handle('playlist:getById', async (_event, playlistId) => {
    return getPlaylistById(playlistIdSchema.parse(playlistId))
  })

  ipcMain.handle('playlist:getTracks', async (_event, playlistId) => {
    return getPlaylistTracks(playlistIdSchema.parse(playlistId))
  })

  ipcMain.handle('playlist:addTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackPayloadSchema.parse(payload)
    return addTrackToPlaylist(parsedPayload.playlistId, parsedPayload.trackId)
  })

  ipcMain.handle('playlist:rename', async (_event, payload) => {
    const parsedPayload = z
      .object({
        playlistId: playlistIdSchema,
        name: playlistNameSchema
      })
      .parse(payload)

    return renamePlaylist(parsedPayload.playlistId, parsedPayload.name)
  })

  ipcMain.handle('playlist:removeTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackPayloadSchema.parse(payload)
    return removeTrackFromPlaylist(parsedPayload.playlistId, parsedPayload.trackId)
  })

  ipcMain.handle('playlist:moveTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackMovePayloadSchema.parse(payload)
    return moveTrackInPlaylist(
      parsedPayload.playlistId,
      parsedPayload.trackId,
      parsedPayload.targetPosition
    )
  })

  ipcMain.handle('playlist:refreshCovers', async () => {
    return refreshAllPlaylistCovers()
  })

  ipcMain.handle('playlist:exportM3u', async (_event, playlistId) => {
    const parsedPlaylistId = playlistIdSchema.parse(playlistId)
    const playlist = getPlaylistById(parsedPlaylistId)

    if (!playlist) {
      throw new Error('Playlist not found.')
    }

    const tracks = getPlaylistTracks(parsedPlaylistId)
    const result = await dialog.showSaveDialog({
      title: 'Export playlist',
      defaultPath: `${sanitizeFileName(playlist.name)}.m3u8`,
      filters: [
        {
          name: 'M3U Playlist',
          extensions: ['m3u8', 'm3u']
        }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const filePath = m3uPathSchema.parse(ensureM3uExtension(result.filePath))
    writeM3uPlaylist(filePath, playlist, tracks)

    return {
      filePath,
      trackCount: tracks.length
    }
  })

  ipcMain.handle('playlist:importM3u', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import playlist',
      properties: ['openFile'],
      filters: [
        {
          name: 'M3U Playlist',
          extensions: ['m3u8', 'm3u']
        }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const sourcePath = parseExistingM3uPath(result.filePaths[0])
    const importedPaths = readM3uPlaylistPaths(sourcePath)
    const trackIdByPath = new Map(
      getAllTracks().map((track) => [path.normalize(track.path).toLowerCase(), track.id])
    )
    const trackIds = importedPaths
      .map((trackPath) => trackIdByPath.get(path.normalize(trackPath).toLowerCase()))
      .filter((trackId): trackId is string => Boolean(trackId))

    if (trackIds.length === 0) {
      throw new Error('No imported playlist tracks matched the current library.')
    }

    const playlistName = path.basename(sourcePath, path.extname(sourcePath))
    const importResult = createPlaylistWithTracks(playlistName, trackIds)

    return {
      ...importResult,
      unmatchedCount: importedPaths.length - trackIds.length,
      sourcePath
    }
  })

  ipcMain.handle('playlist:delete', async (_event, playlistId) => {
    return deletePlaylist(playlistIdSchema.parse(playlistId))
  })
}
