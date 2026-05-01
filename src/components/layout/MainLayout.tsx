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
import { useLibraryDropImport } from '../../hooks/useLibraryDropImport'
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
  const { draggingLibraryItems } = useLibraryDropImport()

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
            {draggingLibraryItems ? (
              <div className="pointer-events-none absolute inset-4 z-40 grid place-items-center rounded-[32px] border border-dashed border-aurora/70 bg-slate-950/75 p-6 text-center shadow-soft backdrop-blur-xl">
                <div className="max-w-md rounded-[28px] border border-white/10 bg-white/8 px-8 py-7">
                  <div className="text-xs uppercase tracking-[0.24em] text-aurora">Drop To Import</div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    Add music to the local library
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Drop folders or supported audio files here. PulseLocal will merge them with
                    the saved library sources and rescan automatically.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">MP3</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">FLAC</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">WAV</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">M4A</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">OGG</span>
                  </div>
                </div>
              </div>
            ) : null}
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
