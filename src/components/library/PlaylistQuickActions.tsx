import { useCallback, useRef, useState } from 'react'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { musicApi } from '../../services/api'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import type { Track } from '../../types/track'

type PlaylistQuickActionsProps = {
  playlistId: string
  playlistName: string
}

function shuffleTracks(tracks: Track[]) {
  const nextTracks = [...tracks]

  for (let index = nextTracks.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[nextTracks[index], nextTracks[swapIndex]] = [nextTracks[swapIndex], nextTracks[index]]
  }

  return nextTracks
}

export default function PlaylistQuickActions({
  playlistId,
  playlistName
}: PlaylistQuickActionsProps) {
  const playSelection = usePlayerStore((state) => state.playSelection)
  const enqueueTracks = usePlayerStore((state) => state.enqueueTracks)
  const setQueueVisible = useUiStore((state) => state.setQueueVisible)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<'play' | 'shuffle' | 'queue' | null>(null)
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

  const loadPlaylistTracks = async () => {
    const tracks = await musicApi.getPlaylistTracks(playlistId)

    if (tracks.length === 0) {
      showFeedback(`Playlist ${playlistName} is empty.`, 'muted')
      return null
    }

    return tracks
  }

  const handlePlay = async (shuffle = false) => {
    if (busyAction) {
      return
    }

    setBusyAction(shuffle ? 'shuffle' : 'play')

    try {
      const tracks = await loadPlaylistTracks()

      if (!tracks) {
        return
      }

      const nextTracks = shuffle ? shuffleTracks(tracks) : tracks
      const nextTrack = playSelection(nextTracks, 0)

      if (!nextTrack) {
        return
      }

      const started = await playTrackCommand(nextTrack)

      if (started) {
        showFeedback(
          shuffle ? `Shuffled ${playlistName}.` : `Playing ${playlistName}.`,
          'success',
          null,
          {
            detail: `${nextTracks.length} track${nextTracks.length === 1 ? '' : 's'} loaded from this playlist.`
          }
        )
        setOpen(false)
      }
    } catch {
      showFeedback(`Could not open ${playlistName} right now.`, 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleQueue = async () => {
    if (busyAction) {
      return
    }

    setBusyAction('queue')

    try {
      const tracks = await loadPlaylistTracks()

      if (!tracks) {
        return
      }

      const result = enqueueTracks(tracks, 'last')

      if (!result) {
        showFeedback('Everything is already in the queue.', 'muted')
        return
      }

      setQueueVisible(true)
      showFeedback(
        `Added ${result.addedCount} track${result.addedCount === 1 ? '' : 's'} from ${playlistName}.`,
        'success',
        {
          label: 'Open Queue',
          onAction: () => setQueueVisible(true)
        },
        {
          detail:
            result.skippedCount > 0
              ? `${result.skippedCount} track${result.skippedCount === 1 ? '' : 's'} were already queued.`
              : 'The playlist was appended to the current queue.'
        }
      )
      setOpen(false)
    } catch {
      showFeedback(`Could not queue ${playlistName} right now.`, 'error')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10"
      >
        More
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Actions for playlist ${playlistName}`}
          className="absolute right-0 top-10 z-20 w-52 rounded-2xl border border-white/10 bg-slate-950/96 p-2 shadow-soft backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => void handlePlay(false)}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Play Playlist</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'play' ? 'Loading' : 'Play'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handlePlay(true)}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Shuffle Playlist</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'shuffle' ? 'Mixing' : 'Mix'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleQueue()}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Queue Playlist</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'queue' ? 'Adding' : 'Queue'}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
