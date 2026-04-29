import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import AppToast from '../common/AppToast'
import Header from './Header'
import Sidebar from './Sidebar'
import QueueDrawer from '../player/QueueDrawer'
import PlayerBar from '../player/PlayerBar'
import LyricsPanel from '../lyrics/LyricsPanel'
import { useAudio } from '../../hooks/useAudio'
import { useDesktopCommands } from '../../hooks/useDesktopCommands'
import { useDesktopPlaybackState } from '../../hooks/useDesktopPlaybackState'
import { useLibrarySync } from '../../hooks/useLibrarySync'
import { useMediaSession } from '../../hooks/useMediaSession'
import { usePersistedPlayerState } from '../../hooks/usePersistedPlayerState'
import { usePersistedShellState } from '../../hooks/usePersistedShellState'
import { usePlayerShortcuts } from '../../hooks/usePlayerShortcuts'
import { useSleepTimer } from '../../hooks/useSleepTimer'
import { usePlaylistStore } from '../../store/playlistStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

export default function MainLayout() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const loadPlaylists = usePlaylistStore((state) => state.loadPlaylists)
  const loadSettings = useSettingsStore((state) => state.loadSettings)

  useAudio()
  useDesktopCommands()
  useDesktopPlaybackState()
  useLibrarySync()
  useMediaSession()
  usePersistedPlayerState()
  usePersistedShellState()
  usePlayerShortcuts()
  useSleepTimer()

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const settings = await loadSettings()

      if (!cancelled && (settings.theme === 'light' || settings.theme === 'dark')) {
        setTheme(settings.theme)
      }

      if (!cancelled) {
        await loadPlaylists()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [loadPlaylists, loadSettings, setTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="h-screen overflow-hidden bg-mesh-glow text-slate-100">
      <div className="grid h-full grid-rows-[1fr_auto]">
        <div className="grid min-h-0 grid-cols-[auto_1fr]">
          <Sidebar />
          <div className="relative flex min-h-0 flex-col">
            <Header />
            <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <Outlet />
            </main>
            <AppToast />
            <QueueDrawer />
            <LyricsPanel />
          </div>
        </div>
        <PlayerBar />
      </div>
    </div>
  )
}
