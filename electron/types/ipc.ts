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
  }
}

export interface MusicAPI {
  selectFolders: () => Promise<string[]>
  scanLibrary: (paths: string[]) => Promise<LibraryScanResult>
  getAllTracks: () => Promise<Track[]>
  searchTracks: (keyword: string) => Promise<Track[]>
  showTrackInFolder: (trackPath: string) => Promise<boolean>
  openTrackFile: (trackPath: string) => Promise<boolean>
  setTrackFavorite: (trackId: string, isFavorite: boolean) => Promise<boolean>
  getLyrics: (lyricPath: string) => Promise<LyricLine[]>
  getRecentHistory: (limit?: number) => Promise<HistoryEntry[]>
  addHistoryEntry: (trackId: string) => Promise<HistoryEntry | null>
  clearHistory: () => Promise<number>
  removeHistoryEntry: (historyId: string) => Promise<number>
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
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  moveTrackInPlaylist: (playlistId: string, trackId: string, targetPosition: number) => Promise<boolean>
  refreshPlaylistCovers: () => Promise<{ checkedCount: number; changedCount: number }>
  deletePlaylist: (playlistId: string) => Promise<void>
  getSettings: () => Promise<Record<string, unknown>>
  setSetting: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>
  updateDesktopPlaybackState: (state: DesktopPlaybackState) => Promise<void>
  onAppCommand: (listener: (command: AppCommand) => void) => () => void
  toFileUrl: (filePath: string) => string
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}
