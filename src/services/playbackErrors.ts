import { useFeedbackStore } from '../store/feedbackStore'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useSettingsStore } from '../store/settingsStore'
import { resolveAppSettings } from '../types/settings'
import type { Track } from '../types/track'

const DUPLICATE_ERROR_WINDOW_MS = 1200

let lastPlaybackErrorKey: string | null = null
let lastPlaybackErrorAt = 0

function getErrorDetail(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : null
}

function createRescanAction() {
  return {
    label: 'Rescan Library',
    onAction: () => {
      const settings = resolveAppSettings(useSettingsStore.getState().settings)
      const showFeedback = useFeedbackStore.getState().showFeedback

      if (settings.libraryPaths.length === 0) {
        showFeedback('No library folders are saved yet.', 'muted')
        return
      }

      showFeedback('Rescanning library...', 'muted', null, {
        detail: `${settings.libraryPaths.length} folder${settings.libraryPaths.length === 1 ? '' : 's'} queued.`
      })

      void (async () => {
        await useLibraryStore.getState().scanFolders(settings.libraryPaths)

        const libraryState = useLibraryStore.getState()

        if (libraryState.error) {
          showFeedback('Library rescan failed.', 'error', null, {
            detail: libraryState.error
          })
          return
        }

        showFeedback('Library rescan finished.', 'success', null, {
          detail: libraryState.lastScanStats
            ? `${libraryState.lastScanStats.addedCount} added, ${libraryState.lastScanStats.removedCount} removed, ${libraryState.lastScanStats.updatedCount} updated. ${libraryState.lastScanStats.totalCount} total indexed.`
            : `${libraryState.tracks.length} track${libraryState.tracks.length === 1 ? '' : 's'} available after cleanup.`
        })
      })()
    }
  }
}

export function reportPlaybackFailure(track: Track | null | undefined, error: unknown) {
  const detail = getErrorDetail(error) ?? track?.path ?? null
  const errorKey = `${track?.id ?? 'unknown'}:${detail ?? 'unknown'}`
  const now = Date.now()

  usePlayerStore.getState().setPlaying(false)
  usePlayerStore.getState().setProgress(0)

  if (lastPlaybackErrorKey === errorKey && now - lastPlaybackErrorAt < DUPLICATE_ERROR_WINDOW_MS) {
    return
  }

  lastPlaybackErrorKey = errorKey
  lastPlaybackErrorAt = now

  useFeedbackStore.getState().showFeedback(
    track ? `Could not play ${track.title}.` : 'Could not play the selected track.',
    'error',
    createRescanAction(),
    {
      detail
    }
  )
}
