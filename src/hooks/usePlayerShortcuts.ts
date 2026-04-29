import { useEffect } from 'react'
import {
  playNextCommand,
  playPreviousCommand,
  togglePlaybackCommand
} from '../services/playerCommands'
import { PLAY_MODE_LABELS } from '../lib/constants'
import { playerService } from '../services/player'
import { useFeedbackStore } from '../store/feedbackStore'
import { usePlayerStore } from '../store/playerStore'
import { useUiStore } from '../store/uiStore'

let lastAudibleVolume = 0.82

function canUseShortcut(eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof HTMLElement)) {
    return true
  }

  return !['INPUT', 'TEXTAREA'].includes(eventTarget.tagName) && !eventTarget.isContentEditable
}

function seekPlaybackBy(delta: number) {
  const state = usePlayerStore.getState()
  const showFeedback = useFeedbackStore.getState().showFeedback

  if (!state.currentTrack) {
    showFeedback('Nothing is playing right now.', 'muted')
    return
  }

  const currentTime = playerService.getCurrentTime()
  const safeDuration = Math.max(state.duration || state.currentTrack.duration || 0, 0)
  const nextProgress = Math.min(Math.max(currentTime + delta, 0), safeDuration || currentTime + delta)
  playerService.seekTo(nextProgress)
  state.setProgress(nextProgress)
}

function adjustVolumeBy(delta: number) {
  const state = usePlayerStore.getState()
  const showFeedback = useFeedbackStore.getState().showFeedback
  const nextVolume = Math.min(1, Math.max(0, state.volume + delta))

  state.setVolume(nextVolume)
  playerService.setVolume(nextVolume)
  showFeedback(`Volume ${Math.round(nextVolume * 100)}%.`, 'muted')
}

function toggleMute() {
  const state = usePlayerStore.getState()
  const showFeedback = useFeedbackStore.getState().showFeedback

  if (state.volume > 0) {
    lastAudibleVolume = state.volume
    state.setVolume(0)
    playerService.setVolume(0)
    showFeedback('Muted.', 'muted')
    return
  }

  const restoredVolume = Math.min(1, Math.max(0.05, lastAudibleVolume || 0.82))
  state.setVolume(restoredVolume)
  playerService.setVolume(restoredVolume)
  showFeedback(`Volume ${Math.round(restoredVolume * 100)}%.`, 'muted')
}

function cyclePlayMode() {
  const state = usePlayerStore.getState()
  state.cyclePlayMode()

  const nextPlayMode = usePlayerStore.getState().playMode
  useFeedbackStore.getState().showFeedback(`Playback mode: ${PLAY_MODE_LABELS[nextPlayMode]}.`, 'muted')
}

export function usePlayerShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canUseShortcut(event.target)) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        void togglePlaybackCommand()
        return
      }

      if (event.code === 'ArrowRight' && event.altKey && event.shiftKey) {
        event.preventDefault()
        seekPlaybackBy(10)
        return
      }

      if (event.code === 'ArrowLeft' && event.altKey && event.shiftKey) {
        event.preventDefault()
        seekPlaybackBy(-10)
        return
      }

      if (event.code === 'ArrowRight' && event.altKey) {
        event.preventDefault()
        void playNextCommand()
        return
      }

      if (event.code === 'ArrowLeft' && event.altKey) {
        event.preventDefault()
        void playPreviousCommand()
        return
      }

      if (event.key === ']' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        adjustVolumeBy(0.05)
        return
      }

      if (event.key === '[' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        adjustVolumeBy(-0.05)
        return
      }

      if (event.key === '\\' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        toggleMute()
        return
      }

      if ((event.key === 'k' || event.key === 'K') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        useUiStore.getState().toggleQueue()
        return
      }

      if ((event.key === 'l' || event.key === 'L') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        useUiStore.getState().toggleLyrics()
        return
      }

      if ((event.key === 'm' || event.key === 'M') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        cyclePlayMode()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
