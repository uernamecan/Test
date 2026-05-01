import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { closeDatabase, initDatabase } from './db/client'
import { registerMusicIpcHandlers } from './ipc/music'
import { registerSettingsIpcHandlers } from './ipc/settings'
import { registerWindowIpcHandlers } from './ipc/window'
import { createDesktopController } from './services/desktop'
import { createWindowStateManager } from './services/windowState'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null
const desktopController = createDesktopController()
const windowStateManager = createWindowStateManager()
const gotSingleInstanceLock = app.requestSingleInstanceLock()

function createMainWindow() {
  const { windowOptions, isMaximized } = windowStateManager.getLaunchState()
  const window = new BrowserWindow({
    ...windowOptions,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#08111b',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  window.once('ready-to-show', () => {
    window.show()
  })

  if (isMaximized) {
    window.maximize()
  }

  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  windowStateManager.bindWindow(window)

  return window
}

async function bootstrap() {
  initDatabase()
  registerMusicIpcHandlers()
  registerSettingsIpcHandlers((key, value) => {
    desktopController.updateSetting(key, value)
  })
  registerWindowIpcHandlers((playbackState) => {
    desktopController.updatePlaybackState(playbackState)
  })

  mainWindow = createMainWindow()
  desktopController.initialize(mainWindow)

  logger.info('Application bootstrapped')
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    desktopController.showWindow()
  })

  app.whenReady().then(() => {
    void bootstrap().catch((error) => {
      logger.error('Application bootstrap failed:', error)
      app.quit()
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        desktopController.bindWindow(mainWindow)
      }

      desktopController.showWindow()
    })
  })
}

app.on('before-quit', () => {
  desktopController.markQuitting()
})

app.on('will-quit', () => {
  desktopController.dispose()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
