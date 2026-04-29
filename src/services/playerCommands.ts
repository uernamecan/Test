import { playerService } from './player'
import { getNextQueueIndex, getPreviousQueueIndex } from './queue'
import { reportPlaybackFailure } from './playbackErrors'
import { usePlayerStore } from '../store/playerStore'
import type { Track } from '../types/track'

export type PlayNowResult =
  | {
      track: Track
      addedCount: number
      skippedCount: number
    }
  | {
      track: null
      reason: 'empty' | 'already-queued' | 'failed'
    }

export async function playTrackCommand(track: Track, startTime = 0) {
  try {
    await playerService.playTrack(track, startTime)
    return true
  } catch (error) {
    reportPlaybackFailure(track, error)
    playerService.resetPlayback()
    return false
  }
}

export async function playCurrentSelection() {
  const state = usePlayerStore.getState()

  if (state.currentTrack) {
    await playTrackCommand(state.currentTrack)
    return
  }

  if (state.queue.length === 0) {
    return
  }

  const selectedTrack = state.selectQueueIndex(state.currentIndex)

  if (selectedTrack) {
    await playTrackCommand(selectedTrack)
  }
}

export async function togglePlaybackCommand() {
  const state = usePlayerStore.getState()

  if (!state.currentTrack) {
    await playCurrentSelection()
    return
  }

  try {
    await playerService.togglePlayback()
  } catch (error) {
    reportPlaybackFailure(state.currentTrack, error)
    playerService.resetPlayback()
  }
}

export async function resumePlaybackCommand() {
  const state = usePlayerStore.getState()

  if (!state.currentTrack) {
    await playCurrentSelection()
    return
  }

  try {
    await playerService.resumePlayback()
  } catch (error) {
    reportPlaybackFailure(state.currentTrack, error)
    playerService.resetPlayback()
  }
}

export function pausePlaybackCommand() {
  playerService.pausePlayback()
}

export async function restartCurrentTrackCommand() {
  const state = usePlayerStore.getState()

  if (!state.currentTrack) {
    return false
  }

  try {
    await playerService.replayCurrent()
    return true
  } catch (error) {
    reportPlaybackFailure(state.currentTrack, error)
    playerService.resetPlayback()
    return false
  }
}

export function stopPlaybackCommand() {
  const state = usePlayerStore.getState()

  playerService.pausePlayback()
  playerService.seekTo(0)
  state.setProgress(0)
}

export async function playPreviousCommand() {
  const state = usePlayerStore.getState()

  if (!state.currentTrack) {
    return
  }

  if (playerService.getCurrentTime() > 3) {
    playerService.seekTo(0)
    state.setProgress(0)
    return
  }

  const previousIndex = getPreviousQueueIndex(state.queue, state.currentIndex)

  if (previousIndex === null) {
    return
  }

  const previousTrack = state.selectQueueIndex(previousIndex)

  if (previousTrack) {
    await playTrackCommand(previousTrack)
  }
}

export async function playNextCommand() {
  const state = usePlayerStore.getState()
  const nextIndex = getNextQueueIndex(state.queue, state.currentIndex, state.playMode, 'manual')

  if (nextIndex === null) {
    return
  }

  const nextTrack = state.selectQueueIndex(nextIndex)

  if (nextTrack) {
    await playTrackCommand(nextTrack)
  }
}

function normalizeTracks(tracks: Track | Track[]) {
  return Array.isArray(tracks) ? tracks : [tracks]
}

export function queueNextCommand(tracks: Track | Track[]) {
  return usePlayerStore.getState().enqueueTracks(normalizeTracks(tracks), 'next')
}

export function queueLastCommand(tracks: Track | Track[]) {
  return usePlayerStore.getState().enqueueTracks(normalizeTracks(tracks), 'last')
}

export async function playNowCommand(tracks: Track | Track[]): Promise<PlayNowResult> {
  const trackList = normalizeTracks(tracks)

  if (trackList.length === 0) {
    return {
      track: null,
      reason: 'empty'
    }
  }

  const state = usePlayerStore.getState()

  if (state.queue.length === 0 || !state.currentTrack) {
    const nextTrack = state.playSelection(trackList, 0)

    if (nextTrack) {
      const started = await playTrackCommand(nextTrack)
      return started
        ? {
            track: nextTrack,
            addedCount: trackList.length,
            skippedCount: 0
          }
        : {
            track: null,
            reason: 'failed'
          }
    }

    return {
      track: null,
      reason: 'failed'
    }
  }

  const enqueueResult = state.enqueueTracks(trackList, 'next')

  if (enqueueResult === null) {
    return {
      track: null,
      reason: 'already-queued'
    }
  }

  const nextTrack = usePlayerStore.getState().selectQueueIndex(enqueueResult.insertIndex)

  if (nextTrack) {
    const started = await playTrackCommand(nextTrack)
    return started
      ? {
          track: nextTrack,
          addedCount: enqueueResult.addedCount,
          skippedCount: enqueueResult.skippedCount
        }
      : {
          track: null,
          reason: 'failed'
        }
  }

  return {
    track: null,
    reason: 'failed'
  }
}

export function moveQueueItemCommand(index: number, targetIndex: number) {
  return usePlayerStore.getState().moveQueueItem(index, targetIndex)
}

export async function removeQueueItemCommand(index: number) {
  const state = usePlayerStore.getState()
  const wasPlaying = state.isPlaying
  const result = state.removeQueueItem(index)

  if (!result || !result.removedCurrent) {
    return
  }

  if (result.queueEmpty || !result.nextTrack) {
    playerService.resetPlayback()
    return
  }

  if (wasPlaying) {
    await playTrackCommand(result.nextTrack)
    return
  }

  playerService.prepareTrack(result.nextTrack, 0)
}

export function clearQueueCommand() {
  usePlayerStore.getState().clearQueue()
  playerService.resetPlayback()
}
