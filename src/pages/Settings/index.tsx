import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FolderImportButton from '../../components/library/FolderImportButton'
import MusicFileImportButton from '../../components/library/MusicFileImportButton'
import { useMinuteTicker } from '../../hooks/useMinuteTicker'
import { buildCsv } from '../../lib/csv'
import { formatDurationMs, formatFileSize, formatRelativeTime } from '../../lib/format'
import { matchesSearchTerms } from '../../lib/search'
import { LIBRARY_SOURCES_SECTION, SETTINGS_FOCUS_EVENT } from '../../lib/navigation'
import { musicApi } from '../../services/api'
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
import type { AppStorageInfo, DatabaseHealthResult, LibrarySourceInfo } from '../../../electron/types/ipc'

type SettingToggleCardProps = {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}

type LibrarySourceSortMode = 'status' | 'tracks-desc' | 'path-asc'
type SettingsFocusEvent = CustomEvent<{
  section: string
}>

function getErrorDetail(error: unknown) {
  return error instanceof Error ? error.message : null
}

function isSettingsFocusEvent(event: Event): event is SettingsFocusEvent {
  return event instanceof CustomEvent && typeof event.detail?.section === 'string'
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
  const location = useLocation()
  const navigate = useNavigate()

  const settings = useSettingsStore((state) => state.settings)
  const ready = useSettingsStore((state) => state.ready)
  const loading = useSettingsStore((state) => state.loading)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const setSetting = useSettingsStore((state) => state.setSetting)
  const setThemeSetting = useSettingsStore((state) => state.setThemeSetting)
  const scanFolders = useLibraryStore((state) => state.scanFolders)
  const libraryLoading = useLibraryStore((state) => state.loading)
  const lastScanStats = useLibraryStore((state) => state.lastScanStats)
  const tracks = useLibraryStore((state) => state.tracks)
  const refreshPlaylistCovers = usePlaylistStore((state) => state.refreshPlaylistCovers)
  const importPlaylistFromM3u = usePlaylistStore((state) => state.importPlaylistFromM3u)
  const playlists = usePlaylistStore((state) => state.playlists)
  const loadPlaylists = usePlaylistStore((state) => state.loadPlaylists)
  const playlistLoading = usePlaylistStore((state) => state.loading)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const [pathActionTarget, setPathActionTarget] = useState<string | null>(null)
  const [sourceActionTarget, setSourceActionTarget] = useState<string | null>(null)
  const [sourceInfoByPath, setSourceInfoByPath] = useState<Record<string, LibrarySourceInfo>>({})
  const [sourceInfoLoading, setSourceInfoLoading] = useState(false)
  const [sourceFilterKeyword, setSourceFilterKeyword] = useState('')
  const [sourceSortMode, setSourceSortMode] = useState<LibrarySourceSortMode>('status')
  const [storageInfo, setStorageInfo] = useState<AppStorageInfo | null>(null)
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealthResult | null>(null)
  const [storageAction, setStorageAction] = useState<string | null>(null)
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null)
  const [focusedSection, setFocusedSection] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) {
      void loadSettings()
    }
  }, [loadSettings, ready])

  useEffect(() => {
    const focusSection = (section: string) => {
      if (section !== LIBRARY_SOURCES_SECTION) {
        return
      }

      window.setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }, 0)

      setFocusedSection(section)

      return window.setTimeout(() => {
        setFocusedSection(null)
      }, 2200)
    }
    const query = new URLSearchParams(location.search)
    let timer: number | undefined

    if (query.get('focus') === LIBRARY_SOURCES_SECTION) {
      timer = focusSection(LIBRARY_SOURCES_SECTION)
    }

    const handleFocusEvent = (event: Event) => {
      if (!isSettingsFocusEvent(event)) {
        return
      }

      if (timer) {
        window.clearTimeout(timer)
      }

      timer = focusSection(event.detail.section)
    }

    window.addEventListener(SETTINGS_FOCUS_EVENT, handleFocusEvent)

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }

      window.removeEventListener(SETTINGS_FOCUS_EVENT, handleFocusEvent)
    }
  }, [location.search])

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
  const visibleScanWarningCount = visibleScanStats?.warningCount ?? visibleScanStats?.warnings?.length ?? 0
  const visibleScanWarnings = visibleScanStats?.warnings?.slice(0, 3) ?? []
  const visibleScanWarningDetailLimit = visibleScanStats?.warningDetailLimit ?? visibleScanStats?.warnings?.length ?? 0
  const visibleScanDurationLabel =
    typeof visibleScanStats?.durationMs === 'number'
      ? formatDurationMs(visibleScanStats.durationMs)
      : null
  const visibleScanThroughputLabel =
    typeof visibleScanStats?.durationMs === 'number' &&
    visibleScanStats.durationMs > 0 &&
    typeof visibleScanStats.discoveredFileCount === 'number'
      ? `${(visibleScanStats.discoveredFileCount / (visibleScanStats.durationMs / 1000)).toFixed(1)} files/sec`
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
  const importingPlaylist = maintenanceAction === 'playlist-import'
  const loadingPlaylistIndex = playlistLoading && !refreshingPlaylistCovers
  const isPathActionBusy = (libraryPath: string) =>
    libraryLoading && pathActionTarget === libraryPath
  const isSourceActionBusy = (libraryPath: string, action: string) =>
    sourceActionTarget === `${action}:${libraryPath}`
  const readLibraryActionSucceeded = () => !useLibraryStore.getState().error
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const getTrackCountLabel = (count: number) => `${count} track${count === 1 ? '' : 's'}`
  const libraryPathsKey = resolvedSettings.libraryPaths.join('\n')
  const missingSourceCount = resolvedSettings.libraryPaths.filter(
    (libraryPath) => sourceInfoByPath[libraryPath]?.type === 'missing'
  ).length
  const sourceTrackCounts = useMemo(() => {
    const normalizePath = (value: string) =>
      value.replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase()
    const normalizedTrackPaths = tracks.map((track) => normalizePath(track.path))

    return Object.fromEntries(
      resolvedSettings.libraryPaths.map((libraryPath) => {
        const normalizedSourcePath = normalizePath(libraryPath)
        const sourceType = sourceInfoByPath[libraryPath]?.type
        const count = normalizedTrackPaths.filter((trackPath) => {
          if (sourceType === 'file') {
            return trackPath === normalizedSourcePath
          }

          if (sourceType === 'folder') {
            return trackPath === normalizedSourcePath || trackPath.startsWith(`${normalizedSourcePath}/`)
          }

          return trackPath === normalizedSourcePath || trackPath.startsWith(`${normalizedSourcePath}/`)
        }).length

        return [libraryPath, count]
      })
    )
  }, [resolvedSettings.libraryPaths, sourceInfoByPath, tracks])
  const sourceSummary = useMemo(() => {
    return resolvedSettings.libraryPaths.reduce(
      (summary, libraryPath) => {
        const sourceType = sourceInfoByPath[libraryPath]?.type

        if (sourceType === 'folder') {
          summary.folderCount += 1
        } else if (sourceType === 'file') {
          summary.fileCount += 1
        } else if (sourceType === 'missing') {
          summary.missingCount += 1
        } else if (sourceType === 'other') {
          summary.otherCount += 1
        } else {
          summary.unknownCount += 1
        }

        summary.trackCount += sourceTrackCounts[libraryPath] ?? 0

        return summary
      },
      {
        folderCount: 0,
        fileCount: 0,
        missingCount: 0,
        otherCount: 0,
        unknownCount: 0,
        trackCount: 0
      }
    )
  }, [resolvedSettings.libraryPaths, sourceInfoByPath, sourceTrackCounts])
  const emptySourceCount = resolvedSettings.libraryPaths.filter((libraryPath) => {
    const sourceType = sourceInfoByPath[libraryPath]?.type

    return sourceType !== 'missing' && sourceType !== undefined && (sourceTrackCounts[libraryPath] ?? 0) === 0
  }).length
  const visibleLibraryPaths = useMemo(() => {
    const keyword = sourceFilterKeyword.trim()
    const statusRank = {
      missing: 0,
      unknown: 1,
      other: 2,
      file: 3,
      folder: 4
    } satisfies Record<string, number>
    const filteredPaths = !keyword
      ? resolvedSettings.libraryPaths
      : resolvedSettings.libraryPaths.filter((libraryPath) => {
          const sourceInfo = sourceInfoByPath[libraryPath]
          const sourceType = sourceInfo?.type ?? 'unknown'
          const sourceTrackCount = sourceTrackCounts[libraryPath] ?? 0

          return matchesSearchTerms(
            [
              libraryPath,
              sourceType,
              `${sourceTrackCount} track${sourceTrackCount === 1 ? '' : 's'}`
            ],
            keyword
          )
        })

    return [...filteredPaths].sort((leftPath, rightPath) => {
      const leftType = sourceInfoByPath[leftPath]?.type ?? 'unknown'
      const rightType = sourceInfoByPath[rightPath]?.type ?? 'unknown'
      const leftTrackCount = sourceTrackCounts[leftPath] ?? 0
      const rightTrackCount = sourceTrackCounts[rightPath] ?? 0

      if (sourceSortMode === 'tracks-desc') {
        return rightTrackCount - leftTrackCount || leftPath.localeCompare(rightPath)
      }

      if (sourceSortMode === 'path-asc') {
        return leftPath.localeCompare(rightPath)
      }

      return (
        (statusRank[leftType] ?? statusRank.unknown) - (statusRank[rightType] ?? statusRank.unknown) ||
        rightTrackCount - leftTrackCount ||
        leftPath.localeCompare(rightPath)
      )
    })
  }, [
    resolvedSettings.libraryPaths,
    sourceFilterKeyword,
    sourceInfoByPath,
    sourceSortMode,
    sourceTrackCounts
  ])

  useEffect(() => {
    const libraryPaths = resolvedSettings.libraryPaths

    if (libraryPaths.length === 0) {
      setSourceInfoByPath({})
      setSourceInfoLoading(false)
      return
    }

    let cancelled = false

    setSourceInfoLoading(true)

    void musicApi
      .getLibrarySourceInfo(libraryPaths)
      .then((sourceInfos) => {
        if (cancelled) {
          return
        }

        setSourceInfoByPath(
          Object.fromEntries(sourceInfos.map((sourceInfo) => [sourceInfo.path, sourceInfo]))
        )
      })
      .catch(() => {
        if (!cancelled) {
          setSourceInfoByPath({})
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSourceInfoLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [libraryPathsKey])

  useEffect(() => {
    let cancelled = false

    void musicApi.getAppStorageInfo().then((nextStorageInfo) => {
      if (!cancelled) {
        setStorageInfo(nextStorageInfo)
      }
    })

    return () => {
      cancelled = true
    }
  }, [visibleScanStats?.scannedAt])

  const handleRescanLibrary = async () => {
    if (libraryLoading) {
      return
    }

    if (resolvedSettings.libraryPaths.length === 0) {
      showFeedback('Add a music source before rescanning.', 'error')
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
    const shouldRemove = window.confirm(`Remove this library source?\n\n${libraryPath}`)

    if (!shouldRemove) {
      return
    }

    setPathActionTarget(libraryPath)

    try {
      await scanFolders(nextPaths)
      if (readLibraryActionSucceeded()) {
        const stats = useLibraryStore.getState().lastScanStats
        const nextTrackCount = stats?.totalCount ?? useLibraryStore.getState().tracks.length
        showFeedback(nextPaths.length > 0 ? 'Library source removed.' : 'Library cleared.', 'success', null, {
          detail: stats
            ? `${stats.removedCount} removed, ${stats.addedCount} added, ${stats.updatedCount} updated. ${getTrackCountLabel(nextTrackCount)} still available.`
            : `${getTrackCountLabel(nextTrackCount)} still available.`
        })
      } else {
        showFeedback('Could not remove that library source.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleRemoveMissingSources = async () => {
    if (libraryLoading || missingSourceCount === 0) {
      return
    }

    const missingPaths = resolvedSettings.libraryPaths.filter(
      (libraryPath) => sourceInfoByPath[libraryPath]?.type === 'missing'
    )
    const shouldRemove = window.confirm(
      `Remove ${missingPaths.length} missing library source${missingPaths.length === 1 ? '' : 's'} and rescan?`
    )

    if (!shouldRemove) {
      return
    }

    const nextPaths = resolvedSettings.libraryPaths.filter(
      (libraryPath) => sourceInfoByPath[libraryPath]?.type !== 'missing'
    )

    setPathActionTarget('__missing__')

    try {
      await scanFolders(nextPaths)

      if (readLibraryActionSucceeded()) {
        const stats = useLibraryStore.getState().lastScanStats
        showFeedback('Missing library sources removed.', 'success', null, {
          detail: stats
            ? `${stats.removedCount} removed, ${stats.addedCount} added, ${stats.updatedCount} updated. ${getTrackCountLabel(stats.totalCount)} available.`
            : `${getTrackCountLabel(useLibraryStore.getState().tracks.length)} available.`
        })
      } else {
        showFeedback('Could not remove missing sources right now.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleRemoveEmptySources = async () => {
    if (libraryLoading || emptySourceCount === 0) {
      return
    }

    const emptyPaths = resolvedSettings.libraryPaths.filter((libraryPath) => {
      const sourceType = sourceInfoByPath[libraryPath]?.type

      return sourceType !== 'missing' && sourceType !== undefined && (sourceTrackCounts[libraryPath] ?? 0) === 0
    })
    const shouldRemove = window.confirm(
      `Remove ${emptyPaths.length} empty library source${emptyPaths.length === 1 ? '' : 's'} and rescan?`
    )

    if (!shouldRemove) {
      return
    }

    const nextPaths = resolvedSettings.libraryPaths.filter((libraryPath) => !emptyPaths.includes(libraryPath))

    setPathActionTarget('__empty__')

    try {
      await scanFolders(nextPaths)

      if (readLibraryActionSucceeded()) {
        const stats = useLibraryStore.getState().lastScanStats
        showFeedback('Empty library sources removed.', 'success', null, {
          detail: stats
            ? `${stats.removedCount} removed, ${stats.addedCount} added, ${stats.updatedCount} updated. ${getTrackCountLabel(stats.totalCount)} available.`
            : `${getTrackCountLabel(useLibraryStore.getState().tracks.length)} available.`
        })
      } else {
        showFeedback('Could not remove empty sources right now.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleClearLibrary = async () => {
    if (libraryLoading || resolvedSettings.libraryPaths.length === 0) {
      return
    }

    const shouldClear = window.confirm(
      'Clear the entire local library?\n\nThis removes saved music sources and indexed tracks from the app, but it will not delete audio files from disk.'
    )

    if (!shouldClear) {
      return
    }

    setPathActionTarget('__clear__')

    try {
      await scanFolders([])

      if (readLibraryActionSucceeded()) {
        showFeedback('Library cleared.', 'success', null, {
          detail: 'Saved sources and indexed tracks were removed from the app. Audio files on disk were not deleted.'
        })
      } else {
        showFeedback('Could not clear the library right now.', 'error', null, {
          detail: useLibraryStore.getState().error
        })
      }
    } finally {
      setPathActionTarget(null)
    }
  }

  const handleRevealLibrarySource = async (libraryPath: string) => {
    setSourceActionTarget(`reveal:${libraryPath}`)

    try {
      await musicApi.showLibrarySourceInFolder(libraryPath)
      showFeedback('Opened library source location.', 'success', null, {
        detail: libraryPath
      })
    } catch (error) {
      showFeedback('Could not reveal that library source.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleOpenLibrarySource = async (libraryPath: string) => {
    setSourceActionTarget(`open:${libraryPath}`)

    try {
      await musicApi.openLibrarySourcePath(libraryPath)
      showFeedback('Opened library source.', 'success', null, {
        detail: libraryPath
      })
    } catch (error) {
      showFeedback('Could not open that library source.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleCopyLibrarySourcePath = async (libraryPath: string) => {
    setSourceActionTarget(`copy:${libraryPath}`)

    try {
      await navigator.clipboard.writeText(libraryPath)
      showFeedback('Copied library source path.', 'success', null, {
        detail: libraryPath
      })
    } catch (error) {
      showFeedback('Could not copy that library source path.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleCopyVisibleSourcePaths = async () => {
    if (visibleLibraryPaths.length === 0) {
      showFeedback('No visible source paths to copy.', 'muted')
      return
    }

    setSourceActionTarget('__copy-visible__')

    try {
      await navigator.clipboard.writeText(visibleLibraryPaths.join('\n'))
      showFeedback('Copied visible source paths.', 'success', null, {
        detail: `${visibleLibraryPaths.length} source${visibleLibraryPaths.length === 1 ? '' : 's'} copied.`
      })
    } catch (error) {
      showFeedback('Could not copy visible source paths.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleCopyScanWarnings = async () => {
    const warnings = visibleScanStats?.warnings ?? []

    if (warnings.length === 0) {
      showFeedback('No scan warnings to copy.', 'muted')
      return
    }

    setSourceActionTarget('__copy-warnings__')

    try {
      const warningText = warnings
        .map((warning, index) => `${index + 1}. ${warning.path}\n${warning.reason}`)
        .join('\n\n')

      await navigator.clipboard.writeText(warningText)
      showFeedback('Copied scan warnings.', 'success', null, {
        detail: `${warnings.length} saved warning detail${warnings.length === 1 ? '' : 's'} copied.`
      })
    } catch (error) {
      showFeedback('Could not copy scan warnings.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleExportVisibleSourcesCsv = async () => {
    if (visibleLibraryPaths.length === 0) {
      showFeedback('No visible sources to export.', 'muted')
      return
    }

    const rows = [
      ['path', 'type', 'exists', 'track_count'],
      ...visibleLibraryPaths.map((libraryPath) => {
        const sourceInfo = sourceInfoByPath[libraryPath]
        const sourceType = sourceInfo?.type ?? 'unknown'
        const exists = sourceInfo ? (sourceInfo.exists ? 'yes' : 'no') : 'unknown'

        return [
          libraryPath,
          sourceType,
          exists,
          sourceTrackCounts[libraryPath] ?? 0
        ]
      })
    ]
    const csv = buildCsv(rows)

    setSourceActionTarget('__export-visible__')

    try {
      await navigator.clipboard.writeText(`${csv}\n`)
      showFeedback('Visible sources CSV copied.', 'success', null, {
        detail: `${visibleLibraryPaths.length} source${visibleLibraryPaths.length === 1 ? '' : 's'} copied as CSV.`
      })
    } catch (error) {
      showFeedback('Could not copy visible sources CSV.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setSourceActionTarget(null)
    }
  }

  const handleOpenAppStorageFolder = async () => {
    setStorageAction('open')

    try {
      await musicApi.openAppStorageFolder()
      showFeedback('Opened app data folder.', 'success', null, {
        detail: storageInfo?.userDataPath ?? null
      })
    } catch (error) {
      showFeedback('Could not open the app data folder.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleCopyStoragePath = async (pathLabel: string, filePath: string | undefined) => {
    if (!filePath) {
      return
    }

    setStorageAction(`copy:${pathLabel}`)

    try {
      await navigator.clipboard.writeText(filePath)
      showFeedback(`Copied ${pathLabel} path.`, 'success', null, {
        detail: filePath
      })
    } catch (error) {
      showFeedback(`Could not copy the ${pathLabel} path.`, 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleBackupDatabase = async () => {
    setStorageAction('backup')

    try {
      const result = await musicApi.backupDatabase()

      if (!result) {
        return
      }

      showFeedback('Database backup created.', 'success', null, {
        detail: `${formatFileSize(result.sizeBytes)} saved to ${result.filePath}.`
      })
    } catch (error) {
      showFeedback('Could not back up the database.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleCheckDatabaseHealth = async () => {
    setStorageAction('health')

    try {
      const result = await musicApi.checkDatabaseHealth()
      setDatabaseHealth(result)
      showFeedback(result.ok ? 'Database health check passed.' : 'Database health check found issues.', result.ok ? 'success' : 'error', null, {
        detail: `${result.message}. ${result.foreignKeyIssueCount} foreign key issue${result.foreignKeyIssueCount === 1 ? '' : 's'}, ${result.pageCount} pages, ${result.freePageCount} free pages.`
      })
    } catch (error) {
      showFeedback('Could not check database health.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleOptimizeDatabase = async () => {
    const shouldOptimize = window.confirm(
      'Optimize and compact the local SQLite database?\n\nThis may take a moment on large libraries. It does not delete music files.'
    )

    if (!shouldOptimize) {
      return
    }

    setStorageAction('optimize')

    try {
      const result = await musicApi.optimizeDatabase()
      const nextStorageInfo = await musicApi.getAppStorageInfo()
      setStorageInfo(nextStorageInfo)
      showFeedback('Database optimized.', 'success', null, {
        detail:
          result.reclaimedBytes > 0
            ? `${formatFileSize(result.reclaimedBytes)} reclaimed. ${formatFileSize(result.afterSizeBytes)} database size now.`
            : `No space needed reclaiming. ${formatFileSize(result.afterSizeBytes)} database size now.`
      })
    } catch (error) {
      showFeedback('Could not optimize the database.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleCleanupArtworkCache = async () => {
    const shouldCleanup = window.confirm(
      'Clean unused artwork cache files?\n\nOnly generated cover cache files that are no longer referenced by indexed tracks or playlists will be removed. Music files are not touched.'
    )

    if (!shouldCleanup) {
      return
    }

    setStorageAction('cleanup-artwork')

    try {
      const result = await musicApi.cleanupArtworkCache()
      const nextStorageInfo = await musicApi.getAppStorageInfo()
      const fileSummary =
        result.deletedCount > 0
          ? `${result.deletedCount} of ${result.checkedCount} cache file${result.checkedCount === 1 ? '' : 's'} removed`
          : `${result.checkedCount} cache file${result.checkedCount === 1 ? '' : 's'} checked`
      const reclaimSummary =
        result.reclaimedBytes > 0
          ? `${formatFileSize(result.reclaimedBytes)} reclaimed`
          : 'no space reclaimed'
      const directorySummary =
        result.removedDirectoryCount > 0
          ? ` ${result.removedDirectoryCount} empty cache folder${result.removedDirectoryCount === 1 ? '' : 's'} removed.`
          : ''

      setStorageInfo(nextStorageInfo)
      showFeedback('Artwork cache cleaned.', 'success', null, {
        detail: `${fileSummary}. ${reclaimSummary}.${directorySummary}`
      })
    } catch (error) {
      showFeedback('Could not clean artwork cache.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleExportDiagnostics = async () => {
    setStorageAction('diagnostics')

    try {
      const result = await musicApi.exportDiagnosticsReport()

      if (!result) {
        return
      }

      showFeedback('Diagnostics report exported.', 'success', null, {
        detail: `${formatFileSize(result.sizeBytes)} saved to ${result.filePath}.`
      })
    } catch (error) {
      showFeedback('Could not export diagnostics report.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
    }
  }

  const handleExportLibraryCsv = async () => {
    setStorageAction('library-csv')

    try {
      const result = await musicApi.exportLibraryCsv()

      if (!result) {
        return
      }

      showFeedback('Library CSV exported.', 'success', null, {
        detail:
          result.trackCount > 0
            ? `${result.trackCount} track${result.trackCount === 1 ? '' : 's'} / ${formatFileSize(result.sizeBytes)} saved to ${result.filePath}.`
            : `No tracks are indexed yet. Header-only CSV saved to ${result.filePath}.`
      })
    } catch (error) {
      showFeedback('Could not export library CSV.', 'error', null, {
        detail: getErrorDetail(error)
      })
    } finally {
      setStorageAction(null)
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

  const handleImportPlaylistFromM3u = async () => {
    if (playlistLoading) {
      return
    }

    setMaintenanceAction('playlist-import')

    try {
      const result = await importPlaylistFromM3u()

      if (!result) {
        const importError = usePlaylistStore.getState().error

        if (importError) {
          showFeedback('Could not import that playlist.', 'error', null, {
            detail: importError
          })
        }

        return
      }

      navigate(`/playlists/${result.playlist.id}`)
      showFeedback(`Imported ${result.playlist.name}.`, 'success', null, {
        detail: `${result.addedCount} matched track${result.addedCount === 1 ? '' : 's'} added${
          result.unmatchedCount > 0
            ? `, ${result.unmatchedCount} playlist entr${result.unmatchedCount === 1 ? 'y was' : 'ies were'} not found in this library`
            : ''
        }.`
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
          Theme, tray behavior, global media shortcuts, and imported library sources are all routed through
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

      <section
        id={LIBRARY_SOURCES_SECTION}
        className={`scroll-mt-6 rounded-3xl border p-6 shadow-soft transition ${
          focusedSection === LIBRARY_SOURCES_SECTION
            ? 'border-aurora/60 bg-aurora/10'
            : 'border-white/10 bg-slate-950/55'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Library Sources</h3>
            <p className="mt-2 text-sm text-slate-300">
              Imported folders and dropped audio files are cumulative. Rescan or remove saved
              sources here.
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
            {missingSourceCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleRemoveMissingSources()}
                disabled={libraryLoading}
                className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {libraryLoading && pathActionTarget === '__missing__' ? 'Cleaning...' : 'Remove Missing'}
              </button>
            ) : null}
            {emptySourceCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleRemoveEmptySources()}
                disabled={libraryLoading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {libraryLoading && pathActionTarget === '__empty__' ? 'Cleaning...' : 'Remove Empty'}
              </button>
            ) : null}
            {resolvedSettings.libraryPaths.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleClearLibrary()}
                disabled={libraryLoading}
                className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {libraryLoading && pathActionTarget === '__clear__' ? 'Clearing...' : 'Clear Library'}
              </button>
            ) : null}
            <FolderImportButton />
            <MusicFileImportButton />
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
              {visibleScanDurationLabel ? (
                <div className="mt-1 text-xs text-slate-400">
                  Scan took {visibleScanDurationLabel}
                  {visibleScanThroughputLabel ? ` / ${visibleScanThroughputLabel}` : ''}
                </div>
              ) : null}
              {sourceInfoLoading || missingSourceCount > 0 ? (
                <div className={`mt-2 text-xs ${missingSourceCount > 0 ? 'text-amber-200' : 'text-slate-400'}`}>
                  {sourceInfoLoading
                    ? 'Checking saved source paths...'
                    : `${missingSourceCount} saved source${missingSourceCount === 1 ? '' : 's'} missing on disk.`}
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
                {typeof visibleScanStats.discoveredFileCount === 'number' ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {visibleScanStats.discoveredFileCount} Files Found
                  </span>
                ) : null}
                {visibleScanWarningCount > 0 ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
                    {visibleScanWarningCount} Warnings
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Import or rescan sources to see cleanup details here.
              </div>
            )}
          </div>
          {visibleScanWarnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200">
                    Recent Scan Warnings
                  </div>
                  <div className="mt-1 text-xs text-amber-100/80">
                    Showing {visibleScanWarnings.length} of {visibleScanWarningCount}. Copy warnings exports up to {visibleScanWarningDetailLimit} saved details.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyScanWarnings()}
                  disabled={Boolean(sourceActionTarget)}
                  className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sourceActionTarget === '__copy-warnings__' ? 'Copying...' : 'Copy Warnings'}
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {visibleScanWarnings.map((warning) => (
                  <div key={`${warning.path}:${warning.reason}`} className="rounded-xl bg-slate-950/35 p-3">
                    <div className="break-all text-xs text-amber-100">{warning.path}</div>
                    <div className="mt-1 text-xs text-amber-200/80">{warning.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
          Library maintenance only changes PulseLocal's saved sources and SQLite index. It never
          deletes music files from disk. For larger cleanup sessions, use <span className="text-white">Backup DB</span>{' '}
          in Local Storage first, then rescan, remove missing or empty sources, and optimize the
          database if needed.
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-center">
          <input
            value={sourceFilterKeyword}
            onChange={(event) => setSourceFilterKeyword(event.target.value)}
            placeholder="Filter sources by path, type, or track count"
            className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Sort
            </span>
            <select
              value={sourceSortMode}
              onChange={(event) => setSourceSortMode(event.target.value as LibrarySourceSortMode)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              <option value="status" className="bg-slate-950 text-white">
                Status First
              </option>
              <option value="tracks-desc" className="bg-slate-950 text-white">
                Most Tracks
              </option>
              <option value="path-asc" className="bg-slate-950 text-white">
                Path A-Z
              </option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {resolvedSettings.libraryPaths.length} Sources
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {sourceSummary.folderCount} Folders
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {sourceSummary.fileCount} Files
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {sourceSummary.trackCount} Linked Tracks
            </span>
            {emptySourceCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {emptySourceCount} Empty
              </span>
            ) : null}
            {sourceSummary.missingCount > 0 ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
                {sourceSummary.missingCount} Missing
              </span>
            ) : null}
          </div>
        </div>
        {resolvedSettings.libraryPaths.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => setSourceFilterKeyword('missing')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10"
            >
              Show Missing
            </button>
            <button
              type="button"
              onClick={() => setSourceFilterKeyword('0 tracks')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10"
            >
              Show Empty
            </button>
            <button
              type="button"
              onClick={() => setSourceFilterKeyword('folder')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10"
            >
              Folders
            </button>
            <button
              type="button"
              onClick={() => setSourceFilterKeyword('file')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10"
            >
              Files
            </button>
            {sourceFilterKeyword.trim() ? (
              <button
                type="button"
                onClick={() => setSourceFilterKeyword('')}
                className="rounded-full border border-aurora/30 bg-aurora/10 px-3 py-1 text-aurora transition hover:bg-aurora/15"
              >
                Clear Filter
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleCopyVisibleSourcePaths()}
              disabled={visibleLibraryPaths.length === 0 || Boolean(sourceActionTarget)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sourceActionTarget === '__copy-visible__' ? 'Copying...' : 'Copy Visible Paths'}
            </button>
            <button
              type="button"
              onClick={() => void handleExportVisibleSourcesCsv()}
              disabled={visibleLibraryPaths.length === 0 || Boolean(sourceActionTarget)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sourceActionTarget === '__export-visible__' ? 'Copying...' : 'Copy Visible CSV'}
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {resolvedSettings.libraryPaths.length > 0 ? (
            visibleLibraryPaths.length > 0 ? (
            visibleLibraryPaths.map((libraryPath) => {
              const sourceInfo = sourceInfoByPath[libraryPath]
              const sourceType = sourceInfo?.type ?? (sourceInfoLoading ? 'checking' : 'unknown')
              const sourceMissing = sourceType === 'missing'
              const sourceTrackCount = sourceTrackCounts[libraryPath] ?? 0
              const sourceLabel =
                sourceType === 'folder'
                  ? 'Folder'
                  : sourceType === 'file'
                    ? 'File'
                    : sourceType === 'missing'
                      ? 'Missing'
                      : sourceType === 'other'
                        ? 'Other'
                        : sourceType === 'checking'
                          ? 'Checking'
                          : 'Unknown'

              return (
              <div
                key={libraryPath}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  sourceMissing
                    ? 'border-amber-400/30 bg-amber-500/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${
                        sourceMissing
                          ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      {sourceLabel}
                    </span>
                    {sourceMissing ? (
                      <span className="text-xs text-amber-100">
                        This source is kept in your saved list until you remove missing sources.
                      </span>
                    ) : null}
                    {sourceInfo ? (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${
                          sourceMissing
                            ? 'border-amber-300/20 bg-slate-950/45 text-amber-100'
                            : 'border-white/10 bg-slate-950/45 text-slate-300'
                        }`}
                      >
                        {sourceTrackCount} track{sourceTrackCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 break-all text-sm text-slate-200">{libraryPath}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRevealLibrarySource(libraryPath)}
                    disabled={Boolean(sourceActionTarget) || sourceMissing}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSourceActionBusy(libraryPath, 'reveal') ? 'Opening...' : 'Reveal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOpenLibrarySource(libraryPath)}
                    disabled={Boolean(sourceActionTarget) || sourceMissing}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSourceActionBusy(libraryPath, 'open') ? 'Opening...' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyLibrarySourcePath(libraryPath)}
                    disabled={Boolean(sourceActionTarget)}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSourceActionBusy(libraryPath, 'copy') ? 'Copying...' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveLibraryPath(libraryPath)}
                    disabled={libraryLoading}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPathActionBusy(libraryPath) ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
              )
            })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                No saved sources match this filter.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              No library sources have been saved yet.
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-white">Local Storage</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Database, artwork cache, and app-local files live in the Electron user data folder.
              </p>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Database</div>
                  <div className="mt-2 break-all text-slate-200">
                    {storageInfo?.databasePath ?? 'Loading...'}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Size {formatFileSize(storageInfo?.databaseSizeBytes ?? 0)}
                  </div>
                  {databaseHealth ? (
                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                        databaseHealth.ok
                          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                          : 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                      }`}
                    >
                      {databaseHealth.ok ? 'Integrity OK' : 'Integrity issue'} / {databaseHealth.foreignKeyIssueCount} FK issues / {databaseHealth.pageCount} pages / {databaseHealth.freePageCount} free
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artwork Cache</div>
                  <div className="mt-2 break-all text-slate-200">
                    {storageInfo?.artworkCacheDir ?? 'Loading...'}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {storageInfo
                      ? `${storageInfo.artworkCacheFileCount} file${storageInfo.artworkCacheFileCount === 1 ? '' : 's'} / ${formatFileSize(storageInfo.artworkCacheSizeBytes)}`
                      : 'Counting cache files...'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleOpenAppStorageFolder()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'open' ? 'Opening...' : 'Open Folder'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyStoragePath('database', storageInfo?.databasePath)}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'copy:database' ? 'Copying...' : 'Copy DB Path'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyStoragePath('app data', storageInfo?.userDataPath)}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'copy:app data' ? 'Copying...' : 'Copy Data Path'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyStoragePath('artwork cache', storageInfo?.artworkCacheDir)}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'copy:artwork cache' ? 'Copying...' : 'Copy Cache Path'}
              </button>
              <button
                type="button"
                onClick={() => void handleBackupDatabase()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-aurora/30 bg-aurora/10 px-4 py-3 text-sm text-aurora transition hover:bg-aurora/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'backup' ? 'Backing Up...' : 'Backup DB'}
              </button>
              <button
                type="button"
                onClick={() => void handleCheckDatabaseHealth()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'health' ? 'Checking...' : 'Check DB'}
              </button>
              <button
                type="button"
                onClick={() => void handleOptimizeDatabase()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'optimize' ? 'Optimizing...' : 'Optimize DB'}
              </button>
              <button
                type="button"
                onClick={() => void handleCleanupArtworkCache()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'cleanup-artwork' ? 'Cleaning...' : 'Clean Artwork'}
              </button>
              <button
                type="button"
                onClick={() => void handleExportDiagnostics()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'diagnostics' ? 'Exporting...' : 'Export Diagnostics'}
              </button>
              <button
                type="button"
                onClick={() => void handleExportLibraryCsv()}
                disabled={!storageInfo || Boolean(storageAction)}
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storageAction === 'library-csv' ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
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
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Playlist Exchange</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Import `.m3u` or `.m3u8` files from another player. The importer matches file
                paths against tracks that are already in your local library.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                Export is available from each playlist page
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleImportPlaylistFromM3u()}
              disabled={playlistLoading || importingPlaylist}
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importingPlaylist ? 'Importing...' : 'Import M3U'}
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
