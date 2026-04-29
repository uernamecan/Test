import { create } from 'zustand'

export type SleepTimerMode = 'off' | 'minutes' | 'track-end'

type SleepTimerState = {
  mode: SleepTimerMode
  deadlineAt: number | null
  targetTrackId: string | null
  setSleepTimerMinutes: (minutes: number) => void
  setSleepTimerAfterTrack: (trackId: string) => void
  clearSleepTimer: () => void
}

export const useSleepTimerStore = create<SleepTimerState>((set) => ({
  mode: 'off',
  deadlineAt: null,
  targetTrackId: null,
  setSleepTimerMinutes: (minutes) => {
    const safeMinutes = Math.max(1, Math.round(minutes))

    set({
      mode: 'minutes',
      deadlineAt: Date.now() + safeMinutes * 60 * 1000,
      targetTrackId: null
    })
  },
  setSleepTimerAfterTrack: (trackId) => {
    set({
      mode: 'track-end',
      deadlineAt: null,
      targetTrackId: trackId
    })
  },
  clearSleepTimer: () => {
    set({
      mode: 'off',
      deadlineAt: null,
      targetTrackId: null
    })
  }
}))
