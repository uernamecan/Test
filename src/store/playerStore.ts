import { create } from 'zustand'
import type { PlayMode, Track } from '../types/track'
import { PLAY_MODE_ORDER } from '../lib/constants'

type RestorePlayerStatePayload = {
  queue: Track[]
  currentIndex: number
  progress: number
  volume: number
  lastAudibleVolume: number
  playMode: PlayMode
}

type RemoveQueueItemResult = {
  nextTrack: Track | null
  removedCurrent: boolean
  queueEmpty: boolean
}

type EnqueuePosition = 'next' | 'last'

type EnqueueResult = {
  insertIndex: number
  addedCount: number
  skippedCount: number
}

type PlayerState = {
  currentTrack: Track | null
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  volume: number
  lastAudibleVolume: number
  progress: number
  duration: number
  playMode: PlayMode
  playSelection: (queue: Track[], startIndex: number) => Track | null
  selectQueueIndex: (index: number) => Track | null
  setPlaying: (isPlaying: boolean) => void
  setVolume: (volume: number) => void
  toggleMute: () => number
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  cyclePlayMode: () => void
  setPlayMode: (playMode: PlayMode) => void
  syncTrackFavorite: (trackId: string, isFavorite: boolean) => void
  syncQueueWithLibrary: (tracks: Track[]) => void
  enqueueTracks: (tracks: Track[], position: EnqueuePosition) => EnqueueResult | null
  moveQueueItem: (index: number, targetIndex: number) => boolean
  removeQueueItem: (index: number) => RemoveQueueItemResult | null
  clearQueue: () => void
  restorePlayerState: (payload: RestorePlayerStatePayload) => void
  clearPlayer: () => void
}

function createEmptyPlayerState() {
  return {
    currentTrack: null,
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    progress: 0,
    duration: 0
  }
}

function resolveQueueSelection(queue: Track[], currentIndex: number) {
  const safeIndex = queue.length === 0 ? 0 : Math.min(Math.max(currentIndex, 0), queue.length - 1)

  return {
    currentIndex: safeIndex,
    currentTrack: queue[safeIndex] ?? null
  }
}

