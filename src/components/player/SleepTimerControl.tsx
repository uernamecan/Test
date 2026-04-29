import { useEffect, useMemo, useRef, useState } from 'react'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { usePlayerStore } from '../../store/playerStore'
import { useSleepTimerStore } from '../../store/sleepTimerStore'

const PRESET_MINUTES = [15, 30, 45, 60]

function formatCountdown(deadlineAt: number, now: number) {
  const remainingMs = Math.max(0, deadlineAt - now)
  const remainingMinutes = Math.ceil(remainingMs / 60000)

  if (remainingMinutes <= 1) {
    return '<1m left'
  }

  if (remainingMinutes < 60) {
    return `${remainingMinutes}m left`
  }

  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60

  return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`
}

export default function SleepTimerControl() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const mode = useSleepTimerStore((state) => state.mode)
  const deadlineAt = useSleepTimerStore((state) => state.deadlineAt)
  const targetTrackId = useSleepTimerStore((state) => state.targetTrackId)
  const setSleepTimerMinutes = useSleepTimerStore((state) => state.setSleepTimerMinutes)
  const setSleepTimerAfterTrack = useSleepTimerStore((state) => state.setSleepTimerAfterTrack)
  const clearSleepTimer = useSleepTimerStore((state) => state.clearSleepTimer)
  const [isOpen, setIsOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const containerRef = useRef<HTMLDivElement | null>(null)

  useDismissableLayer({
    enabled: isOpen,
    container: containerRef.current,
    onDismiss: () => setIsOpen(false)
  })
  useMenuNavigation({
    enabled: isOpen,
    container: containerRef.current
  })

  useEffect(() => {
    if (mode !== 'minutes' || !deadlineAt) {
      setNow(Date.now())
      return
    }

    setNow(Date.now())
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [deadlineAt, mode])

  const buttonLabel = useMemo(() => {
    if (mode === 'track-end') {
      return 'After Track'
    }

    if (mode === 'minutes' && deadlineAt) {
      return formatCountdown(deadlineAt, now)
    }

    return 'Sleep'
  }, [deadlineAt, mode, now])

  const detailLabel = useMemo(() => {
    if (mode === 'track-end') {
      if (currentTrack?.id === targetTrackId) {
        return `Playback will pause after "${currentTrack.title}".`
      }

      return 'Playback will pause after the current track finishes.'
    }

    if (mode === 'minutes' && deadlineAt) {
      return `Playback will pause automatically in ${formatCountdown(deadlineAt, now)}.`
    }

    return 'Auto-pause playback after a delay or after this track.'
  }, [currentTrack, deadlineAt, mode, now, targetTrackId])

  const statusLabel = mode === 'off' ? 'Off' : mode === 'track-end' ? 'Track End' : 'Armed'

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`w-full rounded-3xl border px-4 py-3 text-left transition sm:min-w-[160px] sm:w-auto ${
          mode === 'off'
            ? 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'
            : 'border-aurora/30 bg-aurora/10 text-white hover:bg-aurora/20'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Sleep Timer</div>
            <div className="mt-1 text-sm font-semibold text-white">{buttonLabel}</div>
          </div>
          <div
            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
              mode === 'off'
                ? 'border-white/10 bg-white/5 text-slate-500'
                : 'border-aurora/30 bg-aurora/20 text-aurora'
            }`}
          >
            {statusLabel}
          </div>
        </div>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Sleep timer"
          className="absolute bottom-[calc(100%+0.9rem)] right-0 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-slate-950/96 p-4 shadow-soft backdrop-blur-xl sm:w-72"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.22em] text-aurora">Sleep Timer</div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
                mode === 'off'
                  ? 'border-white/10 bg-white/5 text-slate-500'
                  : 'border-aurora/30 bg-aurora/20 text-aurora'
              }`}
            >
              {statusLabel}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{detailLabel}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRESET_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  setSleepTimerMinutes(minutes)
                  setIsOpen(false)
                }}
                data-menu-item
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100 transition hover:bg-white/10"
              >
                {minutes} min
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => {
                if (!currentTrack) {
                  return
                }

                setSleepTimerAfterTrack(currentTrack.id)
                setIsOpen(false)
              }}
              disabled={!currentTrack}
              data-menu-item
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              After This Track
            </button>
            <button
              type="button"
              onClick={() => {
                clearSleepTimer()
                setIsOpen(false)
              }}
              disabled={mode === 'off'}
              data-menu-item
              className="rounded-2xl border border-white/10 px-3 py-3 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Timer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
