/// <reference types="vite/client" />

import type { MusicAPI } from '../electron/types/ipc'

declare global {
  interface Window {
    musicAPI: MusicAPI
  }
}

export {}
