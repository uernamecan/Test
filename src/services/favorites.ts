import { musicApi } from './api'
import { useHistoryStore } from '../store/historyStore'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { usePlaylistStore } from '../store/playlistStore'

function syncTrackFavorite(trackId: string, isFavorite: boolean) {
  useLibraryStore.getState().syncTrackFavorite(trackId, isFavorite)
  usePlaylistStore.getState().syncTrackFavorite(trackId, isFavorite)
  usePlayerStore.getState().syncTrackFavorite(trackId, isFavorite)
  useHistoryStore.getState().syncTrackFavorite(trackId, isFavorite)
}

export async function setTrackFavorite(trackId: string, isFavorite: boolean) {
  await musicApi.setTrackFavorite(trackId, isFavorite)
  syncTrackFavorite(trackId, isFavorite)
}
