import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../store/settingsStore'
import { useUiStore } from '../store/uiStore'
import { resolvePersistedShellState } from '../types/settings'

const SHELL_STATE_KEY = 'shellState'
const SHELL_STATE_SAVE_DELAY_MS = 180

function buildShellSnapshot(
  lastRoute: string,
  sidebarCollapsed: boolean,
  lyricsPanelWidth: number,
  queueDrawerWidth: number
) {
  return {
    lastRoute,
    sidebarCollapsed,
    lyricsPanelWidth,
    queueDrawerWidth
  }
}

export function usePersistedShellState() {
  const location = useLocation()
  const navigate = useNavigate()
  const settings = useSettingsStore((state) => state.settings)
  const settingsReady = useSettingsStore((state) => state.ready)
  const setSetting = useSettingsStore((state) => state.setSetting)
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed)
  const lyricsPanelWidth = useUiStore((state) => state.lyricsPanelWidth)
  const setLyricsPanelWidth = useUiStore((state) => state.setLyricsPanelWidth)
  const queueDrawerWidth = useUiStore((state) => state.queueDrawerWidth)
  const setQueueDrawerWidth = useUiStore((state) => state.setQueueDrawerWidth)
  const restoredRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!settingsReady || restoredRef.current) {
      return
    }

    const persistedState = resolvePersistedShellState(settings.shellState)

    if (persistedState) {
      setSidebarCollapsed(persistedState.sidebarCollapsed)
      setLyricsPanelWidth(persistedState.lyricsPanelWidth)
      setQueueDrawerWidth(persistedState.queueDrawerWidth)

      if (location.pathname === '/' && persistedState.lastRoute !== '/') {
        navigate(persistedState.lastRoute, { replace: true })
      }
    }

    restoredRef.current = true
  }, [
    location.pathname,
    navigate,
    setLyricsPanelWidth,
    setQueueDrawerWidth,
    setSidebarCollapsed,
    settings.shellState,
    settingsReady
  ])

  useEffect(() => {
    if (!settingsReady || !restoredRef.current) {
      return
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void setSetting(
        SHELL_STATE_KEY,
        buildShellSnapshot(
          location.pathname,
          sidebarCollapsed,
          lyricsPanelWidth,
          queueDrawerWidth
        )
      )
    }, SHELL_STATE_SAVE_DELAY_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [
    location.pathname,
    lyricsPanelWidth,
    queueDrawerWidth,
    setSetting,
    settingsReady,
    sidebarCollapsed
  ])
}
