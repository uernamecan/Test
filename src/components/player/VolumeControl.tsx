type VolumeControlProps = {
  volume: number
  onChange: (nextVolume: number) => void
}

export default function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const volumePercent = Math.round(volume * 100)

  return (
    <section className="w-full min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:min-w-[220px] sm:flex-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Volume</div>
          <div className="mt-1 text-xs text-slate-300">Dial in the room without leaving the player.</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200">
          {volumePercent}%
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Min</span>
        <div className="relative flex-1">
          <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-white/5" />
          <div
            className="absolute inset-y-1 left-0 rounded-full bg-gradient-to-r from-slate-500 via-aurora to-accent transition-[width] duration-150"
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
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Max</span>
      </div>
    </section>
  )
}
