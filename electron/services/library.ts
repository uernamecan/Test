import fs from 'node:fs/promises'
import { getAllTracks, replaceLibraryTracks } from '../db/repositories/tracksRepo'
import { setSetting } from '../db/repositories/settingsRepo'
import { isSupportedAudioFile, scanMusicSources } from './scanner'
import type { Track } from '../../src/types/track'
import { logger } from '../utils/logger'

const MAX_PERSISTED_SCAN_WARNINGS = 100

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

export async function syncLibrary(sourcePaths: string[]) {
  const scanStartedAt = Date.now()
  const persistedPaths: string[] = []
  const scannablePaths: string[] = []
  const unavailableSourcePaths: string[] = []
  const seenPaths = new Set<string>()
  const sourceWarnings: Array<{ path: string; reason: string }> = []

  const rememberPath = (sourcePath: string) => {
    const dedupeKey = sourcePath.toLowerCase()

    if (seenPaths.has(dedupeKey)) {
      return false
    }

    seenPaths.add(dedupeKey)
    persistedPaths.push(sourcePath)
    return true
  }

  for (const sourcePath of sourcePaths.map((item) => item.trim()).filter(Boolean)) {
    try {
      const realPath = await fs.realpath(sourcePath)
      const sourceStats = await fs.stat(realPath)

      if (sourceStats.isDirectory() || (sourceStats.isFile() && isSupportedAudioFile(realPath))) {
        if (rememberPath(realPath)) {
          scannablePaths.push(realPath)
        }
        continue
      }

      sourceWarnings.push({
        path: realPath,
        reason: sourceStats.isFile()
          ? 'Library source was not saved because the file type is not supported.'
          : 'Library source was not saved because the path type is not supported.'
      })
    } catch (error) {
      logger.warn('Skipping unavailable library source:', sourcePath, error)

      if (rememberPath(sourcePath)) {
        unavailableSourcePaths.push(sourcePath)
        sourceWarnings.push({
          path: sourcePath,
          reason: 'Library source is currently unavailable.'
        })
      }
    }
  }

  const previousTracks = getAllTracks()
  const scanResult = scannablePaths.length > 0
    ? await scanMusicSources(scannablePaths)
    : { tracks: [], discoveredFileCount: 0, warnings: [] }
  const warnings = [...sourceWarnings, ...scanResult.warnings]

  replaceLibraryTracks(scanResult.tracks, {
    preserveSourcePaths: unavailableSourcePaths
  })
  setSetting('libraryPaths', persistedPaths)

  const nextTracks = getAllTracks()
  const stats = buildScanStats(previousTracks, nextTracks)
  const persistedWarnings = warnings.slice(0, MAX_PERSISTED_SCAN_WARNINGS)

  return {
    tracks: nextTracks,
    stats: {
      ...stats,
      discoveredFileCount: scanResult.discoveredFileCount,
      warningCount: warnings.length,
      warningDetailLimit: MAX_PERSISTED_SCAN_WARNINGS,
      durationMs: Date.now() - scanStartedAt,
      warnings: persistedWarnings
    }
  }
}
