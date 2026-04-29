import { create } from 'zustand'
import { musicApi } from '../services/api'
import type { HistoryEntry } from '../types/history'
import type { Track } from '../types/track'

type HistoryState = {
  entries: HistoryEntry[]
  loading: boolean
  loaded: boolean
  error: string | null
  limit: number
  loadRecentHistory: (limit?: number) => Promise<void>
  clearHistory: () => Promise<boolean>
  removeHistoryEntry: (historyId: string) => Promise<boolean>
  prependHistoryEntry: (entry: HistoryEntry) => void
  syncTrackFavorite: (trackId: string, isFavorite: boolean) => void
  syncTracksWithLibrary: (tracks: Track[]) => void
}

function mergeUniqueRecentEntries(entries: HistoryEntry[], limit: number) {
  const uniqueEntries: HistoryEntry[] = []
  const trackIds = new Set<string>()

  for (const entry of entries) {
    if (trackIds.has(entry.trackId)) {
      continue
    }

    trackIds.add(entry.trackId)
    uniqueEntries.push(entry)

    if (uniqueEntries.length >= limit) {
      break
    }
  }

  return uniqueEntries
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  loading: false,
  loaded: false,
  error: null,
  limit: 8,
  loadRecentHistory: async (limit = 8) => {
    set({ loading: true, error: null })

    try {
      const entries = await musicApi.getRecentHistory(limit)
      set({
        entries: mergeUniqueRecentEntries(entries, limit),
        loading: false,
        loaded: true,
        limit
      })
    } catch (error) {
      set({
        loading: false,
        loaded: true,
        limit,
        error: error instanceof Error ? error.message : 'Failed to load recent history.'
      })
    }
  },
  clearHistory: async () => {
    set({ loading: true, error: null })

    try {
      await musicApi.clearHistory()
      set({
        entries: [],
        loading: false,
        loaded: true
      })
      return true
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to clear recent history.'
      })
      return false
    }
  },
  removeHistoryEntry: async (historyId) => {
    set({ error: null })

    try {
      await musicApi.removeHistoryEntry(historyId)
      const limit = get().limit
      const entries = await musicApi.getRecentHistory(limit)
      set({
        entries: mergeUniqueRecentEntries(entries, limit),
        loaded: true
      })
      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove history entry.'
      })
      return false
    }
  },
  prependHistoryEntry: (entry) => {
    set((state) => {
      const mergedEntries = mergeUniqueRecentEntries([entry, ...state.entries], state.limit)

      return {
        entries: mergedEntries,
        loaded: true
      }
    })
  },
  syncTrackFavorite: (trackId, isFavorite) => {
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.trackId === trackId
          ? {
              ...entry,
              track: {
                ...entry.track,
                isFavorite
              }
            }
          : entry
      )
    }))
  },
  syncTracksWithLibrary: (tracks) => {
    set((state) => {
      if (state.entries.length === 0) {
        return state
      }

      const latestTrackMap = new Map(tracks.map((track) => [track.id, track]))
      const nextEntries = state.entries
        .map((entry) => {
          const latestTrack = latestTrackMap.get(entry.trackId)

          return latestTrack
            ? {
                ...entry,
                track: latestTrack
              }
            : null
        })
        .filter((entry): entry is HistoryEntry => Boolean(entry))

      return {
        entries: mergeUniqueRecentEntries(nextEntries, state.limit)
      }
    })
  }
}))
