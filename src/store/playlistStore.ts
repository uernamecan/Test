import { create } from 'zustand'
import type { Playlist } from '../types/playlist'
import { musicApi } from '../services/api'
import type { Track } from '../types/track'

type PlaylistState = {
  playlists: Playlist[]
  selectedPlaylist: Playlist | null
  playlistTracks: Track[]
  loading: boolean
  error: string | null
  loadPlaylists: () => Promise<void>
  loadPlaylistDetails: (playlistId: string) => Promise<void>
  createPlaylist: (name: string) => Promise<Playlist | null>
  createPlaylistFromTracks: (
    name: string,
    tracks: Track[]
  ) => Promise<{ playlist: Playlist; addedCount: number; skippedCount: number } | null>
  renamePlaylist: (playlistId: string, name: string) => Promise<Playlist | null>
  addTrackToPlaylist: (playlistId: string, trackId: string, track?: Track) => Promise<boolean>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>
  moveTrackInPlaylist: (playlistId: string, trackId: string, targetPosition: number) => Promise<boolean>
  refreshPlaylistCovers: () => Promise<{ checkedCount: number; changedCount: number } | null>
  deletePlaylist: (playlistId: string) => Promise<boolean>
  syncTrackFavorite: (trackId: string, isFavorite: boolean) => void
  syncTracksWithLibrary: (tracks: Track[]) => void
}

