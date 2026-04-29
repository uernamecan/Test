import fs from 'node:fs/promises'
import { getAllTracks, replaceLibraryTracks } from '../db/repositories/tracksRepo'
import { setSetting } from '../db/repositories/settingsRepo'
import { scanMusicFolders } from './scanner'
import type { Track } from '../../src/types/track'
import { logger } from '../utils/logger'

function buildScanStats(previousTracks: Track[], nextTracks: Track[]) {
  const previousTrackMap = new Map(previousTracks.map((track) => [track.id, track]))
  const nextTrackMap = new Map(nextTracks.map((track) => [track.id, track]))
  const addedCount = nextTracks.filter((track) => !previousTrackMap.has(track.id)).length
  const removedCount = previousTracks.filter((track) => !nextTrackMap.has(track.id)).length
  const updatedCount = nextTracks.filter((track) => {
    const previousTrack = previousTrackMap.get(track.id)

    return Boolean(previousTrack && previousTrack.updatedAt !== track.updatedAt)
  }).length

  return {
    totalCount: nextTracks.length,
    addedCount,
    removedCount,
    updatedCount
  }
}

export async function syncLibrary(folderPaths: string[]) {
  const uniquePaths: string[] = []

  for (const folderPath of folderPaths.map((item) => item.trim()).filter(Boolean)) {
    try {
      const realPath = await fs.realpath(folderPath)

      if (!uniquePaths.includes(realPath)) {
        uniquePaths.push(realPath)
      }
    } catch (error) {
      logger.warn('Skipping unavailable library folder:', folderPath, error)
    }
  }

  const previousTracks = getAllTracks()
  const tracks = uniquePaths.length > 0 ? await scanMusicFolders(uniquePaths) : []

  replaceLibraryTracks(tracks)
  setSetting('libraryPaths', uniquePaths)

  const nextTracks = getAllTracks()

  return {
    tracks: nextTracks,
    stats: buildScanStats(previousTracks, nextTracks)
  }
}
