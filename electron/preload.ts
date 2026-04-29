import { contextBridge, ipcRenderer } from 'electron'
import { pathToFileURL } from 'node:url'
import type { AppCommand, MusicAPI } from './types/ipc'

const api: MusicAPI = {
  selectFolders: () => ipcRenderer.invoke('music:selectFolders'),
  scanLibrary: (paths) => ipcRenderer.invoke('music:scanLibrary', paths),
  getAllTracks: () => ipcRenderer.invoke('music:getAllTracks'),
  searchTracks: (keyword) => ipcRenderer.invoke('music:searchTracks', keyword),
  showTrackInFolder: (trackPath) => ipcRenderer.invoke('music:showTrackInFolder', trackPath),
  openTrackFile: (trackPath) => ipcRenderer.invoke('music:openTrackFile', trackPath),
  setTrackFavorite: (trackId, isFavorite) =>
    ipcRenderer.invoke('music:setTrackFavorite', { trackId, isFavorite }),
  getLyrics: (lyricPath) => ipcRenderer.invoke('music:getLyrics', lyricPath),
  getRecentHistory: (limit) => ipcRenderer.invoke('history:getRecent', limit),
  addHistoryEntry: (trackId) => ipcRenderer.invoke('history:addEntry', trackId),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistoryEntry: (historyId) => ipcRenderer.invoke('history:removeEntry', historyId),
  createPlaylist: (name) => ipcRenderer.invoke('playlist:create', name),
  createPlaylistWithTracks: (name, trackIds) =>
    ipcRenderer.invoke('playlist:createWithTracks', { name, trackIds }),
  getPlaylists: () => ipcRenderer.invoke('playlist:getAll'),
  getPlaylistById: (playlistId) => ipcRenderer.invoke('playlist:getById', playlistId),
  getPlaylistTracks: (playlistId) => ipcRenderer.invoke('playlist:getTracks', playlistId),
  renamePlaylist: (playlistId, name) => ipcRenderer.invoke('playlist:rename', { playlistId, name }),
  addTrackToPlaylist: (playlistId, trackId) =>
    ipcRenderer.invoke('playlist:addTrack', { playlistId, trackId }),
  removeTrackFromPlaylist: (playlistId, trackId) =>
    ipcRenderer.invoke('playlist:removeTrack', { playlistId, trackId }),
  moveTrackInPlaylist: (playlistId, trackId, targetPosition) =>
    ipcRenderer.invoke('playlist:moveTrack', { playlistId, trackId, targetPosition }),
  refreshPlaylistCovers: () => ipcRenderer.invoke('playlist:refreshCovers'),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('playlist:delete', playlistId),
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  updateDesktopPlaybackState: (state) =>
    ipcRenderer.invoke('desktop:updatePlaybackState', state),
  onAppCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: AppCommand) => {
      listener(command)
    }

    ipcRenderer.on('app:command', handler)

    return () => {
      ipcRenderer.removeListener('app:command', handler)
    }
  },
  toFileUrl: (filePath) => pathToFileURL(filePath).href,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
}

contextBridge.exposeInMainWorld('musicAPI', api)
