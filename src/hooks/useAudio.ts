import { useEffect } from 'react'
import { playerService } from '../services/player'
import { reportPlaybackFailure } from '../services/playbackErrors'
import { getNextQueueIndex } from '../services/queue'
import { usePlayerStore } from '../store/playerStore'
import { useSleepTimerStore } from '../store/sleepTimerStore'
import type { Track } from '../types/track'

function getMediaErrorMessage(error: MediaError | null) {
  if (!error) {
    return 'The audio element reported an unknown playback error.'
  }

  if (error.message) {
    return error.message
  }

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted before the track could continue.'
    case MediaError.MEDIA_ERR_NETWORK:
      return 'The audio file could not be loaded from disk.'
    case MediaError.MEDIA_ERR_DECODE:
      return 'The audio file could not be decoded.'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'This audio source is not supported by the current player.'
    default:
      return 'The audio element reported an unknown playback error.'
  }
}

async function playTrackFromAudioLifecycle(track: Track) {
  try {
    await playerService.playTrack(track)
  } catch (error) {
    reportPlaybackFailure(track, error)
  }
}

export function useAudio() {
  const volume = usePlayerStore((state) => state.volume)

  useEffect(() => {
    playerService.setVolume(volume)
  }, [volume])

  useEffect(() => {
    const audio = playerService.getAudioElement()

    const handleTimeUpdate = () => {
      usePlayerStore.getState().setProgress(audio.currentTime || 0)
    }

    const handleLoadedMetadata = () => {
      usePlayerStore.getState().setDuration(audio.duration || 0)
    }

    const handlePlay = () => {
      usePlayerStore.getState().setPlaying(true)
    }

    const handlePause = () => {
      usePlayerStore.getState().setPlaying(false)
    }

    const handleError = () => {
      const state = usePlayerStore.getState()
      reportPlaybackFailure(state.currentTrack, getMediaErrorMessage(audio.error))
      playerService.resetPlayback()
    }

    const handleEnded = () => {
      const state = usePlayerStore.getState()
      const sleepTimerState = useSleepTimerStore.getState()

      if (
        sleepTimerState.mode === 'track-end' &&
        sleepTimerState.targetTrackId &&
        sleepTimerState.targetTrackId === state.currentTrack?.id
      ) {
        sleepTimerState.clearSleepTimer()
        state.setPlaying(false)
        state.setProgress(0)
        return
      }

      if (state.playMode === 'repeat-one' && state.currentTrack) {
        void playerService.replayCurrent().catch((error) => {
          reportPlaybackFailure(state.currentTrack, error)
        })
        return
      }

      const nextIndex = getNextQueueIndex(state.queue, state.currentIndex, state.playMode, 'ended')

      if (nextIndex === null) {
        state.setPlaying(false)
        state.setProgress(0)
        return
      }

      const nextTrack = state.selectQueueIndex(nextIndex)

      if (nextTrack) {
        void playTrackFromAudioLifecycle(nextTrack)
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('error', handleError)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])
}