function getPlaylistCoverFromTracks(tracks: Track[]) {
  return tracks.find((track) => track.coverPath)?.coverPath
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  selectedPlaylist: null,
  playlistTracks: [],
  loading: false,
  error: null,
  loadPlaylists: async () => {
    set({ loading: true, error: null })

    try {
      const playlists = await musicApi.getPlaylists()
      set({ playlists, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load playlists.'
      })
    }
  },
  loadPlaylistDetails: async (playlistId) => {
    set({ loading: true, error: null })

    try {
      const [selectedPlaylist, playlistTracks] = await Promise.all([
        musicApi.getPlaylistById(playlistId),
        musicApi.getPlaylistTracks(playlistId)
      ])

      set({
        selectedPlaylist,
        playlistTracks,
        loading: false
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load playlist details.'
      })
    }
  },
  createPlaylist: async (name) => {
    set({ loading: true, error: null })

    try {
      const playlist = await musicApi.createPlaylist(name)
      await get().loadPlaylists()
      return playlist
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create playlist.'
      })
      return null
    }
  },
  createPlaylistFromTracks: async (name, tracks) => {
    set({ loading: true, error: null })

    try {
      const result = await musicApi.createPlaylistWithTracks(
        name,
        tracks.map((track) => track.id)
      )
      await get().loadPlaylists()
      return result
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save queue as playlist.'
      })
      return null
    }
  },
  renamePlaylist: async (playlistId, name) => {
    set({ loading: true, error: null })

    try {
      const playlist = await musicApi.renamePlaylist(playlistId, name)
      await get().loadPlaylists()

      if (playlist) {
        set({ selectedPlaylist: playlist, loading: false })
      }

      return playlist
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to rename playlist.'
      })
      return null
    }
  },
  addTrackToPlaylist: async (playlistId, trackId, track) => {
    const previousTracks = get().playlistTracks
    const previousPlaylist = get().selectedPlaylist

    try {
      set({ error: null })
      const shouldOptimisticallyAdd =
        Boolean(track) &&
        get().selectedPlaylist?.id === playlistId &&
        !previousTracks.some((playlistTrack) => playlistTrack.id === trackId)

      if (shouldOptimisticallyAdd && track) {
        const nextTracks = [...previousTracks, track]
        const updatedAt = new Date().toISOString()

        set((state) => ({
          playlistTracks: nextTracks,
          selectedPlaylist: state.selectedPlaylist
            ? {
                ...state.selectedPlaylist,
                coverPath: getPlaylistCoverFromTracks(nextTracks),
                trackCount: nextTracks.length,
                updatedAt
              }
            : state.selectedPlaylist
        }))
      }

      const added = await musicApi.addTrackToPlaylist(playlistId, trackId)

      if (added) {
        await get().loadPlaylists()
      }

      if (get().selectedPlaylist?.id === playlistId && !shouldOptimisticallyAdd) {
        await get().loadPlaylistDetails(playlistId)
      }

      return added
    } catch (error) {
      set({
        playlistTracks: previousTracks,
        selectedPlaylist: previousPlaylist,
        error: error instanceof Error ? error.message : 'Failed to add track to playlist.'
      })
      return false
    }
  },
  removeTrackFromPlaylist: async (playlistId, trackId) => {
    const previousTracks = get().playlistTracks
    const previousPlaylist = get().selectedPlaylist

    try {
      set({ error: null })
      const nextTracks = previousTracks.filter((track) => track.id !== trackId)
      const updatedAt = new Date().toISOString()

      if (get().selectedPlaylist?.id === playlistId) {
        set((state) => ({
          playlistTracks: nextTracks,
          selectedPlaylist: state.selectedPlaylist
            ? {
                ...state.selectedPlaylist,
                coverPath: getPlaylistCoverFromTracks(nextTracks),
                trackCount: nextTracks.length,
                updatedAt
              }
            : state.selectedPlaylist
        }))
      }

      await musicApi.removeTrackFromPlaylist(playlistId, trackId)
      await get().loadPlaylists()

      return true
    } catch (error) {
      set({
        playlistTracks: previousTracks,
        selectedPlaylist: previousPlaylist,
        error: error instanceof Error ? error.message : 'Failed to remove track from playlist.'
      })
      return false
    }
  },
  moveTrackInPlaylist: async (playlistId, trackId, targetPosition) => {
    const previousTracks = get().playlistTracks
    const previousPlaylist = get().selectedPlaylist

    try {
      set({ error: null })
      const currentIndex = previousTracks.findIndex((track) => track.id === trackId)

      if (currentIndex < 0) {
        return false
      }

      const safeTargetPosition = Math.min(Math.max(targetPosition, 0), previousTracks.length - 1)

      if (currentIndex === safeTargetPosition) {
        return true
      }

      const nextTracks = [...previousTracks]
      const [movedTrack] = nextTracks.splice(currentIndex, 1)
      nextTracks.splice(safeTargetPosition, 0, movedTrack)
      const updatedAt = new Date().toISOString()
      set((state) => ({
        playlistTracks: nextTracks,
        selectedPlaylist:
          state.selectedPlaylist?.id === playlistId
            ? {
                ...state.selectedPlaylist,
                coverPath: getPlaylistCoverFromTracks(nextTracks),
                updatedAt
              }
            : state.selectedPlaylist
      }))

      const moved = await musicApi.moveTrackInPlaylist(playlistId, trackId, targetPosition)

      if (moved) {
        await get().loadPlaylists()
      } else {
        set({
          playlistTracks: previousTracks,
          selectedPlaylist: previousPlaylist
        })
      }

      return moved
    } catch (error) {
      set({
        playlistTracks: previousTracks,
        selectedPlaylist: previousPlaylist,
        error: error instanceof Error ? error.message : 'Failed to move playlist track.'
      })
      return false
    }
  },
  refreshPlaylistCovers: async () => {
    set({ loading: true, error: null })

    try {
      const result = await musicApi.refreshPlaylistCovers()
      await get().loadPlaylists()

      const selectedPlaylistId = get().selectedPlaylist?.id

      if (selectedPlaylistId) {
        await get().loadPlaylistDetails(selectedPlaylistId)
      }

      return result
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh playlist covers.'
      })
      return null
    }
  },
  deletePlaylist: async (playlistId) => {
    set({ loading: true, error: null })

    try {
      await musicApi.deletePlaylist(playlistId)
      const shouldClearSelection = get().selectedPlaylist?.id === playlistId
      await get().loadPlaylists()

      if (shouldClearSelection) {
        set({
          selectedPlaylist: null,
          playlistTracks: [],
          loading: false
        })
      }
      return true
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete playlist.'
      })
      return false
    }
  },
  syncTrackFavorite: (trackId, isFavorite) => {
    set((state) => ({
      playlistTracks: state.playlistTracks.map((track) =>
        track.id === trackId ? { ...track, isFavorite } : track
      )
    }))
  },
  syncTracksWithLibrary: (tracks) => {
    set((state) => {
      if (state.playlistTracks.length === 0) {
        return state
      }

      const latestTrackMap = new Map(tracks.map((track) => [track.id, track]))
      const nextTracks = state.playlistTracks
        .map((track) => latestTrackMap.get(track.id))
        .filter((track): track is Track => Boolean(track))

      return {
        playlistTracks: nextTracks,
        selectedPlaylist: state.selectedPlaylist
          ? {
              ...state.selectedPlaylist,
              coverPath: getPlaylistCoverFromTracks(nextTracks),
              trackCount: nextTracks.length
            }
          : state.selectedPlaylist
      }
    })
  }
}))
