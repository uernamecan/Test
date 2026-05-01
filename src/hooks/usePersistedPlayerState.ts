import { useEffect, useRef } from 'react'
import { playerService } from '../services/player'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useSettingsStore } from '../store/settingsStore'
import { resolvePersistedPlayerState } from '../types/settings'

const PLAYER_STATE_KEY = 'playerState'
const PLAYBACK_SYNC_INTERVAL_MS = 5000

function buildPlayerSnapshot() {
  const state = usePlayerStore.getState()

  return {
    queueTrackIds: state.queue.map((track) => track.id),
    currentTrackId: state.currentTrack?.id,
    currentIndex: state.currentIndex,
    progress: state.progress,
    volume: state.volume,
    lastAudibleVolume: state.lastAudibleVolume,
    playMode: state.playMode
  }
}

export function usePersistedPlayerState() {
  const settings = useSettingsStore((state) => state.settings)
  const settingsReady = useSettingsStore((state) => state.ready)
  const setSetting = useSettingsStore((state) => state.setSetting)
  const tracks = useLibraryStore((state) => state.tracks)
  const libraryReady = useLibraryStore((state) => state.ready)
  const queue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const currentTrackId = usePlayerStore((state) => state.currentTrack?.id)
  const volume = usePlayerStore((state) => state.volume)
  const lastAudibleVolume = usePlayerStore((state) => state.lastAudibleVolume)
  const playMode = usePlayerStore((state) => state.playMode)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const restoredRef = useRef(false)

  useEffect(() => {
    if (!settingsReady || !libraryReady || restoredRef.current) {
      return
    }

    const persistedState = resolvePersistedPlayerState(settings.playerState)

    if (!persistedState) {
      restoredRef.current = true
      return
    }

    const trackMap = new Map(tracks.map((track) => [track.id, track]))
    const restoredQueue = persistedState.queueTrackIds
      .map((trackId) => trackMap.get(trackId))
      .filter((track): track is NonNullable<typeof track> => Boolean(track))

    const selectedQueueIndex =
      persistedState.currentTrackId && restoredQueue.length > 0
        ? restoredQueue.findIndex((track) => track.id === persistedState.currentTrackId)
        : -1

    const nextIndex =
      selectedQueueIndex >= 0
        ? selectedQueueIndex
        : restoredQueue.length > 0
          ? Math.min(Math.max(persistedState.currentIndex, 0), restoredQueue.length - 1)
          : 0

    usePlayerStore.getState().restorePlayerState({
      queue: restoredQueue,
      currentIndex: nextIndex,
      progress: persistedState.progress,
      volume: persistedState.volume,
      lastAudibleVolume: persistedState.lastAudibleVolume,
      playMode: persistedState.playMode
    })

    const currentTrack = restoredQueue[nextIndex]

    if (currentTrack) {
      playerService.prepareTrack(currentTrack, persistedState.progress)
    }

    restoredRef.current = true
  }, [libraryReady, settings.playerState, settingsReady, tracks])

  useEffect(() => {
    if (!settingsReady || !restoredRef.current) {
      return
    }

    void setSetting(PLAYER_STATE_KEY, buildPlayerSnapshot())
  }, [currentIndex, currentTrackId, lastAudibleVolume, playMode, queue, setSetting, settingsReady, volume])

  useEffect(() => {
    if (!settingsReady || !restoredRef.current || isPlaying) {
      return
    }

    void setSetting(PLAYER_STATE_KEY, buildPlayerSnapshot())
  }, [isPlaying, setSetting, settingsReady])

  useEffect(() => {
    if (!settingsReady || !restoredRef.current || !isPlaying) {
      return
    }

    const timer = window.setInterval(() => {
      void setSetting(PLAYER_STATE_KEY, buildPlayerSnapshot())
    }, PLAYBACK_SYNC_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [isPlaying, setSetting, settingsReady])

  useEffect(() => {
    if (!settingsReady || !restoredRef.current) {
      return
    }

    const handleBeforeUnload = () => {
      void setSetting(PLAYER_STATE_KEY, buildPlayerSnapshot())
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [setSetting, settingsReady])
}
