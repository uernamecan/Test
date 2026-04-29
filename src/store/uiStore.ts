import { create } from 'zustand'
import {
  clampLyricsPanelWidth,
  clampQueueDrawerWidth,
  DEFAULT_LYRICS_PANEL_WIDTH,
  DEFAULT_QUEUE_DRAWER_WIDTH
} from '../lib/shell'

type ThemeMode = 'light' | 'dark'

type UiState = {
  theme: ThemeMode
  sidebarCollapsed: boolean
  lyricsVisible: boolean
  lyricsPanelWidth: number
  queueVisible: boolean
  queueDrawerWidth: number
  setTheme: (theme: ThemeMode) => void
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void
  setLyricsPanelWidth: (lyricsPanelWidth: number) => void
  setQueueVisible: (queueVisible: boolean) => void
  setQueueDrawerWidth: (queueDrawerWidth: number) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleLyrics: () => void
  toggleQueue: () => void
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'dark',
  sidebarCollapsed: false,
  lyricsVisible: false,
  lyricsPanelWidth: DEFAULT_LYRICS_PANEL_WIDTH,
  queueVisible: false,
  queueDrawerWidth: DEFAULT_QUEUE_DRAWER_WIDTH,
  setTheme: (theme) => {
    set({ theme })
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed })
  },
  setLyricsPanelWidth: (lyricsPanelWidth) => {
    set({ lyricsPanelWidth: clampLyricsPanelWidth(lyricsPanelWidth) })
  },
  setQueueVisible: (queueVisible) => {
    set({ queueVisible })
  },
  setQueueDrawerWidth: (queueDrawerWidth) => {
    set({ queueDrawerWidth: clampQueueDrawerWidth(queueDrawerWidth) })
  },
  toggleTheme: () => {
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark'
    }))
  },
  toggleSidebar: () => {
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed
    }))
  },
  toggleLyrics: () => {
    set((state) => ({
      lyricsVisible: !state.lyricsVisible
    }))
  },
  toggleQueue: () => {
    set((state) => ({
      queueVisible: !state.queueVisible
    }))
  }
}))
