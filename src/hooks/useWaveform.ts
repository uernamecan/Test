import { useEffect, useState } from 'react'
import { playerService } from '../services/player'
import { sampleWaveform } from '../services/visualizer'

const BAR_COUNT = 28
const SAMPLE_INTERVAL_MS = 72

function createIdleWaveform() {
  return Array.from({ length: BAR_COUNT }, (_, index) => 0.08 + ((index % 5) * 0.012))
}

const IDLE_WAVEFORM = createIdleWaveform()

function decayWaveform(points: number[]) {
  return points.map((point, index) => {
    const floor = 0.08 + ((index % 5) * 0.012)
    return point > floor ? Math.max(floor, point * 0.72) : floor
  })
}

export function useWaveform() {
  const [points, setPoints] = useState<number[]>(() => IDLE_WAVEFORM)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const audio = playerService.getAudioElement()

    const timer = window.setInterval(() => {
      const analyser = playerService.getVisualizerAnalyser()
      const isActive = Boolean(analyser && !audio.paused && !audio.ended && audio.currentSrc)

      setActive(isActive)

      if (!analyser || !isActive) {
        setPoints((currentPoints) => decayWaveform(currentPoints))
        return
      }

      const nextPoints = sampleWaveform(analyser, BAR_COUNT)
      setPoints(nextPoints.length > 0 ? nextPoints : IDLE_WAVEFORM)
    }, SAMPLE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return { points, active }
}
