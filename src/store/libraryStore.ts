import { create } from 'zustand'
import type { Track } from '../types/track'
import { musicApi } from '../services/api'
import { playerService } from '../services/player'
import { useSettingsStore } from './settingsStore'
import { usePlayerStore } from './playerStore'
import { usePlaylistStore } from './playlistStore'
import { useHistoryStore } from './historyStore'
import { resolveAppSettings } from '../types/settings'
import { mergeLibrarySources } from '../lib/librarySources'

type LibraryScanStats = {
  totalCount: number
  addedCount: number
  removedCount: number
  updatedCount: number
  discoveredFileCount?: number
  warningCount?: number
  warningDetailLimit?: number
  durationMs?: number
  warnings?: Array<{
    path: string
    reason: string
  }>
  scannedAt?: string
}

type ImportFoldersResult =
  | {
      status: 'cancelled'
    }
  | {
      status: 'completed'
      selectedCount: number
      stats: LibraryScanStats
    }
  | {
      status: 'failed'
      error: string
    }

type ImportAudioFilesResult =
  | {
      status: 'cancelled'
    }
  | {
      status: 'completed'
      selectedCount: number
      stats: LibraryScanStats
    }
  | {
      status: 'failed'
      error: string
    }

type LibraryState = {
  tracks: Track[]
  loading: boolean
  ready: boolean
  error: string | null
  lastScanStats: LibraryScanStats | null
  searchKeyword: string
  loadTracks: () => Promise<void>
  scanFolders: (paths: string[]) => Promise<void>
  importFolders: () => Promise<ImportFoldersResult>
  importAudioFiles: () => Promise<ImportAudioFilesResult>
  setSearchKeyword: (keyword: string) => void
  syncTrackFavorite: (trackId: string, isFavorite: boolean) => void
}

function syncPlayerQueueWithLibrary(tracks: Track[]) {
  const previousPlayerState = usePlayerStore.getState()
  const previousTrackId = previousPlayerState.currentTrack?.id ?? null

  previousPlayerState.syncQueueWithLibrary(tracks)

  const nextPlayerState = usePlayerStore.getState()
  const currentTrackWasRemoved =
    Boolean(previousTrackId) && nextPlayerState.currentTrack?.id !== previousTrackId

  if (currentTrackWasRemoved) {
    playerService.resetPlayback()
  }
}

function syncDependentStoresWithLibrary(tracks: Track[]) {
  syncPlayerQueueWithLibrary(tracks)
  usePlaylistStore.getState().syncTracksWithLibrary(tracks)
  useHistoryStore.getState().syncTracksWithLibrary(tracks)
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  loading: false,
  ready: false,
  error: null,
  lastScanStats: null,
  searchKeyword: '',
  loadTracks: async () => {
    set({ loading: true, error: null })

    try {
      const tracks = await musicApi.getAllTracks()
      syncDependentStoresWithLibrary(tracks)
      set({ tracks, loading: false, ready: true })
    } catch (error) {
      set({
        loading: false,
        ready: true,
        error: error instanceof Error ? error.message : 'Failed to load tracks.'
      })
    }
  },
  scanFolders: async (paths) => {
    set({ loading: true, error: null })

    try {
      const result = await musicApi.scanLibrary(paths)
      const scanStats = {
        ...result.stats,
        scannedAt: new Date().toISOString()
      }
      syncDependentStoresWithLibrary(result.tracks)
      set({
        tracks: result.tracks,
        lastScanStats: scanStats,
        loading: false,
        ready: true
      })
      await useSettingsStore.getState().setSetting('libraryScanState', scanStats)
      await useSettingsStore.getState().loadSettings()
    } catch (error) {
      set({
        loading: false,
        ready: true,
        lastScanStats: null,
        error: error instanceof Error ? error.message : 'Failed to scan library.'
      })
    }
  },
  importFolders: async () => {
    const selectedPaths = await musicApi.selectFolders()

    if (selectedPaths.length === 0) {
      return {
        status: 'cancelled'
      }
    }

    const existingPaths = resolveAppSettings(useSettingsStore.getState().settings).libraryPaths
    const nextPaths = mergeLibrarySources(existingPaths, selectedPaths)

    await get().scanFolders(nextPaths)

    const error = get().error

    if (error) {
      return {
        status: 'failed',
        error
      }
    }

    return {
      status: 'completed',
      selectedCount: selectedPaths.length,
      stats: get().lastScanStats ?? {
        totalCount: get().tracks.length,
        addedCount: 0,
        removedCount: 0,
        updatedCount: 0,
        scannedAt: new Date().toISOString()
      }
    }
  },
  importAudioFiles: async () => {
    const selectedPaths = await musicApi.selectAudioFiles()

    if (selectedPaths.length === 0) {
      return {
        status: 'cancelled'
      }
    }

    set({ loading: true, error: null })

    try {
      const result = await musicApi.importAudioFiles(selectedPaths)
      const scanStats = {
        ...result.stats,
        scannedAt: new Date().toISOString()
      }
      syncDependentStoresWithLibrary(result.tracks)
      set({
        tracks: result.tracks,
        lastScanStats: scanStats,
        loading: false,
        ready: true
      })
      await useSettingsStore.getState().loadSettings()

      return {
        status: 'completed',
        selectedCount: selectedPaths.length,
        stats: scanStats
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import audio files.'
      set({
        loading: false,
        ready: true,
        error: errorMessage
      })

      return {
        status: 'failed',
        error: errorMessage
      }
    }
  },
  setSearchKeyword: (searchKeyword) => {
    set({ searchKeyword })
  },
  syncTrackFavorite: (trackId, isFavorite) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, isFavorite } : track
      )
    }))
  }
}))
