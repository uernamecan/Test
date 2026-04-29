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
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous track"
        title="Previous track"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        {'|<<'}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
        title={isPlaying ? 'Pause playback' : 'Start playback'}
        className="flex h-14 min-w-14 items-center justify-center rounded-full bg-white px-5 text-base font-semibold text-slate-950 transition hover:brightness-110"
      >
        <span className="font-mono tracking-[-0.08em]">{isPlaying ? '||' : '>'}</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next track"
        title="Next track"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        {'>>|'}
      </button>
      <button
        type="button"
        onClick={onCycleMode}
        aria-label={`Change play mode. Current mode: ${PLAY_MODE_LABELS[playMode]}`}
        title={`Play mode: ${PLAY_MODE_LABELS[playMode]}`}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/10"
      >
        {PLAY_MODE_LABELS[playMode]}
      </button>
    </div>
  )
}
