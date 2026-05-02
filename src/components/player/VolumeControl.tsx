type VolumeControlProps = {
  volume: number
  onChange: (nextVolume: number) => void
  onToggleMute: () => void
}

export default function VolumeControl({ volume, onChange, onToggleMute }: VolumeControlProps) {
  const volumePercent = Math.round(volume * 100)
  const muted = volumePercent === 0

  return (
    <section className="flex min-w-[190px] items-center gap-3">
      <button
        type="button"
        onClick={onToggleMute}
        aria-pressed={muted}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          muted
            ? 'bg-rose-500/10 text-rose-500 dark:text-rose-300'
            : 'bg-black/5 text-slate-500 hover:bg-black/10 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12'
        }`}
      >
        {muted ? 'Muted' : `${volumePercent}%`}
      </button>
        <div className="relative flex-1">
          <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-black/10 dark:bg-white/10" />
          <div
            className="absolute inset-y-1 left-0 rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${volumePercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onChange(Number(event.target.value))}
            className="player-range relative h-3 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
    </section>
  )
}
