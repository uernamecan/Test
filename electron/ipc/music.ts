import { dialog, ipcMain, shell } from 'electron'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { setTrackFavorite } from '../db/repositories/favoritesRepo'
import {
  addTrackToPlaylist,
  createPlaylist,
  createPlaylistWithTracks,
  deletePlaylist,
  getPlaylistById,
  getPlaylists,
  getPlaylistTracks,
  moveTrackInPlaylist,
  refreshAllPlaylistCovers,
  renamePlaylist,
  removeTrackFromPlaylist
} from '../db/repositories/playlistsRepo'
import {
  addHistoryEntry,
  clearHistory,
  getRecentHistory,
  removeHistoryEntry
} from '../db/repositories/historyRepo'
import { getAllTracks, searchTracks } from '../db/repositories/tracksRepo'
import { syncLibrary } from '../services/library'
import { parseLyricsFile } from '../services/lyrics'

const folderPathsSchema = z.array(z.string().min(1)).max(50)
const playlistNameSchema = z.string().trim().min(1).max(80)
const keywordSchema = z.string().trim()
const filePathSchema = z.string().trim().min(1).max(4096)
const playlistIdSchema = z.string().trim().min(1)
const trackIdSchema = z.string().trim().min(1)
const playlistTrackPayloadSchema = z.object({
  playlistId: z.string().min(1),
  trackId: z.string().min(1)
})
const playlistWithTracksPayloadSchema = z.object({
  name: playlistNameSchema,
  trackIds: z.array(trackIdSchema).max(10000)
})
const playlistTrackMovePayloadSchema = playlistTrackPayloadSchema.extend({
  targetPosition: z.number().int().min(0)
})
const historyIdSchema = z.string().trim().min(1)
const favoritePayloadSchema = z.object({
  trackId: z.string().trim().min(1),
  isFavorite: z.boolean()
})
const lyricPathSchema = filePathSchema.refine(
  (filePath) => path.extname(filePath).toLowerCase() === '.lrc',
  'Lyrics must be loaded from a .lrc file.'
)
const historyLimitSchema = z.number().int().min(1).max(50)

function parseExistingFilePath(filePath: unknown) {
  const parsedPath = filePathSchema.parse(filePath)

  if (!existsSync(parsedPath)) {
    throw new Error('The requested file no longer exists on disk.')
  }

  if (!statSync(parsedPath).isFile()) {
    throw new Error('The requested path is not a file.')
  }

  return parsedPath
}

function parseExistingLyricPath(filePath: unknown) {
  return lyricPathSchema.parse(parseExistingFilePath(filePath))
}

export function registerMusicIpcHandlers() {
  ipcMain.handle('music:selectFolders', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select music folders'
    })

    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('music:scanLibrary', async (_event, paths) => {
    const folderPaths = folderPathsSchema.parse(paths)
    return syncLibrary(folderPaths)
  })

  ipcMain.handle('music:getAllTracks', async () => {
    return getAllTracks()
  })

  ipcMain.handle('music:searchTracks', async (_event, keyword) => {
    return searchTracks(keywordSchema.parse(keyword))
  })

  ipcMain.handle('music:showTrackInFolder', async (_event, trackPath) => {
    shell.showItemInFolder(parseExistingFilePath(trackPath))
    return true
  })

  ipcMain.handle('music:openTrackFile', async (_event, trackPath) => {
    const errorMessage = await shell.openPath(parseExistingFilePath(trackPath))

    if (errorMessage) {
      throw new Error(errorMessage)
    }

    return true
  })

  ipcMain.handle('music:setTrackFavorite', async (_event, payload) => {
    const parsedPayload = favoritePayloadSchema.parse(payload)
    return setTrackFavorite(parsedPayload.trackId, parsedPayload.isFavorite)
  })

  ipcMain.handle('music:getLyrics', async (_event, lyricPath) => {
    return parseLyricsFile(parseExistingLyricPath(lyricPath))
  })

  ipcMain.handle('history:getRecent', async (_event, limit) => {
    const parsedLimit = typeof limit === 'number' ? historyLimitSchema.parse(limit) : 10
    return getRecentHistory(parsedLimit)
  })

  ipcMain.handle('history:addEntry', async (_event, trackId) => {
    return addHistoryEntry(trackIdSchema.parse(trackId))
  })

  ipcMain.handle('history:clear', async () => {
    return clearHistory()
  })

  ipcMain.handle('history:removeEntry', async (_event, historyId) => {
    return removeHistoryEntry(historyIdSchema.parse(historyId))
  })

  ipcMain.handle('playlist:create', async (_event, name) => {
    return createPlaylist(playlistNameSchema.parse(name))
  })

  ipcMain.handle('playlist:createWithTracks', async (_event, payload) => {
    const parsedPayload = playlistWithTracksPayloadSchema.parse(payload)
    return createPlaylistWithTracks(parsedPayload.name, parsedPayload.trackIds)
  })

  ipcMain.handle('playlist:getAll', async () => {
    return getPlaylists()
  })

  ipcMain.handle('playlist:getById', async (_event, playlistId) => {
    return getPlaylistById(playlistIdSchema.parse(playlistId))
  })

  ipcMain.handle('playlist:getTracks', async (_event, playlistId) => {
    return getPlaylistTracks(playlistIdSchema.parse(playlistId))
  })

  ipcMain.handle('playlist:addTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackPayloadSchema.parse(payload)
    return addTrackToPlaylist(parsedPayload.playlistId, parsedPayload.trackId)
  })

  ipcMain.handle('playlist:rename', async (_event, payload) => {
    const parsedPayload = z
      .object({
        playlistId: playlistIdSchema,
        name: playlistNameSchema
      })
      .parse(payload)

    return renamePlaylist(parsedPayload.playlistId, parsedPayload.name)
  })

  ipcMain.handle('playlist:removeTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackPayloadSchema.parse(payload)
    removeTrackFromPlaylist(parsedPayload.playlistId, parsedPayload.trackId)
  })

  ipcMain.handle('playlist:moveTrack', async (_event, payload) => {
    const parsedPayload = playlistTrackMovePayloadSchema.parse(payload)
    return moveTrackInPlaylist(
      parsedPayload.playlistId,
      parsedPayload.trackId,
      parsedPayload.targetPosition
    )
  })

  ipcMain.handle('playlist:refreshCovers', async () => {
    return refreshAllPlaylistCovers()
  })

  ipcMain.handle('playlist:delete', async (_event, playlistId) => {
    deletePlaylist(playlistIdSchema.parse(playlistId))
  })
}
