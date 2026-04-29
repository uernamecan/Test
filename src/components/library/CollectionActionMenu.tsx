import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlayerStore } from '../../store/playerStore'
import type { Track } from '../../types/track'
import AddToQueueButton from './AddToQueueButton'

type CollectionActionMenuProps = {
  title: string
  tracks: Track[]
  detailHref: string
  detailLabel: string
}

export default function CollectionActionMenu({
  title,
  tracks,
  detailHref,
  detailLabel
}: CollectionActionMenuProps) {
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<'play' | 'shuffle' | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleDismiss = useCallback(() => {
    setOpen(false)
  }, [])

  const handlePlayCollection = async (shuffle = false) => {
    if (tracks.length === 0 || busyAction) {
      return
    }

    setBusyAction(shuffle ? 'shuffle' : 'play')

    try {
      const nextQueue = shuffle ? [...tracks] : tracks

      if (shuffle) {
        for (let index = nextQueue.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1))
          ;[nextQueue[index], nextQueue[swapIndex]] = [nextQueue[swapIndex], nextQueue[index]]
        }
      }

      const nextTrack = playSelection(nextQueue, 0)

      if (!nextTrack) {
        showFeedback('Nothing in this collection is ready to play yet.', 'muted')
        return
      }

      const started = await playTrackCommand(nextTrack)

      if (started) {
        showFeedback(
          shuffle ? `Shuffled ${title}.` : `Playing ${title}.`,
          'success',
          null,
          {
            detail: `${nextQueue.length} track${nextQueue.length === 1 ? '' : 's'} ready in the active queue.`
          }
        )
        setOpen(false)
      }
    } finally {
      setBusyAction(null)
    }
  }

  useDismissableLayer({
    enabled: open,
    container: containerRef.current,
    onDismiss: handleDismiss
  })
  useMenuNavigation({
    enabled: open,
    container: containerRef.current
  })

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
      >
        Actions
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${title}`}
          className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-white/10 bg-slate-950/96 p-3 shadow-soft backdrop-blur-xl"
        >
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => void handlePlayCollection(false)}
              disabled={busyAction !== null}
              data-menu-item
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Play Collection</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {busyAction === 'play' ? 'Starting' : `${tracks.length}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handlePlayCollection(true)}
              disabled={busyAction !== null}
              data-menu-item
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Shuffle Collection</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {busyAction === 'shuffle' ? 'Shuffling' : 'Mix'}
              </span>
            </button>
            <Link
              to={detailHref}
              onClick={() => setOpen(false)}
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              {detailLabel}
            </Link>
            <div data-menu-item>
              <AddToQueueButton tracks={tracks} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
