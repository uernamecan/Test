import { useEffect, useRef, useState } from 'react'
import { resolveAppSettings } from '../types/settings'
import {
  buildLibraryImportChangeSummary,
  buildLibraryImportNoChangeSummary,
  getLibraryImportWarningAction,
  hasLibraryImportChanges
} from '../lib/libraryImportFeedback'
import { mergeLibrarySources } from '../lib/librarySources'
import { navigateToLibrarySourceSettings } from '../lib/navigation'
import { useFeedbackStore } from '../store/feedbackStore'
import { useLibraryStore } from '../store/libraryStore'
import { useSettingsStore } from '../store/settingsStore'

type DroppedFile = File & {
  path?: string
}

function getDroppedPaths(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return []
  }

  const paths = Array.from(dataTransfer.files)
    .map((file) => (file as DroppedFile).path)
    .filter((filePath): filePath is string => Boolean(filePath?.trim()))

  return Array.from(new Set(paths))
}

export function useLibraryDropImport() {
  const [draggingLibraryItems, setDraggingLibraryItems] = useState(false)
  const dragDepthRef = useRef(0)
  const loading = useLibraryStore((state) => state.loading)
  const scanFolders = useLibraryStore((state) => state.scanFolders)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current += 1
      setDraggingLibraryItems(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return
      }

      event.preventDefault()

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = loading ? 'none' : 'copy'
      }
    }

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

      if (dragDepthRef.current === 0) {
        setDraggingLibraryItems(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = 0
      setDraggingLibraryItems(false)

      if (loading) {
        showFeedback('The library is already scanning. Try dropping again after it finishes.', 'muted')
        return
      }

      const droppedPaths = getDroppedPaths(event.dataTransfer)

      if (droppedPaths.length === 0) {
        showFeedback('Could not read file paths from that drop.', 'error')
        return
      }

      const existingPaths = resolveAppSettings(useSettingsStore.getState().settings).libraryPaths
      const nextPaths = mergeLibrarySources(existingPaths, droppedPaths)

      void (async () => {
        await scanFolders(nextPaths)

        const error = useLibraryStore.getState().error

        if (error) {
          showFeedback('Could not import dropped items.', 'error', {
            label: 'Settings',
            onAction: navigateToLibrarySourceSettings
          }, {
            detail: error
          })
          return
        }

        const stats = useLibraryStore.getState().lastScanStats
        const warningAction = getLibraryImportWarningAction(stats)

        showFeedback('Dropped music imported.', 'success', warningAction, {
          detail: stats
            ? hasLibraryImportChanges(stats)
              ? buildLibraryImportChangeSummary(stats)
              : buildLibraryImportNoChangeSummary(stats, droppedPaths.length, 'source')
            : `${droppedPaths.length} source${droppedPaths.length === 1 ? '' : 's'} scanned.`
        })
      })().catch((error) => {
        showFeedback('Could not import dropped items.', 'error', {
          label: 'Settings',
          onAction: navigateToLibrarySourceSettings
        }, {
          detail: error instanceof Error ? error.message : 'Unexpected drag-and-drop import failure.'
        })
      })
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [loading, scanFolders, showFeedback])

  return {
    draggingLibraryItems
  }
}
