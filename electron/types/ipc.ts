import type { Playlist } from '../../src/types/playlist'
import type { LyricLine } from '../../src/types/lyrics'
import type { HistoryEntry } from '../../src/types/history'
import type { AppSettings } from '../../src/types/settings'
import type { Track } from '../../src/types/track'

export type AppCommand =
  | 'play-pause'
  | 'next-track'
  | 'previous-track'
  | 'show-queue'
  | 'toggle-lyrics'

export type DesktopPlaybackState = {
  trackTitle: string | null
  artist: string | null
  trackPath: string | null
  isPlaying: boolean
  queueLength: number
  currentIndex: number
}

export type LibraryScanResult = {
  tracks: Track[]
  stats: {
    totalCount: number
    addedCount: number
    removedCount: number
    updatedCount: number
    discoveredFileCount: number
    warningCount: number
    warningDetailLimit: number
    durationMs: number
    warnings: Array<{
      path: string
      reason: string
    }>
  }
}

export type LibrarySourceInfo = {
  path: string
  exists: boolean
  type: 'folder' | 'file' | 'other' | 'missing'
}

export type AppStorageInfo = {
  userDataPath: string
  databasePath: string
  databaseSizeBytes: number
  artworkCacheDir: string
  artworkCacheSizeBytes: number
  artworkCacheFileCount: number
}

export type DatabaseBackupResult = {
  filePath: string
  sizeBytes: number
}

export type DatabaseHealthResult = {
  ok: boolean
  message: string
  foreignKeyIssueCount: number
  pageCount: number
  freePageCount: number
}

export type DatabaseOptimizeResult = {
  beforeSizeBytes: number
  afterSizeBytes: number
  reclaimedBytes: number
}

export type ArtworkCacheCleanupResult = {
  checkedCount: number
  deletedCount: number
  reclaimedBytes: number
  removedDirectoryCount: number
}

export type DiagnosticsExportResult = {
  filePath: string
  sizeBytes: number
}

export type LibraryCsvExportResult = {
  filePath: string
  sizeBytes: number
  trackCount: number
}

export type PlaylistExportResult = {
  filePath: string
  trackCount: number
}

export type PlaylistImportResult = {
  playlist: Playlist
  addedCount: number
  skippedCount: number
  unmatchedCount: number
  sourcePath: string
}

export interface MusicAPI {
  selectFolders: () => Promise<string[]>
  selectAudioFiles: () => Promise<string[]>
  scanLibrary: (paths: string[]) => Promise<LibraryScanResult>
  importAudioFiles: (paths: string[]) => Promise<LibraryScanResult>
  getLibrarySourceInfo: (paths: string[]) => Promise<LibrarySourceInfo[]>
  getAllTracks: () => Promise<Track[]>
  searchTracks: (keyword: string) => Promise<Track[]>
  showTrackInFolder: (trackPath: string) => Promise<boolean>
  openTrackFile: (trackPath: string) => Promise<boolean>
  showLibrarySourceInFolder: (sourcePath: string) => Promise<boolean>
  openLibrarySourcePath: (sourcePath: string) => Promise<boolean>
  getAppStorageInfo: () => Promise<AppStorageInfo>
  openAppStorageFolder: () => Promise<boolean>
  backupDatabase: () => Promise<DatabaseBackupResult | null>
  checkDatabaseHealth: () => Promise<DatabaseHealthResult>
  optimizeDatabase: () => Promise<DatabaseOptimizeResult>
  cleanupArtworkCache: () => Promise<ArtworkCacheCleanupResult>
  exportDiagnosticsReport: () => Promise<DiagnosticsExportResult | null>
  exportLibraryCsv: () => Promise<LibraryCsvExportResult | null>
  setTrackFavorite: (trackId: string, isFavorite: boolean) => Promise<boolean>
  getLyrics: (lyricPath: string) => Promise<LyricLine[]>
  getRecentHistory: (limit?: number) => Promise<HistoryEntry[]>
  addHistoryEntry: (trackId: string) => Promise<HistoryEntry | null>
  clearHistory: () => Promise<number>
  removeHistoryEntry: (historyId: string) => Promise<number>
  removeTrackHistory: (trackId: string) => Promise<number>
  createPlaylist: (name: string) => Promise<Playlist>
  createPlaylistWithTracks: (
    name: string,
    trackIds: string[]
  ) => Promise<{ playlist: Playlist; addedCount: number; skippedCount: number }>
  getPlaylists: () => Promise<Playlist[]>
  getPlaylistById: (playlistId: string) => Promise<Playlist | null>
  getPlaylistTracks: (playlistId: string) => Promise<Track[]>
  renamePlaylist: (playlistId: string, name: string) => Promise<Playlist | null>
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>
  moveTrackInPlaylist: (playlistId: string, trackId: string, targetPosition: number) => Promise<boolean>
  refreshPlaylistCovers: () => Promise<{ checkedCount: number; changedCount: number }>
  exportPlaylistToM3u: (playlistId: string) => Promise<PlaylistExportResult | null>
  importPlaylistFromM3u: () => Promise<PlaylistImportResult | null>
  deletePlaylist: (playlistId: string) => Promise<boolean>
  getSettings: () => Promise<Record<string, unknown>>
  setSetting: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>
  updateDesktopPlaybackState: (state: DesktopPlaybackState) => Promise<void>
  onAppCommand: (listener: (command: AppCommand) => void) => () => void
  toFileUrl: (filePath: string) => string
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}
