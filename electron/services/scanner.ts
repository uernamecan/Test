import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import type { Track } from '../../src/types/track'
import { parseTrackMetadata } from './metadata'
import { logger } from '../utils/logger'
import { getArtworkCacheDir } from '../utils/paths'

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg'])
const METADATA_PARSE_CONCURRENCY = 6
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '$RECYCLE.BIN',
  'System Volume Information'
])

export type ScanWarning = {
  path: string
  reason: string
}

export type MusicScanResult = {
  tracks: Track[]
  discoveredFileCount: number
  warnings: ScanWarning[]
}

function normalizeDirectoryPath(directoryPath: string) {
  return path.normalize(directoryPath)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function addScanWarning(warnings: ScanWarning[], warning: ScanWarning) {
  warnings.push(warning)
  logger.warn(warning.reason, warning.path)
}

function isSystemSidecarFile(filePath: string) {
  const fileName = path.basename(filePath)

  return fileName.startsWith('._') || fileName === '.DS_Store' || fileName === 'Thumbs.db'
}

export function isSupportedAudioFile(filePath: string) {
  return !isSystemSidecarFile(filePath) && SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function shouldSkipDirectory(directoryPath: string, artworkCacheDir: string) {
  const directoryName = path.basename(directoryPath)
  const normalizedDirectoryPath = normalizeDirectoryPath(directoryPath)

  return (
    SKIPPED_DIRECTORY_NAMES.has(directoryName) ||
    normalizedDirectoryPath === artworkCacheDir ||
    normalizedDirectoryPath.startsWith(`${artworkCacheDir}${path.sep}`)
  )
}

async function collectAudioFiles(
  directoryPath: string,
  result: Set<string>,
  visitedDirectories: Set<string>,
  artworkCacheDir: string,
  warnings: ScanWarning[]
) {
  let realDirectoryPath: string

  try {
    realDirectoryPath = await fs.realpath(directoryPath)
  } catch (error) {
    addScanWarning(warnings, {
      path: directoryPath,
      reason: `Skipping unreadable folder: ${getErrorMessage(error)}`
    })
    return
  }

  if (visitedDirectories.has(realDirectoryPath) || shouldSkipDirectory(realDirectoryPath, artworkCacheDir)) {
    return
  }

  visitedDirectories.add(realDirectoryPath)

  let entries: Dirent[]

  try {
    entries = await fs.readdir(realDirectoryPath, { withFileTypes: true })
  } catch (error) {
    addScanWarning(warnings, {
      path: realDirectoryPath,
      reason: `Skipping folder that could not be listed: ${getErrorMessage(error)}`
    })
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(realDirectoryPath, entry.name)

    if (entry.isDirectory()) {
      await collectAudioFiles(fullPath, result, visitedDirectories, artworkCacheDir, warnings)
      continue
    }

    if (isSupportedAudioFile(entry.name)) {
      try {
        result.add(await fs.realpath(fullPath))
      } catch (error) {
        addScanWarning(warnings, {
          path: fullPath,
          reason: `Skipping unreadable audio file: ${getErrorMessage(error)}`
        })
      }
    }
  }
}

async function parseCollectedFiles(filePaths: string[], warnings: ScanWarning[]) {
  const tracks: Track[] = []
  let nextIndex = 0

  const workers = Array.from(
    { length: Math.min(METADATA_PARSE_CONCURRENCY, filePaths.length) },
    async () => {
      while (nextIndex < filePaths.length) {
        const fileIndex = nextIndex
        nextIndex += 1
        const filePath = filePaths[fileIndex]

        try {
          tracks[fileIndex] = await parseTrackMetadata(filePath)
        } catch (error) {
          addScanWarning(warnings, {
            path: filePath,
            reason: `Skipping audio file after metadata fallback failed: ${getErrorMessage(error)}`
          })
        }
      }
    }
  )

  await Promise.all(workers)

  return tracks.filter((track): track is Track => Boolean(track))
}

export async function scanMusicSources(paths: string[]): Promise<MusicScanResult> {
  const collectedFiles = new Set<string>()
  const visitedDirectories = new Set<string>()
  const warnings: ScanWarning[] = []
  const artworkCacheDir = normalizeDirectoryPath(await fs.realpath(getArtworkCacheDir()))

  for (const sourcePath of paths) {
    try {
      const realSourcePath = await fs.realpath(sourcePath)
      const sourceStats = await fs.stat(realSourcePath)

      if (sourceStats.isDirectory()) {
        await collectAudioFiles(realSourcePath, collectedFiles, visitedDirectories, artworkCacheDir, warnings)
        continue
      }

      if (sourceStats.isFile() && isSupportedAudioFile(realSourcePath)) {
        collectedFiles.add(realSourcePath)
        continue
      }

      addScanWarning(warnings, {
        path: realSourcePath,
        reason: sourceStats.isFile()
          ? 'Skipping unsupported file type.'
          : 'Skipping unsupported library source type.'
      })
    } catch (error) {
      addScanWarning(warnings, {
        path: sourcePath,
        reason: `Skipping unreadable library source: ${getErrorMessage(error)}`
      })
    }
  }

  return {
    tracks: await parseCollectedFiles(
      Array.from(collectedFiles).sort((left, right) => left.localeCompare(right)),
      warnings
    ),
    discoveredFileCount: collectedFiles.size,
    warnings
  }
}
