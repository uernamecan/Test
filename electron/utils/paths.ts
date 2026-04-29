import fs from 'node:fs'
import path from 'node:path'

export function resolveUserDataPath() {
  try {
    const electron = require('electron') as typeof import('electron')

    if (electron.app?.getPath) {
      const userDataPath = electron.app.getPath('userData')
      fs.mkdirSync(userDataPath, { recursive: true })
      return userDataPath
    }
  } catch {
    // Running outside Electron, fall back to a local project folder.
  }

  const fallbackPath = path.join(process.cwd(), '.local-data')
  fs.mkdirSync(fallbackPath, { recursive: true })
  return fallbackPath
}

export function getDatabasePath() {
  return path.join(resolveUserDataPath(), 'music-player.db')
}

export function getArtworkCacheDir() {
  const artworkPath = path.join(resolveUserDataPath(), 'artwork-cache')
  fs.mkdirSync(artworkPath, { recursive: true })
  return artworkPath
}

