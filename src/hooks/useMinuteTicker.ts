import { useSyncExternalStore } from 'react'

function getMillisecondsUntilNextMinute() {
  const now = new Date()
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds())
}

let tick = 0
let timeoutId: number | null = null
const listeners = new Set<() => void>()

function canUseBrowserClock() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function emitTick() {
  tick += 1

  for (const listener of listeners) {
    listener()
  }
}

function clearScheduledTick() {
  if (!canUseBrowserClock()) {
    return
  }

  if (timeoutId !== null) {
    window.clearTimeout(timeoutId)
    timeoutId = null
  }
}

function scheduleNextTick() {
  clearScheduledTick()

  if (!canUseBrowserClock()) {
    return
  }

  if (document.hidden || listeners.size === 0) {
    return
  }

  timeoutId = window.setTimeout(() => {
    emitTick()
    scheduleNextTick()
  }, getMillisecondsUntilNextMinute())
}

function handleVisibilityChange() {
  clearScheduledTick()

  if (!canUseBrowserClock()) {
    return
  }

  if (document.hidden || listeners.size === 0) {
    return
  }

  emitTick()
  scheduleNextTick()
}

function subscribe(listener: () => void) {
  if (!canUseBrowserClock()) {
    return () => {}
  }

  listeners.add(listener)

  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleNextTick()
  }

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      clearScheduledTick()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}

function getSnapshot() {
  return tick
}

export function useMinuteTicker() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
