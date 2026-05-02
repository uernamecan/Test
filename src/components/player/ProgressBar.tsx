import { formatDuration } from '../../lib/format'

type ProgressBarProps = {
  progress: number
  duration: number
  onSeek: (nextProgress: number) => void
}

export default function ProgressBar({ progress, duration, onSeek }: ProgressBarProps) {
  const safeDuration = Math.max(duration, 1)
  const safeProgress = Math.min(progress, duration || 0)
  const progressPercent = Math.min((safeProgress / safeDuration) * 100, 100)
  const disabled = duration <= 0

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span className="w-12 text-right font-medium text-slate-500 dark:text-slate-400">{formatDuration(progress)}</span>
        <div className="relative flex-1">
          <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-black/10 dark:bg-white/10" />
          <div
            className="absolute inset-y-1 left-0 rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.1}
            value={safeProgress}
            disabled={disabled}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="player-range relative h-3 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Playback progress"
          />
        </div>
        <span className="w-12 font-medium text-slate-500 dark:text-slate-400">{formatDuration(duration)}</span>
      </div>
    </div>
  )
}
