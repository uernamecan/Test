import { useEffect } from 'react'
import { musicApi } from '../services/api'
import { playerService } from '../services/player'
import {
  pausePlaybackCommand,
  playNextCommand,
  playPreviousCommand,
  resumePlaybackCommand,
  stopPlaybackCommand
} from '../services/playerCommands'
import { usePlayerStore } from '../store/playerStore'

function getArtworkMimeType(coverPath: string) {
  const extension = coverPath.split('.').pop()?.toLowerCase()

  if (extension === 'png') {
    return 'image/png'
  }

  if (extension === 'webp') {
    return 'image/webp'
  }

  return 'image/jpeg'
}

function seekPlaybackBy(delta: number) {
  const state = usePlayerStore.getState()
  const currentTrack = state.currentTrack

  if (!currentTrack) {
    return
  }

  const currentTime = playerService.getCurrentTime()
  const safeDuration = Math.max(state.duration || currentTrack.duration || 0, 0)
  const nextProgress = Math.min(Math.max(currentTime + delta, 0), safeDuration || currentTime + delta)

  playerService.seekTo(nextProgress)
  state.setProgress(nextProgress)
}

function seekPlaybackTo(position: number | null | undefined) {
  if (typeof position !== 'number' || !Number.isFinite(position)) {
    return
  }

  const state = usePlayerStore.getState()
  const currentTrack = state.currentTrack

  if (!currentTrack) {
    return
  }

  const safeDuration = Math.max(state.duration || currentTrack.duration || 0, 0)
  const nextProgress = Math.min(Math.max(position, 0), safeDuration || position)

  playerService.seekTo(nextProgress)
  state.setProgress(nextProgress)
}

export function useMediaSession() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const progress = usePlayerStore((state) => state.progress)
  const duration = usePlayerStore((state) => state.duration)

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    navigator.mediaSession.setActionHandler('play', () => {
      void resumePlaybackCommand()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      pausePlaybackCommand()
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      void playPreviousCommand()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      void playNextCommand()
    })
    navigator.mediaSession.setActionHandler('stop', () => {
      stopPlaybackCommand()
    })
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      seekPlaybackBy(-(details.seekOffset ?? 10))
    })
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      seekPlaybackBy(details.seekOffset ?? 10)
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      seekPlaybackTo(details.seekTime)
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('stop', null)
      navigator.mediaSession.setActionHandler('seekbackward', null)
      navigator.mediaSession.setActionHandler('seekforward', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    }
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      navigator.mediaSession.setPositionState?.()
      return
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.coverPath
        ? [
            {
              src: musicApi.toFileUrl(currentTrack.coverPath),
              sizes: '512x512',
              type: getArtworkMimeType(currentTrack.coverPath)
            }
          ]
        : []
    })
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || !navigator.mediaSession.setPositionState) {
      return
    }

    const safeDuration = Math.max(duration || currentTrack.duration || 0, 0)

    if (safeDuration <= 0) {
      return
    }

    navigator.mediaSession.setPositionState({
      duration: safeDuration,
      playbackRate: 1,
      position: Math.min(Math.max(progress, 0), safeDuration)
    })
  }, [currentTrack, duration, progress])
}
