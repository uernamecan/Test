import { create } from 'zustand'
import { musicApi } from '../services/api'
import type { AppSettings } from '../types/settings'

type ThemeMode = 'light' | 'dark'

type SettingsState = {
  settings: AppSettings
  loading: boolean
  ready: boolean
  loadSettings: () => Promise<AppSettings>
  setSetting: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>
  setThemeSetting: (theme: ThemeMode) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loading: false,
  ready: false,
  loadSettings: async () => {
    set({ loading: true })

    try {
      const payload = (await musicApi.getSettings()) as AppSettings
      set({ settings: payload, loading: false, ready: true })
      return payload
    } catch {
      set({ loading: false, ready: true })
      return get().settings
    }
  },
  setSetting: async (key, value) => {
    await musicApi.setSetting(key, value)
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value
      }
    }))
  },
  setThemeSetting: async (theme) => {
    await get().setSetting('theme', theme)
  }
}))
