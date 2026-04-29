import { useCallback } from 'react'
import { musicApi } from '../services/api'
import { useFeedbackStore } from '../store/feedbackStore'
import type { Track } from '../types/track'

type TrackSystemActionOptions = {
  onSuccess?: () => void
}

function getErrorDetail(error: unknown) {
  return error instanceof Error ? error.message : null
}

function getOptionalResourcePath(
  filePath: string | undefined,
  missingMessage: string,
  showFeedback: ReturnType<typeof useFeedbackStore.getState>['showFeedback']
) {
  if (!filePath) {
    showFeedback(missingMessage, 'muted')
    return null
  }

  return filePath
}

export function useTrackSystemActions() {
  const showFeedback = useFeedbackStore((state) => state.showFeedback)

  const showPathInFolder = useCallback(
    async (
      filePath: string,
      successMessage: string,
      failureMessage: string,
      options?: TrackSystemActionOptions
    ) => {
      try {
        await musicApi.showTrackInFolder(filePath)
        showFeedback(successMessage, 'success', null, {
          detail: filePath
        })
        options?.onSuccess?.()
        return true
      } catch (error) {
        showFeedback(failureMessage, 'error', null, {
          detail: getErrorDetail(error)
        })
        return false
      }
    },
    [showFeedback]
  )

  const openPathFile = useCallback(
    async (
      filePath: string,
      successMessage: string,
      failureMessage: string,
      options?: TrackSystemActionOptions
    ) => {
      try {
        await musicApi.openTrackFile(filePath)
        showFeedback(successMessage, 'success', null, {
          detail: filePath
        })
        options?.onSuccess?.()
        return true
      } catch (error) {
        showFeedback(failureMessage, 'error', null, {
          detail: getErrorDetail(error)
        })
        return false
      }
    },
    [showFeedback]
  )

  const copyPathToClipboard = useCallback(
    async (
      filePath: string,
      successMessage: string,
      failureMessage: string,
      options?: TrackSystemActionOptions
    ) => {
      try {
        await navigator.clipboard.writeText(filePath)
        showFeedback(successMessage, 'success', null, {
          detail: filePath
        })
        options?.onSuccess?.()
        return true
      } catch (error) {
        showFeedback(failureMessage, 'error', null, {
          detail: getErrorDetail(error)
        })
        return false
      }
    },
    [showFeedback]
  )

  const showTrackInFolder = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      return showPathInFolder(
        track.path,
        `Opened ${track.title} in its folder.`,
        'Could not open the track folder right now.',
        options
      )
    },
    [showPathInFolder]
  )

  const openTrackFile = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      return openPathFile(
        track.path,
        `Opened ${track.title} with the system player.`,
        'Could not open the track file right now.',
        options
      )
    },
    [openPathFile]
  )

  const showTrackLyricsInFolder = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const lyricPath = getOptionalResourcePath(
        track.lyricPath,
        'No lyric file was found for this track.',
        showFeedback
      )

      if (!lyricPath) {
        return false
      }

      return showPathInFolder(
        lyricPath,
        `Opened the lyric file folder for ${track.title}.`,
        'Could not open the lyric file folder right now.',
        options
      )
    },
    [showFeedback, showPathInFolder]
  )

  const openTrackLyricsFile = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const lyricPath = getOptionalResourcePath(
        track.lyricPath,
        'No lyric file was found for this track.',
        showFeedback
      )

      if (!lyricPath) {
        return false
      }

      return openPathFile(
        lyricPath,
        `Opened the lyric file for ${track.title}.`,
        'Could not open the lyric file right now.',
        options
      )
    },
    [openPathFile, showFeedback]
  )

  const showTrackCoverInFolder = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const coverPath = getOptionalResourcePath(
        track.coverPath,
        'No cover artwork file was found for this track.',
        showFeedback
      )

      if (!coverPath) {
        return false
      }

      return showPathInFolder(
        coverPath,
        `Opened the cover artwork folder for ${track.title}.`,
        'Could not open the cover artwork folder right now.',
        options
      )
    },
    [showFeedback, showPathInFolder]
  )

  const openTrackCoverFile = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const coverPath = getOptionalResourcePath(
        track.coverPath,
        'No cover artwork file was found for this track.',
        showFeedback
      )

      if (!coverPath) {
        return false
      }

      return openPathFile(
        coverPath,
        `Opened the cover artwork for ${track.title}.`,
        'Could not open the cover artwork file right now.',
        options
      )
    },
    [openPathFile, showFeedback]
  )

  const copyTrackPath = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      return copyPathToClipboard(
        track.path,
        `Copied file path for ${track.title}.`,
        'Could not copy the track path right now.',
        options
      )
    },
    [copyPathToClipboard]
  )

  const copyTrackLyricsPath = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const lyricPath = getOptionalResourcePath(
        track.lyricPath,
        'No lyric file was found for this track.',
        showFeedback
      )

      if (!lyricPath) {
        return false
      }

      return copyPathToClipboard(
        lyricPath,
        `Copied lyric file path for ${track.title}.`,
        'Could not copy the lyric file path right now.',
        options
      )
    },
    [copyPathToClipboard, showFeedback]
  )

  const copyTrackCoverPath = useCallback(
    async (track: Track, options?: TrackSystemActionOptions) => {
      const coverPath = getOptionalResourcePath(
        track.coverPath,
        'No cover artwork file was found for this track.',
        showFeedback
      )

      if (!coverPath) {
        return false
      }

      return copyPathToClipboard(
        coverPath,
        `Copied cover artwork path for ${track.title}.`,
        'Could not copy the cover artwork path right now.',
        options
      )
    },
    [copyPathToClipboard, showFeedback]
  )

  return {
    showTrackInFolder,
    openTrackFile,
    showTrackLyricsInFolder,
    openTrackLyricsFile,
    showTrackCoverInFolder,
    openTrackCoverFile,
    copyTrackPath,
    copyTrackLyricsPath,
    copyTrackCoverPath
  }
}
