import type { PlayMode, Track } from '../types/track'

export type QueueAdvanceReason = 'manual' | 'ended'

export function getNextQueueIndex(
  queue: Track[],
  currentIndex: number,
  playMode: PlayMode,
  reason: QueueAdvanceReason
) {
  if (queue.length === 0) {
    return null
  }

  if (playMode === 'shuffle') {
    if (queue.length === 1) {
      return 0
    }

    let nextIndex = Math.floor(Math.random() * queue.length)

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * queue.length)
    }

    return nextIndex
  }

  if (currentIndex < queue.length - 1) {
    return currentIndex + 1
  }

  if (playMode === 'repeat-all') {
    return 0
  }

  return null
}

export function getPreviousQueueIndex(queue: Track[], currentIndex: number) {
  if (queue.length === 0) {
    return null
  }

  if (currentIndex > 0) {
    return currentIndex - 1
  }

  return 0
}
