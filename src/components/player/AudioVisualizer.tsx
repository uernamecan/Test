import { useWaveform } from '../../hooks/useWaveform'

export default function AudioVisualizer() {
  const { points, active } = useWaveform()

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Visualizer</div>
          <div className="mt-1 text-xs text-slate-300">
            {active ? 'Live output from the current track.' : 'Starts moving as soon as playback resumes.'}
          </div>
        </div>
        <div
          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
            active
              ? 'border-aurora/30 bg-aurora/20 text-aurora'
              : 'border-white/10 bg-white/5 text-slate-500'
          }`}
        >
          {active ? 'Live' : 'Idle'}
        </div>
      </div>

      <div className="mt-4 flex h-14 items-end gap-1">
        {points.map((point, index) => (
          <span
            key={index}
            className={`block flex-1 rounded-full transition-[height,opacity,background-color] duration-150 ${
              active ? 'bg-gradient-to-t from-aurora via-cyan-300 to-accent opacity-100' : 'bg-white/15 opacity-70'
            }`}
            style={{
              height: `${12 + Math.round(point * 44)}px`
            }}
          />
        ))}
      </div>
    </section>
  )
}
