import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  Tray,
  nativeImage,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { existsSync } from 'node:fs'
import { getSetting } from '../db/repositories/settingsRepo'
import { logger } from '../utils/logger'
import type { AppCommand, DesktopPlaybackState } from '../types/ipc'
import { DEFAULT_APP_SETTINGS } from '../../src/types/settings'

type DesktopSettings = {
  trayEnabled: boolean
  globalShortcutsEnabled: boolean
  minimizeToTray: boolean
}

const APP_COMMAND_CHANNEL = 'app:command'
const emptyPlaybackState: DesktopPlaybackState = {
  trackTitle: null,
  artist: null,
  trackPath: null,
  isPlaying: false,
  queueLength: 0,
  currentIndex: 0
}

function truncateMenuLabel(value: string, maxLength = 42) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function getNowPlayingLabel(playbackState: DesktopPlaybackState) {
  if (!playbackState.trackTitle) {
    return 'No track loaded'
  }

  const status = playbackState.isPlaying ? 'Playing' : 'Paused'
  const trackLabel = playbackState.artist
    ? `${playbackState.trackTitle} - ${playbackState.artist}`
    : playbackState.trackTitle

  return `${status}: ${truncateMenuLabel(trackLabel)}`
}

function getQueueLabel(playbackState: DesktopPlaybackState) {
  if (!playbackState.trackTitle || playbackState.queueLength === 0) {
    return 'Queue idle'
  }

  return `Queue ${playbackState.currentIndex + 1}/${playbackState.queueLength}`
}

function createTrayIcon() {
  const traySvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#0f172a"/>
      <path d="M23 18v28.5a7.5 7.5 0 1 0 4 6.5V29.7l18-4.5V41.5a7.5 7.5 0 1 0 4 6.5V13z" fill="#f8fafc"/>
    </svg>
  `.trim()

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(traySvg)}`)
    .resize({ width: 16, height: 16 })
}

function readDesktopSettings(): DesktopSettings {
  return {
    trayEnabled: getSetting<boolean>('trayEnabled') ?? DEFAULT_APP_SETTINGS.trayEnabled,
    globalShortcutsEnabled:
      getSetting<boolean>('globalShortcutsEnabled') ?? DEFAULT_APP_SETTINGS.globalShortcutsEnabled,
    minimizeToTray:
      getSetting<boolean>('minimizeToTray') ?? DEFAULT_APP_SETTINGS.minimizeToTray
  }
}

export function createDesktopController() {
  let tray: Tray | null = null
  let mainWindow: BrowserWindow | null = null
  let isQuitting = false
  let settings = readDesktopSettings()
  let playbackState = emptyPlaybackState

  const sendCommand = (command: AppCommand) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    mainWindow.webContents.send(APP_COMMAND_CHANNEL, command)
  }

  const showWindowAndSendCommand = (command: AppCommand) => {
    showWindow()
    sendCommand(command)
  }

  const showWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    mainWindow.focus()
  }

  const hideWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    mainWindow.hide()
  }

  const toggleWindowVisibility = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (mainWindow.isVisible()) {
      hideWindow()
      return
    }

    showWindow()
  }

  const refreshTray = () => {
    if (!settings.trayEnabled) {
      tray?.destroy()
      tray = null
      return
    }

    if (!tray) {
      tray = new Tray(createTrayIcon())
      tray.on('click', toggleWindowVisibility)
    }

    tray.setToolTip(`PulseLocal - ${getNowPlayingLabel(playbackState)}`)

    const menuTemplate: MenuItemConstructorOptions[] = [
      {
        label: getNowPlayingLabel(playbackState),
        enabled: false
      },
      {
        label: getQueueLabel(playbackState),
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: showWindow
      },
      {
        label: 'Hide Window',
        click: hideWindow
      },
      { type: 'separator' },
      {
        label: playbackState.isPlaying ? 'Pause' : 'Play',
        click: () => sendCommand('play-pause')
      },
      {
        label: 'Previous Track',
        click: () => sendCommand('previous-track')
      },
      {
        label: 'Next Track',
        click: () => sendCommand('next-track')
      },
      { type: 'separator' },
      {
        label: 'Reveal Track in Folder',
        enabled: Boolean(playbackState.trackPath && existsSync(playbackState.trackPath)),
        click: () => {
          if (playbackState.trackPath && existsSync(playbackState.trackPath)) {
            shell.showItemInFolder(playbackState.trackPath)
          }
        }
      },
      {
        label: 'Open Track File',
        enabled: Boolean(playbackState.trackPath && existsSync(playbackState.trackPath)),
        click: () => {
          if (!playbackState.trackPath || !existsSync(playbackState.trackPath)) {
            return
          }

          void shell.openPath(playbackState.trackPath).then((errorMessage) => {
            if (errorMessage) {
              logger.warn('Failed to open track from tray:', errorMessage)
            }
          })
        }
      },
      { type: 'separator' },
      {
        label: 'Open Queue',
        click: () => showWindowAndSendCommand('show-queue')
      },
      {
        label: 'Toggle Lyrics',
        click: () => showWindowAndSendCommand('toggle-lyrics')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ]

    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate))
  }

  const registerShortcut = (accelerator: string, command: AppCommand) => {
    try {
      const registered = globalShortcut.register(accelerator, () => {
        sendCommand(command)
      })

      if (!registered) {
        logger.warn('Global shortcut registration failed:', accelerator)
      }
    } catch (error) {
      logger.warn('Global shortcut registration error:', accelerator, error)
    }
  }

  const refreshGlobalShortcuts = () => {
    globalShortcut.unregisterAll()

    if (!settings.globalShortcutsEnabled) {
      return
    }

    registerShortcut('MediaPlayPause', 'play-pause')
    registerShortcut('MediaNextTrack', 'next-track')
    registerShortcut('MediaPreviousTrack', 'previous-track')
  }

  const bindWindow = (window: BrowserWindow) => {
    mainWindow = window

    window.on('minimize', () => {
      if (settings.trayEnabled && settings.minimizeToTray) {
        setTimeout(() => {
          hideWindow()
        }, 0)
      }
    })

    window.on('close', (event) => {
      if (!isQuitting && settings.trayEnabled && settings.minimizeToTray) {
        event.preventDefault()
        hideWindow()
      }
    })
  }

  const updateSetting = (key: string, value: unknown) => {
    if (key === 'trayEnabled' && typeof value === 'boolean') {
      settings.trayEnabled = value
      refreshTray()
    }

    if (key === 'globalShortcutsEnabled' && typeof value === 'boolean') {
      settings.globalShortcutsEnabled = value
      refreshGlobalShortcuts()
    }

    if (key === 'minimizeToTray' && typeof value === 'boolean') {
      settings.minimizeToTray = value
    }
  }

  const dispose = () => {
    tray?.destroy()
    tray = null
    globalShortcut.unregisterAll()
  }

  return {
    initialize(window: BrowserWindow) {
      bindWindow(window)
      refreshTray()
      refreshGlobalShortcuts()
    },
    bindWindow,
    showWindow,
    updateSetting,
    updatePlaybackState(nextPlaybackState: DesktopPlaybackState) {
      playbackState = {
        ...nextPlaybackState,
        currentIndex: Math.min(nextPlaybackState.currentIndex, Math.max(nextPlaybackState.queueLength - 1, 0))
      }
      refreshTray()
    },
    markQuitting() {
      isQuitting = true
    },
    dispose
  }
}
