import type { PlayMode } from './track'
import {
  clampLyricsPanelWidth,
  clampQueueDrawerWidth,
  DEFAULT_LYRICS_PANEL_WIDTH,
  DEFAULT_QUEUE_DRAWER_WIDTH
} from '../lib/shell'

export interface PersistedPlayerState {
  queueTrackIds: string[]
  currentTrackId?: string
  currentIndex: number
  progress: number
  volume: number
  lastAudibleVolume: number
  playMode: PlayMode
}

export interface PersistedShellState {
  lastRoute: string
  sidebarCollapsed: boolean
  lyricsPanelWidth: number
  queueDrawerWidth: number
}

export interface PersistedSearchState {
  recentKeywords: string[]
  recentEntries?: Array<{
    keyword: string
    searchedAt: string
  }>
}

export type PersistedLibraryMode = 'tracks' | 'albums' | 'favorites'
export type PersistedTableDensity = 'comfortable' | 'compact'

export interface PersistedLibraryViewState {
  sortByMode: Partial<Record<PersistedLibraryMode, string>>
  densityByMode: Partial<Record<PersistedLibraryMode, PersistedTableDensity>>
}

export interface PersistedPlaylistViewState {
  sortBy: string
  density: PersistedTableDensity
}

export interface PersistedLibraryScanState {
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
  scannedAt: string
}

export interface AppSettings {
  libraryPaths?: string[]
  theme?: 'light' | 'dark'
  trayEnabled?: boolean
  globalShortcutsEnabled?: boolean
  minimizeToTray?: boolean
  playerState?: PersistedPlayerState
  shellState?: PersistedShellState
  searchState?: PersistedSearchState
  libraryViewState?: PersistedLibraryViewState
  playlistViewState?: PersistedPlaylistViewState
  libraryScanState?: PersistedLibraryScanState
}

export const DEFAULT_APP_SETTINGS = {
  theme: 'dark',
  trayEnabled: true,
  globalShortcutsEnabled: true,
  minimizeToTray: false
} satisfies {
  theme: NonNullable<AppSettings['theme']>
  trayEnabled: boolean
  globalShortcutsEnabled: boolean
  minimizeToTray: boolean
}

export function resolveAppSettings(settings: AppSettings) {
  return {
    libraryPaths: settings.libraryPaths ?? [],
    theme: settings.theme ?? DEFAULT_APP_SETTINGS.theme,
    trayEnabled: settings.trayEnabled ?? DEFAULT_APP_SETTINGS.trayEnabled,
    globalShortcutsEnabled:
      settings.globalShortcutsEnabled ?? DEFAULT_APP_SETTINGS.globalShortcutsEnabled,
    minimizeToTray: settings.minimizeToTray ?? DEFAULT_APP_SETTINGS.minimizeToTray
  }
}

const PLAY_MODES: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']

export function resolvePersistedPlayerState(value: unknown): PersistedPlayerState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedPlayerState>
  const queueTrackIds = Array.isArray(candidate.queueTrackIds)
    ? candidate.queueTrackIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []

  const currentTrackId =
    typeof candidate.currentTrackId === 'string' && candidate.currentTrackId.length > 0
      ? candidate.currentTrackId
      : undefined

  const currentIndex =
    typeof candidate.currentIndex === 'number' && Number.isFinite(candidate.currentIndex)
      ? candidate.currentIndex
      : 0

  const progress =
    typeof candidate.progress === 'number' && Number.isFinite(candidate.progress)
      ? candidate.progress
      : 0

  const volume =
    typeof candidate.volume === 'number' && Number.isFinite(candidate.volume) ? candidate.volume : 0.82

  const lastAudibleVolume =
    typeof candidate.lastAudibleVolume === 'number' && Number.isFinite(candidate.lastAudibleVolume)
      ? candidate.lastAudibleVolume
      : volume > 0
        ? volume
        : 0.82

  const playMode =
    typeof candidate.playMode === 'string' && PLAY_MODES.includes(candidate.playMode as PlayMode)
      ? candidate.playMode
      : 'sequence'

  return {
    queueTrackIds,
    currentTrackId,
    currentIndex,
    progress,
    volume,
    lastAudibleVolume,
    playMode
  }
}

