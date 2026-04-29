import { useEffect } from 'react'
import { playerService } from '../services/player'
import { usePlayerStore } from '../store/playerStore'
import { useSleepTimerStore } from '../store/sleepTimerStore'

export function useSleepTimer() {
  const mode = useSleepTimerStore((state) => state.mode)
  const deadlineAt = useSleepTimerStore((state) => state.deadlineAt)
  const targetTrackId = useSleepTimerStore((state) => state.targetTrackId)
  const clearSleepTimer = useSleepTimerStore((state) => state.clearSleepTimer)
  const currentTrackId = usePlayerStore((state) => state.currentTrack?.id)

  useEffect(() => {
    if (mode !== 'minutes' || !deadlineAt) {
      return
    }

    const remainingMs = deadlineAt - Date.now()

    if (remainingMs <= 0) {
      playerService.pausePlayback()
      clearSleepTimer()
      return
    }

    const timer = window.setTimeout(() => {
      playerService.pausePlayback()
      clearSleepTimer()
    }, remainingMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [clearSleepTimer, deadlineAt, mode])

  useEffect(() => {
    if (mode !== 'track-end' || !targetTrackId) {
      return
    }

    if (currentTrackId !== targetTrackId) {
      clearSleepTimer()
    }
  }, [clearSleepTimer, currentTrackId, mode, targetTrackId])
}
