import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from 'electron'
import { getSetting, setSetting } from '../db/repositories/settingsRepo'

const WINDOW_STATE_KEY = 'windowState'
const WINDOW_STATE_SAVE_DELAY_MS = 180
const MIN_WINDOW_WIDTH = 1120
const MIN_WINDOW_HEIGHT = 760

type WindowState = {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseWindowState(value: unknown): WindowState {
  const candidate = value && typeof value === 'object' ? (value as Partial<WindowState>) : {}

  return {
    width: Math.max(MIN_WINDOW_WIDTH, isFiniteNumber(candidate.width) ? candidate.width : 1440),
    height: Math.max(MIN_WINDOW_HEIGHT, isFiniteNumber(candidate.height) ? candidate.height : 920),
    x: isFiniteNumber(candidate.x) ? candidate.x : undefined,
    y: isFiniteNumber(candidate.y) ? candidate.y : undefined,
    isMaximized: typeof candidate.isMaximized === 'boolean' ? candidate.isMaximized : false
  }
}

function rectanglesIntersect(left: Rectangle, right: Rectangle) {
  return !(
    left.x + left.width <= right.x ||
    left.x >= right.x + right.width ||
    left.y + left.height <= right.y ||
    left.y >= right.y + right.height
  )
}

function isVisibleOnAnyDisplay(bounds: Rectangle) {
  return screen.getAllDisplays().some((display) => rectanglesIntersect(bounds, display.workArea))
}

function createWindowSnapshot(window: BrowserWindow): WindowState {
  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()

  return {
    width: Math.max(MIN_WINDOW_WIDTH, bounds.width),
    height: Math.max(MIN_WINDOW_HEIGHT, bounds.height),
    x: bounds.x,
    y: bounds.y,
    isMaximized: window.isMaximized()
  }
}

export function createWindowStateManager() {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const readWindowState = () => {
    return parseWindowState(getSetting(WINDOW_STATE_KEY))
  }

  const getLaunchState = () => {
    const state = readWindowState()
    const windowOptions: BrowserWindowConstructorOptions = {
      width: state.width,
      height: state.height
    }

    if (typeof state.x === 'number' && typeof state.y === 'number') {
      const candidateBounds: Rectangle = {
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height
      }

      if (isVisibleOnAnyDisplay(candidateBounds)) {
        windowOptions.x = state.x
        windowOptions.y = state.y
      }
    }

    return {
      windowOptions,
      isMaximized: state.isMaximized
    }
  }

  const persistWindowState = (window: BrowserWindow) => {
    if (window.isDestroyed()) {
      return
    }

    setSetting(WINDOW_STATE_KEY, createWindowSnapshot(window))
  }

  const scheduleWindowStatePersist = (window: BrowserWindow) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }

    saveTimer = setTimeout(() => {
      saveTimer = null
      persistWindowState(window)
    }, WINDOW_STATE_SAVE_DELAY_MS)
  }

  return {
    getLaunchState,
    bindWindow(window: BrowserWindow) {
      const schedulePersist = () => {
        scheduleWindowStatePersist(window)
      }

      window.on('move', schedulePersist)
      window.on('resize', schedulePersist)
      window.on('maximize', schedulePersist)
      window.on('unmaximize', schedulePersist)
      window.on('close', () => {
        if (saveTimer) {
          clearTimeout(saveTimer)
          saveTimer = null
        }

        persistWindowState(window)
      })
    }
  }
}
