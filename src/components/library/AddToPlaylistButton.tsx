import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlaylistStore } from '../../store/playlistStore'
import type { Track } from '../../types/track'

type AddToPlaylistButtonProps = {
  trackId: string
  track?: Track
}

export default function AddToPlaylistButton({ trackId, track }: AddToPlaylistButtonProps) {
  const navigate = useNavigate()
  const playlists = usePlaylistStore((state) => state.playlists)
  const loading = usePlaylistStore((state) => state.loading)
  const loadPlaylists = usePlaylistStore((state) => state.loadPlaylists)
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist)
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleDismiss = useCallback(() => {
    setOpen(false)
  }, [])

  useDismissableLayer({
    enabled: open,
    container: containerRef.current,
    onDismiss: handleDismiss
  })
  useMenuNavigation({
    enabled: open,
    container: containerRef.current
  })

  useEffect(() => {
    if (open && playlists.length === 0) {
      void loadPlaylists()
    }
  }, [loadPlaylists, open, playlists.length])

  const handleAddToPlaylist = async (playlistId: string) => {
    setBusy(true)

    try {
      const added = await addTrackToPlaylist(playlistId, trackId, track)
      const playlistName =
        playlists.find((playlist) => playlist.id === playlistId)?.name ?? 'this playlist'

      showFeedback(
        added
          ? `Added to ${playlistName}.`
          : `Already in ${playlistName}.`,
        added ? 'success' : 'muted',
        {
          label: 'Open Playlist',
          onAction: () => navigate(`/playlists/${playlistId}`)
        }
      )
      setOpen(false)
    } catch {
      showFeedback('Could not update the playlist right now.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCreatePlaylist = async () => {
    const trimmedName = draftName.trim()

    if (!trimmedName) {
      return
    }

    setBusy(true)

    try {
      const playlist = await createPlaylist(trimmedName)

      if (playlist) {
        const added = await addTrackToPlaylist(playlist.id, trackId, track)
        showFeedback(
          added
            ? `Created ${playlist.name} and added the track.`
            : `Created ${playlist.name}.`,
          'success',
          {
            label: 'Open Playlist',
            onAction: () => navigate(`/playlists/${playlist.id}`)
          }
        )
        setDraftName('')
        setOpen(false)
      } else {
        showFeedback('Could not create the playlist right now.', 'error')
      }
    } catch {
      showFeedback('Could not create the playlist right now.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
      >
        Playlist
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Add to playlist"
          className="absolute right-0 top-11 z-20 w-72 rounded-2xl border border-white/10 bg-slate-950/96 p-4 shadow-soft backdrop-blur-xl"
        >
          <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">Add To Playlist</div>

          <div className="grid max-h-40 gap-2 overflow-y-auto">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => void handleAddToPlaylist(playlist.id)}
                  disabled={busy}
                  data-menu-item
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="truncate">{playlist.name}</span>
                  <span className="ml-3 text-xs text-slate-400">{playlist.trackCount ?? 0}</span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                {loading ? 'Loading playlists...' : 'Create your first playlist below.'}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={80}
              placeholder="New playlist name"
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => void handleCreatePlaylist()}
              disabled={busy || !draftName.trim()}
              data-menu-item
              className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create and Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
