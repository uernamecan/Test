import { useEffect } from 'react'
import { musicApi } from '../services/api'
import { usePlayerStore } from '../store/playerStore'

export function useDesktopPlaybackState() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const queueLength = usePlayerStore((state) => state.queue.length)
  const currentIndex = usePlayerStore((state) => state.currentIndex)

  useEffect(() => {
    void musicApi.updateDesktopPlaybackState({
      trackTitle: currentTrack?.title ?? null,
      artist: currentTrack?.artist ?? null,
      trackPath: currentTrack?.path ?? null,
      isPlaying,
      queueLength,
      currentIndex
    })
  }, [
    currentIndex,
    currentTrack?.artist,
    currentTrack?.path,
    currentTrack?.title,
    isPlaying,
    queueLength
  ])
}