function dedupeTracks(tracks: Track[], existingTrackIds: Set<string>) {
  const queuedTrackIds = new Set(existingTrackIds)
  const uniqueTracks: Track[] = []

  for (const track of tracks) {
    if (queuedTrackIds.has(track.id)) {
      continue
    }

    queuedTrackIds.add(track.id)
    uniqueTracks.push(track)
  }

  return uniqueTracks
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  ...createEmptyPlayerState(),
  volume: 0.82,
  lastAudibleVolume: 0.82,
  playMode: 'sequence',
  playSelection: (queue, startIndex) => {
    if (queue.length === 0) {
      set(createEmptyPlayerState())
      return null
    }

    const safeIndex = Math.min(Math.max(startIndex, 0), queue.length - 1)
    const track = queue[safeIndex]

    set({
      queue,
      currentIndex: safeIndex,
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      duration: track.duration
    })

    return track
  },
  selectQueueIndex: (index) => {
    const { queue } = get()

    if (queue.length === 0 || index < 0 || index >= queue.length) {
      return null
    }

    const track = queue[index]

    set({
      currentIndex: index,
      currentTrack: track,
      progress: 0,
      duration: track.duration
    })

    return track
  },
  setPlaying: (isPlaying) => {
    set({ isPlaying })
  },
  setVolume: (volume) => {
    const nextVolume = Math.min(1, Math.max(0, volume))

    set((state) => ({
      volume: nextVolume,
      lastAudibleVolume: nextVolume > 0 ? nextVolume : state.lastAudibleVolume
    }))
  },
  toggleMute: () => {
    let nextVolume = 0

    set((state) => {
      if (state.volume > 0) {
        return {
          volume: 0,
          lastAudibleVolume: state.volume
        }
      }

      nextVolume = Math.min(1, Math.max(0.05, state.lastAudibleVolume || 0.82))

      return {
        volume: nextVolume,
        lastAudibleVolume: nextVolume
      }
    })

    return nextVolume
  },
  setProgress: (progress) => {
    set({ progress: Math.max(0, progress) })
  },
  setDuration: (duration) => {
    set({ duration: Math.max(0, duration) })
  },
  cyclePlayMode: () => {
    const currentIndex = PLAY_MODE_ORDER.indexOf(get().playMode)
    const nextMode = PLAY_MODE_ORDER[(currentIndex + 1) % PLAY_MODE_ORDER.length]
    set({ playMode: nextMode })
  },
  setPlayMode: (playMode) => {
    set({ playMode })
  },
  syncTrackFavorite: (trackId, isFavorite) => {
    set((state) => ({
      currentTrack:
        state.currentTrack?.id === trackId
          ? { ...state.currentTrack, isFavorite }
          : state.currentTrack,
      queue: state.queue.map((track) => (track.id === trackId ? { ...track, isFavorite } : track))
    }))
  },
  syncQueueWithLibrary: (tracks) => {
    set((state) => {
      if (state.queue.length === 0) {
        return state
      }

      const latestTrackMap = new Map(tracks.map((track) => [track.id, track]))
      const nextQueue = state.queue
        .map((track) => latestTrackMap.get(track.id))
        .filter((track): track is Track => Boolean(track))

      if (nextQueue.length === 0) {
        return {
          ...createEmptyPlayerState(),
          volume: state.volume,
          playMode: state.playMode
        }
      }

      const previousCurrentTrackId = state.currentTrack?.id
      const retainedCurrentIndex = previousCurrentTrackId
        ? nextQueue.findIndex((track) => track.id === previousCurrentTrackId)
        : -1
      const nextCurrentIndex =
        retainedCurrentIndex >= 0
          ? retainedCurrentIndex
          : Math.min(Math.max(state.currentIndex, 0), nextQueue.length - 1)
      const nextCurrentTrack = nextQueue[nextCurrentIndex] ?? null
      const currentTrackWasRemoved =
        Boolean(previousCurrentTrackId) && retainedCurrentIndex < 0

      return {
        queue: nextQueue,
        currentIndex: nextCurrentIndex,
        currentTrack: nextCurrentTrack,
        isPlaying: currentTrackWasRemoved ? false : state.isPlaying,
        progress: currentTrackWasRemoved ? 0 : Math.min(state.progress, nextCurrentTrack?.duration ?? 0),
        duration: nextCurrentTrack?.duration ?? 0
      }
    })
  },
  enqueueTracks: (tracks, position) => {
    if (tracks.length === 0) {
      return null
    }

    const state = get()
    const uniqueTracks = dedupeTracks(tracks, new Set(state.queue.map((track) => track.id)))

    if (uniqueTracks.length === 0) {
      return null
    }

    if (state.queue.length === 0) {
      const initialTrack = uniqueTracks[0]

      set({
        queue: uniqueTracks,
        currentIndex: 0,
        currentTrack: initialTrack,
        progress: 0,
        duration: initialTrack.duration
      })

      return {
        insertIndex: 0,
        addedCount: uniqueTracks.length,
        skippedCount: tracks.length - uniqueTracks.length
      }
    }

    const insertIndex =
      position === 'next'
        ? Math.min(state.currentIndex + 1, state.queue.length)
        : state.queue.length

    const nextQueue = [...state.queue]
    nextQueue.splice(insertIndex, 0, ...uniqueTracks)

    const nextCurrentTrack = nextQueue[state.currentIndex] ?? state.currentTrack

    set({
      queue: nextQueue,
      currentTrack: nextCurrentTrack
    })

    return {
      insertIndex,
      addedCount: uniqueTracks.length,
      skippedCount: tracks.length - uniqueTracks.length
    }
  },
  moveQueueItem: (index, targetIndex) => {
    const state = get()

    if (
      state.queue.length < 2 ||
      index < 0 ||
      index >= state.queue.length ||
      targetIndex < 0 ||
      targetIndex >= state.queue.length ||
      index === targetIndex
    ) {
      return false
    }

    const nextQueue = [...state.queue]
    const [movedTrack] = nextQueue.splice(index, 1)
    nextQueue.splice(targetIndex, 0, movedTrack)

    let nextCurrentIndex = state.currentIndex

    if (index === state.currentIndex) {
      nextCurrentIndex = targetIndex
    } else if (index < state.currentIndex && targetIndex >= state.currentIndex) {
      nextCurrentIndex -= 1
    } else if (index > state.currentIndex && targetIndex <= state.currentIndex) {
      nextCurrentIndex += 1
    }

    const nextCurrentTrack = nextQueue[nextCurrentIndex] ?? null

    set({
      queue: nextQueue,
      currentIndex: nextCurrentIndex,
      currentTrack: nextCurrentTrack
    })

    return true
  },
  removeQueueItem: (index) => {
    const state = get()

    if (index < 0 || index >= state.queue.length) {
      return null
    }

    const nextQueue = state.queue.filter((_track, queueIndex) => queueIndex !== index)
    const removedCurrent = index === state.currentIndex

    if (nextQueue.length === 0) {
      set(createEmptyPlayerState())
      return {
        nextTrack: null,
        removedCurrent,
        queueEmpty: true
      }
    }

    const nextCurrentIndex =
      index < state.currentIndex
        ? state.currentIndex - 1
        : index === state.currentIndex
          ? Math.min(state.currentIndex, nextQueue.length - 1)
          : state.currentIndex

    const nextTrack = nextQueue[nextCurrentIndex] ?? null

    set({
      queue: nextQueue,
      currentIndex: nextCurrentIndex,
      currentTrack: nextTrack,
      progress: removedCurrent ? 0 : state.progress,
      duration: nextTrack?.duration ?? 0
    })

    return {
      nextTrack,
      removedCurrent,
      queueEmpty: false
    }
  },
  clearQueue: () => {
    set(createEmptyPlayerState())
  },
  restorePlayerState: ({ queue, currentIndex, progress, volume, lastAudibleVolume, playMode }) => {
    const { currentIndex: safeIndex, currentTrack } = resolveQueueSelection(queue, currentIndex)
    const nextDuration = currentTrack?.duration ?? 0
    const safeVolume = Math.min(1, Math.max(0, volume))
    const safeLastAudibleVolume = Math.min(1, Math.max(0.05, lastAudibleVolume || 0.82))

    set({
      queue,
      currentIndex: safeIndex,
      currentTrack,
      isPlaying: false,
      volume: safeVolume,
      lastAudibleVolume: safeVolume > 0 ? safeVolume : safeLastAudibleVolume,
      progress: Math.min(Math.max(0, progress), nextDuration),
      duration: nextDuration,
      playMode
    })
  },
  clearPlayer: () => {
    set(createEmptyPlayerState())
  }
}))