export function resolvePersistedShellState(value: unknown): PersistedShellState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedShellState>

  return {
    lastRoute:
      typeof candidate.lastRoute === 'string' && candidate.lastRoute.startsWith('/')
        ? candidate.lastRoute
        : '/',
    sidebarCollapsed:
      typeof candidate.sidebarCollapsed === 'boolean' ? candidate.sidebarCollapsed : false,
    lyricsPanelWidth: clampLyricsPanelWidth(
      typeof candidate.lyricsPanelWidth === 'number'
        ? candidate.lyricsPanelWidth
        : DEFAULT_LYRICS_PANEL_WIDTH
    ),
    queueDrawerWidth: clampQueueDrawerWidth(
      typeof candidate.queueDrawerWidth === 'number'
        ? candidate.queueDrawerWidth
        : DEFAULT_QUEUE_DRAWER_WIDTH
    )
  }
}

export function resolvePersistedSearchState(value: unknown): PersistedSearchState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedSearchState>
  const recentEntries = Array.isArray(candidate.recentEntries)
    ? candidate.recentEntries
        .filter(
          (item): item is { keyword: string; searchedAt: string } =>
            typeof item?.keyword === 'string' &&
            item.keyword.trim().length > 0 &&
            typeof item.searchedAt === 'string'
        )
        .map((item) => ({
          keyword: item.keyword.trim(),
          searchedAt: item.searchedAt
        }))
    : undefined

  return {
    recentKeywords: recentEntries
      ? recentEntries.map((entry) => entry.keyword)
      : Array.isArray(candidate.recentKeywords)
      ? candidate.recentKeywords.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [],
    recentEntries
  }
}

const LIBRARY_MODES: PersistedLibraryMode[] = ['tracks', 'albums', 'favorites']
const TABLE_DENSITIES: PersistedTableDensity[] = ['comfortable', 'compact']

export function resolvePersistedLibraryViewState(value: unknown): PersistedLibraryViewState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedLibraryViewState>
  const sortByMode = LIBRARY_MODES.reduce<PersistedLibraryViewState['sortByMode']>((nextState, mode) => {
    const sortBy = candidate.sortByMode?.[mode]

    if (typeof sortBy === 'string' && sortBy.length > 0) {
      nextState[mode] = sortBy
    }

    return nextState
  }, {})
  const densityByMode = LIBRARY_MODES.reduce<PersistedLibraryViewState['densityByMode']>((nextState, mode) => {
    const density = candidate.densityByMode?.[mode]

    if (typeof density === 'string' && TABLE_DENSITIES.includes(density as PersistedTableDensity)) {
      nextState[mode] = density as PersistedTableDensity
    }

    return nextState
  }, {})

  return {
    sortByMode,
    densityByMode
  }
}

export function resolvePersistedPlaylistViewState(value: unknown): PersistedPlaylistViewState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedPlaylistViewState>
  const sortBy = typeof candidate.sortBy === 'string' && candidate.sortBy.length > 0
    ? candidate.sortBy
    : 'playlist-order'
  const density =
    typeof candidate.density === 'string' && TABLE_DENSITIES.includes(candidate.density as PersistedTableDensity)
      ? candidate.density as PersistedTableDensity
      : 'comfortable'

  return {
    sortBy,
    density
  }
}

export function resolvePersistedLibraryScanState(value: unknown): PersistedLibraryScanState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedLibraryScanState>

  if (
    typeof candidate.totalCount !== 'number' ||
    typeof candidate.addedCount !== 'number' ||
    typeof candidate.removedCount !== 'number' ||
    typeof candidate.updatedCount !== 'number'
  ) {
    return null
  }

  return {
    totalCount: Math.max(0, Math.floor(candidate.totalCount)),
    addedCount: Math.max(0, Math.floor(candidate.addedCount)),
    removedCount: Math.max(0, Math.floor(candidate.removedCount)),
    updatedCount: Math.max(0, Math.floor(candidate.updatedCount)),
    discoveredFileCount:
      typeof candidate.discoveredFileCount === 'number'
        ? Math.max(0, Math.floor(candidate.discoveredFileCount))
        : undefined,
    warningCount:
      typeof candidate.warningCount === 'number'
        ? Math.max(0, Math.floor(candidate.warningCount))
        : undefined,
    warningDetailLimit:
      typeof candidate.warningDetailLimit === 'number'
        ? Math.max(0, Math.floor(candidate.warningDetailLimit))
        : undefined,
    durationMs:
      typeof candidate.durationMs === 'number'
        ? Math.max(0, Math.floor(candidate.durationMs))
        : undefined,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings
          .filter(
            (warning): warning is { path: string; reason: string } =>
              typeof warning?.path === 'string' && typeof warning.reason === 'string'
          )
          .slice(0, 20)
      : undefined,
    scannedAt:
      typeof candidate.scannedAt === 'string' && candidate.scannedAt.length > 0
        ? candidate.scannedAt
        : new Date(0).toISOString()
  }
}
