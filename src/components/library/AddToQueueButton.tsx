import { useCallback, useRef, useState } from 'react'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { playNowCommand, queueLastCommand, queueNextCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useUiStore } from '../../store/uiStore'
import type { Track } from '../../types/track'

type AddToQueueButtonProps = {
  tracks: Track | Track[]
  compact?: boolean
}

export default function AddToQueueButton({
  tracks,
  compact = false
}: AddToQueueButtonProps) {
  const setQueueVisible = useUiStore((state) => state.setQueueVisible)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<'now' | 'next' | 'last' | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const trackList = Array.isArray(tracks) ? tracks : [tracks]
  const handleDismiss = useCallback(() => {
    setOpen(false)
  }, [])
  const queueToastAction = {
    label: 'Open Queue',
    onAction: () => setQueueVisible(true)
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

  const buildQueueMessage = (addedCount: number, skippedCount: number, position: 'now' | 'next' | 'last') => {
    if (addedCount === 0) {
      return {
        message: 'Everything is already in the queue.',
        tone: 'muted' as const
      }
    }

    const label =
      addedCount === 1 ? '1 track' : `${addedCount} tracks`

    if (position === 'now') {
      return {
        message:
          skippedCount > 0
            ? `Playing now, kept ${skippedCount} already queued.`
            : `Playing now and queued ${label}.`,
        tone: 'success' as const
      }
    }

    if (position === 'next') {
      return {
        message:
          skippedCount > 0
            ? `Queued ${label} next, skipped ${skippedCount} already there.`
            : `Queued ${label} next.`,
        tone: 'success' as const
      }
    }

    return {
      message:
        skippedCount > 0
          ? `Added ${label} to the end, skipped ${skippedCount} already there.`
          : `Added ${label} to the end.`,
      tone: 'success' as const
    }
  }

  const handleQueue = async (position: 'now' | 'next' | 'last') => {
    if (trackList.length === 0 || busyAction) {
      return
    }

    setBusyAction(position)

    try {
      if (position === 'now') {
        const result = await playNowCommand(trackList)

        if (result.track) {
          showFeedback(`Playing ${result.track.title} now.`, 'success', queueToastAction, {
            detail:
              result.skippedCount > 0
                ? `${result.skippedCount} track${result.skippedCount === 1 ? '' : 's'} were already queued.`
                : `${result.addedCount} track${result.addedCount === 1 ? '' : 's'} ready in the active queue.`
          })
        } else if (result.reason === 'already-queued') {
          showFeedback('Everything is already in the queue.', 'muted')
        } else if (result.reason === 'empty') {
          showFeedback('No tracks were selected.', 'muted')
          return
        } else {
          return
        }
      } else if (position === 'next') {
        const result = queueNextCommand(trackList)
        const feedback = result
          ? buildQueueMessage(result.addedCount, result.skippedCount, position)
          : { message: 'Everything is already in the queue.', tone: 'muted' as const }
        showFeedback(feedback.message, feedback.tone, result ? queueToastAction : null)
      } else {
        const result = queueLastCommand(trackList)
        const feedback = result
          ? buildQueueMessage(result.addedCount, result.skippedCount, position)
          : { message: 'Everything is already in the queue.', tone: 'muted' as const }
        showFeedback(feedback.message, feedback.tone, result ? queueToastAction : null)
      }

      setQueueVisible(true)
      setOpen(false)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={trackList.length === 0}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {compact ? 'Queue' : 'Add to Queue'}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Queue actions"
          className="absolute right-0 top-11 z-20 w-48 rounded-2xl border border-white/10 bg-slate-950/96 p-2 shadow-soft backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => void handleQueue('now')}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Play Now</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'now' ? 'Starting' : 'Now'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleQueue('next')}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Play Next</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'next' ? 'Adding' : 'Next'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleQueue('last')}
            disabled={busyAction !== null}
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Add to End</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {busyAction === 'last' ? 'Adding' : `${trackList.length}`}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
