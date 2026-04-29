import { useEffect, useState } from 'react'
import FolderImportButton from '../../components/library/FolderImportButton'
import { useMinuteTicker } from '../../hooks/useMinuteTicker'
import { formatRelativeTime } from '../../lib/format'
import {
  resolveAppSettings,
  resolvePersistedLibraryViewState,
  resolvePersistedLibraryScanState,
  resolvePersistedPlaylistViewState
} from '../../types/settings'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

type SettingToggleCardProps = {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}

function SettingToggleCard({ title, description, enabled, onToggle }: SettingToggleCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
            enabled
              ? 'bg-aurora text-slate-950 hover:brightness-110'
              : 'border border-white/10 bg-slate-950/45 text-slate-200 hover:bg-white/10'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>
    </article>
  )
}

export default function SettingsPage() {
  useMinuteTicker()

  const settings = useSettingsStore((state) => state.settings)
  const ready = useSettingsStore((state) => state.ready)
  const loading = useSettingsStore((state) => state.loading)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const setSetting = useSettingsStore((state) => state.setSetting)
  const setThemeSetting = useSettingsStore((state) => state.setThemeSetting)
  const scanFolders = useLibraryStore((state) => state.scanFolders)
  const libraryLoading = useLibraryStore((state) => state.loading)
  const lastScanStats = useLibraryStore((state) => state.lastScanStats)
  const refreshPlaylistCovers = usePlaylistStore((state) => state.refreshPlaylistCovers)
  const playlists = usePlaylistStore((state) => state.playlists)
  const loadPlaylists = usePlaylistStore((state) => state.loadPlaylists)
  const playlistLoading = usePlaylistStore((state) => state.loading)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const [pathActionTarget, setPathActionTarget] = useState<string | null>(null)
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) {
      void loadSettings()
    }
  }, [loadSettings, ready])

  useEffect(() => {
    if (playlists.length === 0 && !playlistLoading) {
      void loadPlaylists()
    }
  }, [loadPlaylists, playlistLoading, playlists.length])

  const resolvedSettings = resolveAppSettings(settings)
  const libraryViewState = resolvePersistedLibraryViewState(settings.libraryViewState)
  const persistedLibraryScanState = resolvePersistedLibraryScanState(settings.libraryScanState)
  const visibleScanStats = lastScanStats ?? persistedLibraryScanState
  const visibleScanTimeLabel = visibleScanStats?.scannedAt
    ? formatRelativeTime(visibleScanStats.scannedAt)
    : null
  const visibleScanExactTimeLabel = visibleScanStats?.scannedAt
    ? new Date(visibleScanStats.scannedAt).toLocaleString()
    : null
  const playlistViewState = resolvePersistedPlaylistViewState(settings.playlistViewState)
  const savedLibrarySortModes = libraryViewState ? Object.keys(libraryViewState.sortByMode).length : 0
  const savedLibraryDensityModes = libraryViewState ? Object.keys(libraryViewState.densityByMode).length : 0
  const hasPlaylistViewPreferences =
    Boolean(settings.playlistViewState) &&
    (playlistViewState?.sortBy !== 'playlist-order' || playlistViewState.density !== 'comfortable')
  const hasViewPreferences =
    savedLibrarySortModes > 0 || savedLibraryDensityModes > 0 || hasPlaylistViewPreferences
  const refreshingPlaylistCovers = maintenanceAction === 'playlist-covers'
  const loadingPlaylistIndex = playlistLoading && !refreshingPlaylistCovers
  const isPathActionBusy = (libraryPath: string) =>
    libraryLoading && pathActionTarget === libraryPath
  const readLibraryActionSucceeded = () => !useLibraryStore.getState().error
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const getTrackCountLabel = (count: number) => `${count} track${count === 1 ? '' : 's'}`

  const handleRescanLibrary = async () => {
    if (libraryLoading) {
      return
    }

    if (resolvedSettings.libraryPaths.length === 0) {
      showFeedback('Add a music folder before rescanning.', 'error')
      return
    }

    setPathActionTarget('__all__')

    try {
      await scanFolders(resolvedSettings.libraryPaths)
      if (readLibraryActionSucceeded()) {
        const stats = useLibraryStore.getState().lastScanStats
        const nextTrackCount = stats?.totalCount ?? useLibraryStore.getState().tracks.length
        showFeedback('Library rescan finished.', 'success', null, {
          detail: stats
            ? `${stats.addedCount} added, ${stats.removedCount} removed, ${stats.updatedCount} updated. ${getTrackCountLabel(nextTrackCount)} available.`
            : `${getTrackCountLabel(nextTrackCount)} available.`
        })
      } else {
        showFeedback('Could not rescan the library right now.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleRemoveLibraryPath = async (libraryPath: string) => {
    if (libraryLoading) {
      return
    }

    const nextPaths = resolvedSettings.libraryPaths.filter((path) => path !== libraryPath)
    const shouldRemove = window.confirm(`Remove this library folder?\n\n${libraryPath}`)

    if (!shouldRemove) {
      return
    }

    setPathActionTarget(libraryPath)

    try {
      await scanFolders(nextPaths)
      if (readLibraryActionSucceeded()) {
        const stats = useLibraryStore.getState().lastScanStats
        const nextTrackCount = stats?.totalCount ?? useLibraryStore.getState().tracks.length
        showFeedback(nextPaths.length > 0 ? 'Library folder removed.' : 'Library cleared.', 'success', null, {
          detail: stats
            ? `${stats.removedCount} removed, ${stats.addedCount} added, ${stats.updatedCount} updated. ${getTrackCountLabel(nextTrackCount)} still available.`
            : `${getTrackCountLabel(nextTrackCount)} still available.`
        })
      } else {
        showFeedback('Could not remove that library folder.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleResetViewPreferences = async () => {
    await setSetting('libraryViewState', {
      sortByMode: {},
      densityByMode: {}
    })
    await setSetting('playlistViewState', {
      sortBy: 'playlist-order',
      density: 'comfortable'
    })
    showFeedback('View preferences reset.', 'success', null, {
      detail: 'Library and playlist pages will use their default sorting and density again.'
    })
  }

  const handleRefreshPlaylistCovers = async () => {
    if (playlistLoading) {
      return
    }

    setMaintenanceAction('playlist-covers')

    try {
      const result = await refreshPlaylistCovers()

      if (!result) {
        showFeedback('Could not refresh playlist covers right now.', 'error')
        return
      }

      showFeedback('Playlist covers refreshed.', 'success', null, {
        detail: `${result.checkedCount} playlist${result.checkedCount === 1 ? '' : 's'} checked, ${result.changedCount} cover${result.changedCount === 1 ? '' : 's'} updated.`
      })
    } finally {
      setMaintenanceAction(null)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft">
        <div className="text-xs uppercase tracking-[0.22em] text-aurora">Settings</div>
        <h2 className="mt-3 text-2xl font-semibold text-white">Application Settings</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Theme, tray behavior, global media shortcuts, and imported folders are all routed through
          the same local settings pipeline.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Theme</h3>
            <p className="mt-2 text-sm text-slate-300">
              The current theme is persisted through the settings bridge.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTheme(nextTheme)
              void setThemeSetting(nextTheme)
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
          >
            Current theme: {theme}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingToggleCard
          title="System Tray"
          description="Keeps PulseLocal available from the desktop tray with quick controls and a restore action."
          enabled={resolvedSettings.trayEnabled}
          onToggle={() => void setSetting('trayEnabled', !resolvedSettings.trayEnabled)}
        />
        <SettingToggleCard
          title="Global Media Keys"
          description="Allows hardware media keys and system-level play, next, and previous shortcuts to control playback."
          enabled={resolvedSettings.globalShortcutsEnabled}
          onToggle={() =>
            void setSetting('globalShortcutsEnabled', !resolvedSettings.globalShortcutsEnabled)
          }
        />
        <SettingToggleCard
          title="Minimize To Tray"
          description="When enabled, minimizing the main window hides it to the tray instead of leaving it on the taskbar."
          enabled={resolvedSettings.minimizeToTray}
          onToggle={() => void setSetting('minimizeToTray', !resolvedSettings.minimizeToTray)}
        />
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Library Folders</h3>
            <p className="mt-2 text-sm text-slate-300">
              Imported folders are cumulative now, and you can rescan or remove saved sources here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleRescanLibrary()}
              disabled={libraryLoading || resolvedSettings.libraryPaths.length === 0}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {libraryLoading && pathActionTarget === '__all__' ? 'Rescanning...' : 'Rescan Library'}
            </button>
            <FolderImportButton />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last Scan</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {visibleScanStats
                  ? `${getTrackCountLabel(visibleScanStats.totalCount)} indexed`
                  : 'No scan summary in this session yet'}
              </div>
              {visibleScanTimeLabel ? (
                <div className="mt-1 text-xs text-slate-400" title={visibleScanExactTimeLabel ?? undefined}>
                  Last updated {visibleScanTimeLabel}
                </div>
              ) : null}
            </div>
            {visibleScanStats ? (
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">
                  +{visibleScanStats.addedCount} Added
                </span>
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1">
                  -{visibleScanStats.removedCount} Removed
                </span>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1">
                  {visibleScanStats.updatedCount} Updated
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Import or rescan folders to see cleanup details here.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {resolvedSettings.libraryPaths.length > 0 ? (
            resolvedSettings.libraryPaths.map((libraryPath) => (
              <div
                key={libraryPath}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0 flex-1 text-sm text-slate-200">{libraryPath}</div>
                <button
                  type="button"
                  onClick={() => void handleRemoveLibraryPath(libraryPath)}
                  disabled={libraryLoading}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPathActionBusy(libraryPath) ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              No folders have been saved yet.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Shortcut Summary</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            In-app controls use `Space`, `Alt + Left/Right`, `Alt + Shift + Left/Right`, `[ / ]`,
            `\`, `K`, `L`, and `M` for playback, seeking, volume, queue, lyrics, and mode changes.
            With global media keys enabled, the desktop media buttons also drive playback. The tray
            menu can bring the window forward directly into the queue or lyrics panel.
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Runtime Notes</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Changes apply immediately. If a media key is already claimed by another app, Electron
            may not be able to register that shortcut.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The app also publishes current track metadata to the system media session when
            supported, so OS media overlays can show the active song and send play, seek, previous,
            and next actions back to PulseLocal.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The player bar also includes a sleep timer for delayed pause or after-track stop. That
            timer is session-based and resets when the app relaunches.
          </p>
          {loading ? <p className="mt-3 text-xs text-slate-400">Syncing settings...</p> : null}
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Workspace Memory</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            PulseLocal now remembers window placement, playback queue and progress, the last page
            you opened, recent searches, library view preferences, whether the sidebar was
            collapsed, and the floating panel widths for lyrics and queue.
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">View Preferences</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sort and density choices are remembered for library tabs and playlist detail pages
                so the collection opens the way you left it.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                {hasViewPreferences
                  ? `${savedLibrarySortModes} library sort modes / ${savedLibraryDensityModes} library density modes / ${hasPlaylistViewPreferences ? 'playlist saved' : 'playlist default'}`
                  : 'Using default view preferences'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleResetViewPreferences()}
              disabled={!hasViewPreferences}
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset View
            </button>
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Playlist Artwork</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Rebuild saved playlist covers from the first available track artwork. Useful for
                older playlists created before cover syncing existed.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                {loadingPlaylistIndex
                  ? 'Loading playlists...'
                  : `${playlists.length} playlist${playlists.length === 1 ? '' : 's'} currently indexed`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleRefreshPlaylistCovers()}
              disabled={playlistLoading || refreshingPlaylistCovers}
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshingPlaylistCovers ? 'Refreshing...' : 'Refresh Covers'}
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
