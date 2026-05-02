import fs from 'node:fs/promises'
import { getAllTracks, replaceLibraryTracks, upsertTracks } from '../db/repositories/tracksRepo'
import { getSetting, setSetting } from '../db/repositories/settingsRepo'
import { isSupportedAudioFile, scanMusicSources } from './scanner'
import { parseTrackMetadata } from './metadata'
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

function mergeLibraryPaths(existingPaths: string[], nextPaths: string[]) {
  const seenPaths = new Set<string>()
  const mergedPaths: string[] = []

  for (const sourcePath of [...existingPaths, ...nextPaths]) {
    const trimmedPath = sourcePath.trim()
    const dedupeKey = trimmedPath.toLowerCase()

    if (!trimmedPath || seenPaths.has(dedupeKey)) {
      continue
    }

    seenPaths.add(dedupeKey)
    mergedPaths.push(trimmedPath)
  }

  return mergedPaths
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function importAudioFiles(filePaths: string[]) {
  const scanStartedAt = Date.now()
  const previousTracks = getAllTracks()
  const importedTracks: Track[] = []
  const importedPaths: string[] = []
  const warnings: Array<{ path: string; reason: string }> = []

  for (const filePath of filePaths.map((item) => item.trim()).filter(Boolean)) {
    try {
      const realPath = await fs.realpath(filePath)
      const stats = await fs.stat(realPath)

      if (!stats.isFile()) {
        warnings.push({
          path: realPath,
          reason: 'Skipped because the selected path is not a file.'
        })
        continue
      }

      if (!isSupportedAudioFile(realPath)) {
        warnings.push({
          path: realPath,
          reason: 'Skipped unsupported audio file type.'
        })
        continue
      }

      importedTracks.push(await parseTrackMetadata(realPath))
      importedPaths.push(realPath)
    } catch (error) {
      logger.warn('Failed to import selected audio file:', filePath, error)
      warnings.push({
        path: filePath,
        reason: `Skipped unreadable audio file: ${getErrorMessage(error)}`
      })
    }
  }

  upsertTracks(importedTracks)

  const existingLibraryPaths = getSetting<string[]>('libraryPaths') ?? []
  setSetting('libraryPaths', mergeLibraryPaths(existingLibraryPaths, importedPaths))

  const nextTracks = getAllTracks()
  const stats = buildScanStats(previousTracks, nextTracks)

  return {
    tracks: nextTracks,
    stats: {
      ...stats,
      discoveredFileCount: importedPaths.length,
      warningCount: warnings.length,
      warningDetailLimit: MAX_PERSISTED_SCAN_WARNINGS,
      durationMs: Date.now() - scanStartedAt,
      warnings: warnings.slice(0, MAX_PERSISTED_SCAN_WARNINGS)
    }
  }
}
