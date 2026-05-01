import { useNavigate } from 'react-router-dom'
import { useFeedbackStore } from '../store/feedbackStore'
import { usePlaylistStore } from '../store/playlistStore'
import type { Track } from '../types/track'

const MAX_PLAYLIST_NAME_LENGTH = 80

type SaveTracksAsPlaylistOptions = {
  tracks: Track[]
  defaultName: string
  promptMessage: string
  emptyMessage: string
  failureMessage: string
  onOpenPlaylist?: (playlistId: string) => void
}

export function useSaveTracksAsPlaylist() {
  const navigate = useNavigate()
  const createPlaylistFromTracks = usePlaylistStore((state) => state.createPlaylistFromTracks)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)

  return async ({
    tracks,
    defaultName,
    promptMessage,
    emptyMessage,
    failureMessage,
    onOpenPlaylist
  }: SaveTracksAsPlaylistOptions) => {
    if (tracks.length === 0) {
      showFeedback(emptyMessage, 'muted')
      return null
    }

    const playlistName = window
      .prompt(promptMessage, defaultName.trim().slice(0, MAX_PLAYLIST_NAME_LENGTH))
      ?.trim()

    if (!playlistName) {
      return null
    }

    if (playlistName.length > MAX_PLAYLIST_NAME_LENGTH) {
      showFeedback(`Playlist names can be up to ${MAX_PLAYLIST_NAME_LENGTH} characters.`, 'muted')
      return null
    }

    const result = await createPlaylistFromTracks(playlistName, tracks)

    if (!result) {
      showFeedback(failureMessage, 'error', null, {
        detail: usePlaylistStore.getState().error
      })
      return null
    }

    const renamedDetail =
      result.playlist.name !== playlistName
        ? ` Saved as "${result.playlist.name}" after normalizing the name or avoiding a duplicate.`
        : ''

    showFeedback(`Saved ${result.playlist.name}.`, 'success', {
      label: 'Open Playlist',
      onAction: () => {
        if (onOpenPlaylist) {
          onOpenPlaylist(result.playlist.id)
          return
        }

        navigate(`/playlists/${result.playlist.id}`)
      }
    }, {
      detail: `${result.addedCount} track${result.addedCount === 1 ? '' : 's'} added${
        result.skippedCount > 0 ? `, ${result.skippedCount} duplicate skipped` : ''
      }.${renamedDetail}`
    })

    return result
  }
}
