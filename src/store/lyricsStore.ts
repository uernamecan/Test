import { create } from 'zustand'
import { musicApi } from '../services/api'
import type { LyricLine } from '../types/lyrics'

type LyricsState = {
  lyricPath: string | null
  lines: LyricLine[]
  loading: boolean
  error: string | null
  loadLyrics: (lyricPath?: string) => Promise<void>
  clearLyrics: () => void
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lyricPath: null,
  lines: [],
  loading: false,
  error: null,
  loadLyrics: async (lyricPath) => {
    if (!lyricPath) {
      set({
        lyricPath: null,
        lines: [],
        loading: false,
        error: null
      })
      return
    }

    set({ loading: true, error: null, lyricPath })

    try {
      const lines = await musicApi.getLyrics(lyricPath)
      set({ lines, loading: false })
    } catch (error) {
      set({
        lines: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load lyrics.'
      })
    }
  },
  clearLyrics: () => {
    set({
      lyricPath: null,
      lines: [],
      loading: false,
      error: null
    })
  }
}))
