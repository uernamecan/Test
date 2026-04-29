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

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
        <span>Timeline</span>
        <span>{duration > 0 ? `${Math.round(progressPercent)}%` : 'Waiting'}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span className="w-12 text-right font-medium text-white">{formatDuration(progress)}</span>
        <div className="relative flex-1">
          <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-white/5" />
          <div
            className="absolute inset-y-1 left-0 rounded-full bg-gradient-to-r from-aurora via-cyan-300 to-accent transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.1}
            value={safeProgress}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="player-range relative h-3 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
        <span className="w-12 font-medium text-slate-200">{formatDuration(duration)}</span>
      </div>
    </div>
  )
}
