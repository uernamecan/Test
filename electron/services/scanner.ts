import fs from 'node:fs/promises'
import path from 'node:path'
import type { Track } from '../../src/types/track'
import { parseTrackMetadata } from './metadata'
import { logger } from '../utils/logger'
import { getArtworkCacheDir } from '../utils/paths'

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg'])
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '$RECYCLE.BIN',
  'System Volume Information'
])

function normalizeDirectoryPath(directoryPath: string) {
  return path.normalize(directoryPath)
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
  artworkCacheDir: string
) {
  const realDirectoryPath = await fs.realpath(directoryPath)

  if (visitedDirectories.has(realDirectoryPath) || shouldSkipDirectory(realDirectoryPath, artworkCacheDir)) {
    return
  }

  visitedDirectories.add(realDirectoryPath)

  const entries = await fs.readdir(directoryPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      await collectAudioFiles(fullPath, result, visitedDirectories, artworkCacheDir)
      continue
    }

    if (SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      result.add(await fs.realpath(fullPath))
    }
  }
}

export async function scanMusicFolders(paths: string[]) {
  const collectedFiles = new Set<string>()
  const visitedDirectories = new Set<string>()
  const artworkCacheDir = normalizeDirectoryPath(await fs.realpath(getArtworkCacheDir()))

  for (const folderPath of paths) {
    try {
      await collectAudioFiles(folderPath, collectedFiles, visitedDirectories, artworkCacheDir)
    } catch (error) {
      logger.warn('Skipping unreadable folder:', folderPath, error)
    }
  }

  const tracks: Track[] = []

  for (const filePath of collectedFiles) {
    tracks.push(await parseTrackMetadata(filePath))
  }

  return tracks
}
