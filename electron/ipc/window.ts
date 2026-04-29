import { BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import type { DesktopPlaybackState } from '../types/ipc'

const desktopPlaybackStateSchema = z.object({
  trackTitle: z.string().trim().min(1).max(200).nullable(),
  artist: z.string().trim().min(1).max(200).nullable(),
  trackPath: z.string().trim().min(1).max(4096).nullable(),
  isPlaying: z.boolean(),
  queueLength: z.number().int().min(0).max(100000),
  currentIndex: z.number().int().min(0).max(100000)
})

export function registerWindowIpcHandlers(
  onDidUpdateDesktopPlaybackState?: (state: DesktopPlaybackState) => void
) {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender)

    if (!targetWindow) {
      return
    }

    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize()
      return
    }

    targetWindow.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('desktop:updatePlaybackState', async (_event, payload) => {
    const parsedPayload = desktopPlaybackStateSchema.parse(payload)
    onDidUpdateDesktopPlaybackState?.(parsedPayload)
  })
}
