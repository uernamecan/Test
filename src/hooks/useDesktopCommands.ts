import { useEffect } from 'react'
import type { AppCommand } from '../../electron/types/ipc'
import { musicApi } from '../services/api'
import { playNextCommand, playPreviousCommand, togglePlaybackCommand } from '../services/playerCommands'
import { useUiStore } from '../store/uiStore'

async function handleAppCommand(command: AppCommand) {
  if (command === 'play-pause') {
    await togglePlaybackCommand()
  }

  if (command === 'next-track') {
    await playNextCommand()
  }

  if (command === 'previous-track') {
    await playPreviousCommand()
  }

  if (command === 'show-queue') {
    useUiStore.getState().setQueueVisible(true)
  }

  if (command === 'toggle-lyrics') {
    useUiStore.getState().toggleLyrics()
  }
}

export function useDesktopCommands() {
  useEffect(() => {
    return musicApi.onAppCommand((command) => {
      void handleAppCommand(command)
    })
  }, [])
}
