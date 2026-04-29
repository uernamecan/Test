import type { Track } from '../types/track'
import { musicApi } from './api'
import { getVisualizerAnalyser, resumeVisualizerContext } from './visualizer'
import { useHistoryStore } from '../store/historyStore'

const audioElement = new Audio()

audioElement.preload = 'metadata'
audioElement.volume = 0.82

let activeTrackId: string | null = null
let pendingSeekTime = 0

audioElement.addEventListener('loadedmetadata', () => {
  if (pendingSeekTime <= 0 || Number.isNaN(audioElement.duration)) {
    return
  }

  const nextTime = Math.min(Math.max(0, pendingSeekTime), audioElement.duration || pendingSeekTime)
  audioElement.currentTime = nextTime
  pendingSeekTime = 0
})

function loadSource(track: Track) {
  const source = musicApi.toFileUrl(track.path)

  if (activeTrackId !== track.id || audioElement.src !== source) {
    audioElement.src = source
    activeTrackId = track.id
    audioElement.load()
  }
}

function primePlaybackPosition(seconds = 0) {
  const nextTime = Math.max(0, seconds)

  if (audioElement.readyState >= 1) {
    audioElement.currentTime = nextTime
    pendingSeekTime = 0
    return
  }

  pendingSeekTime = nextTime
}

function prepareTrack(track: Track, startTime = 0) {
  loadSource(track)
  primePlaybackPosition(startTime)
}

async function playTrack(track: Track, startTime = 0) {
  prepareTrack(track, startTime)
  await resumeVisualizerContext(audioElement)
  await audioElement.play()
  try {
    const historyEntry = await musicApi.addHistoryEntry(track.id)

    if (historyEntry) {
      useHistoryStore.getState().prependHistoryEntry(historyEntry)
    }
  } catch (error) {
    console.warn('Failed to record playback history:', error)
  }
}

async function togglePlayback() {
  if (!audioElement.src) {
    return false
  }

  if (audioElement.paused) {
    await resumeVisualizerContext(audioElement)
    await audioElement.play()
    return true
  }

  audioElement.pause()
  return false
}

async function resumePlayback() {
  if (!audioElement.src || !audioElement.paused) {
    return false
  }

  await resumeVisualizerContext(audioElement)
  await audioElement.play()
  return true
}

async function replayCurrent() {
  audioElement.currentTime = 0
  await resumeVisualizerContext(audioElement)
  await audioElement.play()
}

function pausePlayback() {
  audioElement.pause()
}

function resetPlayback() {
  audioElement.pause()
  pendingSeekTime = 0
  activeTrackId = null
  audioElement.removeAttribute('src')
  audioElement.load()
}

function seekTo(seconds: number) {
  audioElement.currentTime = Math.max(0, seconds)
}

function setVolume(volume: number) {
  audioElement.volume = Math.min(1, Math.max(0, volume))
}

function getCurrentTime() {
  return audioElement.currentTime || 0
}

function getDuration() {
  return audioElement.duration || 0
}

function getAudioElement() {
  return audioElement
}

export const playerService = {
  prepareTrack,
  playTrack,
  togglePlayback,
  resumePlayback,
  replayCurrent,
  pausePlayback,
  resetPlayback,
  seekTo,
  setVolume,
  getCurrentTime,
  getDuration,
  getAudioElement,
  getVisualizerAnalyser
}
