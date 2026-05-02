import { PLAY_MODE_LABELS } from '../../lib/constants'
import type { PlayMode } from '../../types/track'

type PlaybackControlsProps = {
  isPlaying: boolean
  playMode: PlayMode
  onPrevious: () => void
  onToggle: () => void
  onNext: () => void
  onCycleMode: () => void
}

export default function PlaybackControls({
  isPlaying,
  playMode,
  onPrevious,
  onToggle,
  onNext,
  onCycleMode
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous track"
        title="Previous track"
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
      >
        {'<<'}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
        title={isPlaying ? 'Pause playback' : 'Start playback'}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-base font-semibold text-white shadow-[0_12px_28px_rgba(250,35,59,0.28)] transition hover:brightness-110"
      >
        <span className="font-mono tracking-[-0.08em]">{isPlaying ? '||' : '>'}</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next track"
        title="Next track"
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:bg-black/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
      >
        {'>>'}
      </button>
      <button
        type="button"
        onClick={onCycleMode}
        aria-label={`Change play mode. Current mode: ${PLAY_MODE_LABELS[playMode]}`}
        title={`Play mode: ${PLAY_MODE_LABELS[playMode]}`}
        className="rounded-full bg-black/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:bg-black/10 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
      >
        {PLAY_MODE_LABELS[playMode]}
      </button>
    </div>
  )
}
