import type { Playlist } from '../types/playlist'
import type { LyricLine } from '../types/lyrics'
import type { HistoryEntry } from '../types/history'
import type { AppSettings } from '../types/settings'
import type { Track } from '../types/track'
import type { AppCommand, DesktopPlaybackState } from '../../electron/types/ipc'

function getMusicApi() {
  if (typeof window === 'undefined' || !window.musicAPI) {
    throw new Error('musicAPI is not available outside the Electron renderer process.')
  }

  return window.musicAPI
}

export const musicApi = {
  selectFolders() {
    return getMusicApi().selectFolders()
  },
  scanLibrary(paths: string[]) {
    return getMusicApi().scanLibrary(paths)
  },
  getAllTracks() {
    return getMusicApi().getAllTracks()
  },
  searchTracks(keyword: string) {
    return getMusicApi().searchTracks(keyword)
  },
  showTrackInFolder(trackPath: string) {
    return getMusicApi().showTrackInFolder(trackPath)
  },
  openTrackFile(trackPath: string) {
    return getMusicApi().openTrackFile(trackPath)
  },
  setTrackFavorite(trackId: string, isFavorite: boolean) {
    return getMusicApi().setTrackFavorite(trackId, isFavorite)
  },
  getLyrics(lyricPath: string) {
    return getMusicApi().getLyrics(lyricPath)
  },
  getRecentHistory(limit?: number) {
    return getMusicApi().getRecentHistory(limit)
  },
  addHistoryEntry(trackId: string) {
    return getMusicApi().addHistoryEntry(trackId)
  },
  clearHistory() {
    return getMusicApi().clearHistory()
  },
  removeHistoryEntry(historyId: string) {
    return getMusicApi().removeHistoryEntry(historyId)
  },
  createPlaylist(name: string) {
    return getMusicApi().createPlaylist(name)
  },
  createPlaylistWithTracks(name: string, trackIds: string[]) {
    return getMusicApi().createPlaylistWithTracks(name, trackIds)
  },
  getPlaylists() {
    return getMusicApi().getPlaylists()
  },
  getPlaylistById(playlistId: string) {
    return getMusicApi().getPlaylistById(playlistId)
  },
  getPlaylistTracks(playlistId: string) {
    return getMusicApi().getPlaylistTracks(playlistId)
  },
  renamePlaylist(playlistId: string, name: string) {
    return getMusicApi().renamePlaylist(playlistId, name)
  },
  addTrackToPlaylist(playlistId: string, trackId: string) {
    return getMusicApi().addTrackToPlaylist(playlistId, trackId)
  },
  removeTrackFromPlaylist(playlistId: string, trackId: string) {
    return getMusicApi().removeTrackFromPlaylist(playlistId, trackId)
  },
  moveTrackInPlaylist(playlistId: string, trackId: string, targetPosition: number) {
    return getMusicApi().moveTrackInPlaylist(playlistId, trackId, targetPosition)
  },
  refreshPlaylistCovers() {
    return getMusicApi().refreshPlaylistCovers()
  },
  deletePlaylist(playlistId: string) {
    return getMusicApi().deletePlaylist(playlistId)
  },
  getSettings() {
    return getMusicApi().getSettings()
  },
  setSetting<Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) {
    return getMusicApi().setSetting(key, value)
  },
  updateDesktopPlaybackState(state: DesktopPlaybackState) {
    return getMusicApi().updateDesktopPlaybackState(state)
  },
  onAppCommand(listener: (command: AppCommand) => void) {
    return getMusicApi().onAppCommand(listener)
  },
  toFileUrl(filePath: string) {
    return getMusicApi().toFileUrl(filePath)
  },
  minimizeWindow() {
    return getMusicApi().minimizeWindow()
  },
  toggleMaximizeWindow() {
    return getMusicApi().toggleMaximizeWindow()
  },
  closeWindow() {
    return getMusicApi().closeWindow()
  }
}

export type MusicApi = typeof musicApi
export type { HistoryEntry, LyricLine, Playlist, Track }
