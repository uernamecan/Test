type VisualizerState = {
  context: AudioContext
  analyser: AnalyserNode
}

let visualizerState: VisualizerState | null = null

function createVisualizer(audio: HTMLAudioElement) {
  const AudioContextClass = window.AudioContext

  if (!AudioContextClass) {
    return null
  }

  const context = new AudioContextClass()
  const source = context.createMediaElementSource(audio)
  const analyser = context.createAnalyser()

  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.82
  source.connect(analyser)
  analyser.connect(context.destination)

  return {
    context,
    analyser
  } satisfies VisualizerState
}

export function ensureVisualizer(audio: HTMLAudioElement) {
  if (!visualizerState) {
    visualizerState = createVisualizer(audio)
  }

  return visualizerState
}

export function getVisualizerAnalyser() {
  return visualizerState?.analyser ?? null
}

export async function resumeVisualizerContext(audio: HTMLAudioElement) {
  const visualizer = ensureVisualizer(audio)

  if (!visualizer || visualizer.context.state !== 'suspended') {
    return
  }

  try {
    await visualizer.context.resume()
  } catch (error) {
    console.warn('Failed to resume visualizer context:', error)
  }
}

export function sampleWaveform(analyser: AnalyserNode, bucketCount: number) {
  if (bucketCount <= 0) {
    return []
  }

  const source = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(source)

  if (source.length === 0) {
    return Array.from({ length: bucketCount }, () => 0)
  }

  const bucketSize = Math.max(1, Math.floor(source.length / bucketCount))

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = index * bucketSize
    const end =
      index === bucketCount - 1 ? source.length : Math.min(source.length, start + bucketSize)
    let total = 0

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      total += source[sampleIndex]
    }

    const average = end > start ? total / (end - start) : 0
    return Math.min(1, average / 255)
  })
}
