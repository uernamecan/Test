import { Link, useNavigate } from 'react-router-dom'
import { PLAY_MODE_LABELS } from '../../lib/constants'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTrackSystemActions } from '../../hooks/useTrackSystemActions'
import { formatDuration, formatTrackMeta } from '../../lib/format'
import { getAlbumRoute } from '../../lib/library'
import { playerService } from '../../services/player'
import { setTrackFavorite } from '../../services/favorites'
import {
  playNextCommand,
  playPreviousCommand,
  playTrackCommand,
  queueLastCommand,
  queueNextCommand,
  togglePlaybackCommand
} from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import type { Track } from '../../types/track'
import CoverArtwork from '../player/CoverArtwork'

type TrackTableProps = {
  tracks: Track[]
  renderActions?: (track: Track) => ReactNode
  density?: 'comfortable' | 'compact'
  ariaLabel?: string
  onFocusSearch?: () => void
  onClearSearch?: () => void
  hasActiveSearch?: boolean
  onRemoveSelectedTrack?: (track: Track) => Promise<void> | void
  removeBusyTrackId?: string | null
  removeShortcutLabel?: string
  onMoveSelectedTrack?: (track: Track, direction: 'up' | 'down') => Promise<void> | void
  onMoveSelectedTrackToEdge?: (track: Track, edge: 'top' | 'bottom') => Promise<void> | void
  moveBusyTrackId?: string | null
}

const BASE_GRID_COLUMNS = '80px minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.2fr) 120px 120px'
const GRID_WITH_ACTIONS = `${BASE_GRID_COLUMNS} 140px`

export default function TrackTable({
  tracks,
  renderActions,
  density = 'comfortable',
  ariaLabel = 'Track list',
  onFocusSearch,
  onClearSearch,
  hasActiveSearch = false,
  onRemoveSelectedTrack,
  removeBusyTrackId = null,
  removeShortcutLabel = 'Remove',
  onMoveSelectedTrack,
  onMoveSelectedTrackToEdge,
  moveBusyTrackId = null
}: TrackTableProps) {
  const navigate = useNavigate()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const playMode = usePlayerStore((state) => state.playMode)
  const volume = usePlayerStore((state) => state.volume)
  const duration = usePlayerStore((state) => state.duration)
  const setProgress = usePlayerStore((state) => state.setProgress)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const toggleMute = usePlayerStore((state) => state.toggleMute)
  const cyclePlayMode = usePlayerStore((state) => state.cyclePlayMode)
  const lyricsVisible = useUiStore((state) => state.lyricsVisible)
  const queueVisible = useUiStore((state) => state.queueVisible)
  const setQueueVisible = useUiStore((state) => state.setQueueVisible)
  const toggleQueue = useUiStore((state) => state.toggleQueue)
  const toggleLyrics = useUiStore((state) => state.toggleLyrics)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const {
    showTrackInFolder,
    openTrackFile,
    showTrackLyricsInFolder,
    openTrackLyricsFile,
    showTrackCoverInFolder,
    openTrackCoverFile,
    copyTrackPath,
    copyTrackLyricsPath,
    copyTrackCoverPath
  } = useTrackSystemActions()
  const hasActions = Boolean(renderActions)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [selectedIndexHint, setSelectedIndexHint] = useState(0)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [shortcutHelpVisible, setShortcutHelpVisible] = useState(false)
  const [favoriteBusyTrackId, setFavoriteBusyTrackId] = useState<string | null>(null)
  const headerPaddingClass = density === 'compact' ? 'px-5 py-3' : 'px-6 py-4'
  const rowPaddingClass = density === 'compact' ? 'px-5 py-3' : 'px-6 py-4'
  const artworkClassName = density === 'compact' ? 'h-10 w-10 shrink-0 rounded-lg' : 'h-12 w-12 shrink-0 rounded-xl'
  const titleClassName = density === 'compact' ? 'truncate text-[13px] font-semibold text-white' : 'truncate text-sm font-semibold text-white'
  const metaClassName = density === 'compact' ? 'mt-0.5 truncate text-[11px] text-slate-400' : 'mt-1 truncate text-xs text-slate-400'
  const cellTextClassName = density === 'compact' ? 'truncate text-[13px] text-slate-300' : 'truncate text-sm text-slate-300'
  const metricTextClassName = density === 'compact' ? 'text-[13px] text-slate-300' : 'text-sm text-slate-300'
  const selectedIndex = selectedTrackId ? tracks.findIndex((track) => track.id === selectedTrackId) : -1
  const resolvedSelectedIndex =
    selectedIndex >= 0
      ? selectedIndex
      : tracks.length > 0
        ? Math.min(Math.max(selectedIndexHint, 0), tracks.length - 1)
        : -1
  const selectedTrack = resolvedSelectedIndex >= 0 ? tracks[resolvedSelectedIndex] : null
  const activeDescendantId = selectedTrack ? `track-table-row-${selectedTrack.id}` : undefined
  const instructionsId = `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-instructions`
  const describedById = selectedTrack ? instructionsId : undefined
  const hasSelectedLyrics = Boolean(selectedTrack?.lyricPath)
  const hasSelectedCover = Boolean(selectedTrack?.coverPath)
  const canFocusSearch = Boolean(onFocusSearch)
  const canClearSearch = Boolean(onClearSearch) && hasActiveSearch
  const canRemoveSelectedTrack = Boolean(onRemoveSelectedTrack)
  const canMoveSelectedTrack = Boolean(onMoveSelectedTrack)
  const canMoveSelectedTrackToEdge = Boolean(onMoveSelectedTrackToEdge)
  const ariaKeyShortcuts = [
    'Enter',
    'Space',
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    'Alt+ArrowLeft',
    'Alt+ArrowRight',
    'Alt+Shift+ArrowLeft',
    'Alt+Shift+ArrowRight',
    '[',
    ']',
    '\\',
    'Control+C',
    'Meta+C',
    ...(hasSelectedLyrics || hasSelectedCover ? ['Control+Shift+C', 'Meta+Shift+C'] : []),
    'O',
    'Shift+O',
    'P',
    'Q',
    'Shift+Q',
    'F',
    'L',
    'K',
    'M',
    'N',
    'A',
    'Shift+Slash',
    ...(hasSelectedCover ? ['I', 'Shift+I'] : []),
    ...(hasSelectedLyrics ? ['Y', 'Shift+Y'] : []),
    ...(canFocusSearch ? ['Slash', 'Control+F', 'Meta+F'] : []),
    ...(canClearSearch || shortcutHelpVisible ? ['Escape'] : []),
    ...(canRemoveSelectedTrack ? ['Delete'] : []),
    ...(canMoveSelectedTrack ? ['Alt+ArrowUp', 'Alt+ArrowDown'] : []),
    ...(canMoveSelectedTrackToEdge ? ['Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown'] : [])
  ].join(' ')

  const selectTrackAtIndex = (trackIndex: number) => {
    const boundedIndex = Math.min(Math.max(trackIndex, 0), tracks.length - 1)
    const track = tracks[boundedIndex]

    if (!track) {
      return
    }

    setSelectedIndexHint(boundedIndex)
    setSelectedTrackId(track.id)
  }

  const shouldIgnoreRowSelection = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest('button, a, input, textarea, select, [role="menu"], [role="dialog"]'))

  const playTrack = async (trackIndex: number) => {
    const nextTrack = playSelection(tracks, trackIndex)

    if (nextTrack) {
      await playTrackCommand(nextTrack)
    }
  }

  const handleQueueSelectedTrack = (track: Track, position: 'next' | 'last') => {
    const result = position === 'next' ? queueNextCommand(track) : queueLastCommand(track)

    if (!result) {
      showFeedback('This track is already in the queue.', 'muted')
      return
    }

    setQueueVisible(true)
    showFeedback(
      position === 'next'
        ? `Queued ${track.title} to play next.`
        : `Added ${track.title} to the queue.`,
      'success',
      {
        label: 'Open Queue',
        onAction: () => setQueueVisible(true)
      }
    )
  }

  const handleToggleLyricsPanel = () => {
    if (!currentTrack) {
      showFeedback('Start playing a track to view lyrics.', 'muted')
      return
    }

    toggleLyrics()
  }

  const handleJumpToCurrentTrack = () => {
    if (!currentTrack) {
      showFeedback('Nothing is playing right now.', 'muted')
      return
    }

    const currentTrackIndex = tracks.findIndex((track) => track.id === currentTrack.id)

    if (currentTrackIndex < 0) {
      showFeedback('The current track is not in this list.', 'muted')
      return
    }

    selectTrackAtIndex(currentTrackIndex)
    containerRef.current?.focus()
  }

  const handleFocusSearch = () => {
    if (!onFocusSearch) {
      return
    }

    onFocusSearch()
  }

  const handleClearSearch = () => {
    if (!onClearSearch) {
      return
    }

    onClearSearch()
  }

  const handleOpenSelectedDetail = (route: string) => {
    navigate(route)
  }

  const handleToggleQueueDrawer = () => {
    toggleQueue()
  }

  const handleCyclePlayMode = () => {
    cyclePlayMode()
    const nextPlayMode = usePlayerStore.getState().playMode
    showFeedback(`Playback mode: ${PLAY_MODE_LABELS[nextPlayMode]}.`, 'muted')
  }

  const handleAdjustVolume = (delta: number) => {
    const nextVolume = Math.min(1, Math.max(0, volume + delta))
    setVolume(nextVolume)
    playerService.setVolume(nextVolume)
    showFeedback(`Volume ${Math.round(nextVolume * 100)}%.`, 'muted')
  }

  const handleSeekPlayback = (delta: number) => {
    if (!currentTrack) {
      showFeedback('Nothing is playing right now.', 'muted')
      return
    }

    const currentTime = playerService.getCurrentTime()
    const safeDuration = Math.max(duration || currentTrack.duration || 0, 0)
    const nextProgress = Math.min(Math.max(currentTime + delta, 0), safeDuration || currentTime + delta)
    playerService.seekTo(nextProgress)
    setProgress(nextProgress)
  }

  const handleToggleMute = () => {
    const nextVolume = toggleMute()
    playerService.setVolume(nextVolume)

    if (nextVolume === 0) {
      showFeedback('Muted.', 'muted')
      return
    }

    showFeedback(`Volume ${Math.round(nextVolume * 100)}%.`, 'muted')
  }

  const handleOpenSelectedTrackFolder = async (track: Track) => {
    await showTrackInFolder(track)
  }

  const handleOpenSelectedTrackFile = async (track: Track) => {
    await openTrackFile(track)
  }

  const handleCopySelectedTrackPath = async (track: Track) => {
    await copyTrackPath(track)
  }

  const handleCopySelectedResourcePath = async (track: Track) => {
    if (track.lyricPath) {
      await copyTrackLyricsPath(track)
      return
    }

    if (track.coverPath) {
      await copyTrackCoverPath(track)
      return
    }

    showFeedback('No lyric or cover file was found for this track.', 'muted')
  }

  const handleOpenSelectedLyricsFile = async (track: Track) => {
    await openTrackLyricsFile(track)
  }

  const handleRevealSelectedLyricsFile = async (track: Track) => {
    await showTrackLyricsInFolder(track)
  }

  const handleOpenSelectedCoverFile = async (track: Track) => {
    await openTrackCoverFile(track)
  }

  const handleRevealSelectedCoverFile = async (track: Track) => {
    await showTrackCoverInFolder(track)
  }

  const toggleShortcutHelp = () => {
    setShortcutHelpVisible((visible) => !visible)
  }

  const handleToggleFavoriteSelectedTrack = async (track: Track) => {
    if (favoriteBusyTrackId) {
      return
    }

    setFavoriteBusyTrackId(track.id)

    try {
      await setTrackFavorite(track.id, !track.isFavorite)
      showFeedback(track.isFavorite ? `Removed ${track.title} from favorites.` : `Added ${track.title} to favorites.`)
    } catch {
      showFeedback('Could not update favorites right now.', 'error')
    } finally {
      setFavoriteBusyTrackId((currentTrackId) => (currentTrackId === track.id ? null : currentTrackId))
    }
  }

  const handleRemoveSelectedTrack = async (track: Track) => {
    if (!onRemoveSelectedTrack || removeBusyTrackId) {
      return
    }

    await onRemoveSelectedTrack(track)
  }

  const handleMoveSelectedTrack = async (track: Track, direction: 'up' | 'down') => {
    if (!onMoveSelectedTrack || moveBusyTrackId) {
      return
    }

    await onMoveSelectedTrack(track, direction)
  }

  const handleMoveSelectedTrackToEdge = async (track: Track, edge: 'top' | 'bottom') => {
    if (!onMoveSelectedTrackToEdge || moveBusyTrackId) {
      return
    }

    await onMoveSelectedTrackToEdge(track, edge)
  }

  useEffect(() => {
    if (tracks.length === 0) {
      setSelectedTrackId(null)
      setSelectedIndexHint(0)
      return
    }

    const activeIndex = currentTrack ? tracks.findIndex((track) => track.id === currentTrack.id) : -1

    if (activeIndex >= 0) {
      const activeTrackId = tracks[activeIndex]?.id ?? null

      setSelectedTrackId((current) => (current === activeTrackId ? current : activeTrackId))
      setSelectedIndexHint((current) => (current === activeIndex ? current : activeIndex))
      return
    }

    if (selectedTrackId) {
      const existingIndex = tracks.findIndex((track) => track.id === selectedTrackId)

      if (existingIndex >= 0) {
        setSelectedIndexHint((current) => (current === existingIndex ? current : existingIndex))
        return
      }
    }

    const fallbackIndex = Math.min(Math.max(selectedIndexHint, 0), tracks.length - 1)
    const fallbackTrackId = tracks[fallbackIndex]?.id ?? null

    setSelectedTrackId((current) => (current === fallbackTrackId ? current : fallbackTrackId))
    setSelectedIndexHint((current) => (current === fallbackIndex ? current : fallbackIndex))
  }, [currentTrack, selectedIndexHint, selectedTrackId, tracks])

  useEffect(() => {
    if (resolvedSelectedIndex < 0) {
      return
    }

    const selectedRow = rowRefs.current[resolvedSelectedIndex]

    if (selectedRow) {
      selectedRow.scrollIntoView({
        block: 'nearest'
      })
    }
  }, [resolvedSelectedIndex])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (tracks.length === 0) {
      return
    }

    const target = event.target

    if (
      target instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
    ) {
      return
    }

    if (event.altKey && event.key === 'ArrowUp' && selectedTrack && canMoveSelectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey && canMoveSelectedTrackToEdge) {
        void handleMoveSelectedTrackToEdge(selectedTrack, 'top')
        return
      }

      void handleMoveSelectedTrack(selectedTrack, 'up')
      return
    }

    if (event.altKey && event.key === 'ArrowDown' && selectedTrack && canMoveSelectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey && canMoveSelectedTrackToEdge) {
        void handleMoveSelectedTrackToEdge(selectedTrack, 'bottom')
        return
      }

      void handleMoveSelectedTrack(selectedTrack, 'down')
      return
    }

    if (event.altKey && event.key === 'ArrowLeft' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      void playPreviousCommand()
      return
    }

    if (event.altKey && event.key === 'ArrowRight' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      void playNextCommand()
      return
    }

    if (event.altKey && event.shiftKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      handleSeekPlayback(-10)
      return
    }

    if (event.altKey && event.shiftKey && event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      handleSeekPlayback(10)
      return
    }

    if (event.key === '[' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleAdjustVolume(-0.05)
      return
    }

    if (event.key === ']' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleAdjustVolume(0.05)
      return
    }

    if (event.key === '\\' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleToggleMute()
      return
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'c' && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        void handleCopySelectedResourcePath(selectedTrack)
        return
      }

      void handleCopySelectedTrackPath(selectedTrack)
      return
    }

    if ((event.key === 'o' || event.key === 'O') && !event.ctrlKey && !event.metaKey && !event.altKey && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        void handleOpenSelectedTrackFile(selectedTrack)
        return
      }

      void handleOpenSelectedTrackFolder(selectedTrack)
      return
    }

    if ((event.key === 'y' || event.key === 'Y') && !event.ctrlKey && !event.metaKey && !event.altKey && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        void handleRevealSelectedLyricsFile(selectedTrack)
        return
      }

      void handleOpenSelectedLyricsFile(selectedTrack)
      return
    }

    if ((event.key === 'i' || event.key === 'I') && !event.ctrlKey && !event.metaKey && !event.altKey && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        void handleRevealSelectedCoverFile(selectedTrack)
        return
      }

      void handleOpenSelectedCoverFile(selectedTrack)
      return
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f' && canFocusSearch) {
      event.preventDefault()
      event.stopPropagation()
      handleFocusSearch()
      return
    }

    if (event.key === '/' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && canFocusSearch) {
      event.preventDefault()
      event.stopPropagation()
      handleFocusSearch()
      return
    }

    if (event.key === 'Escape' && shortcutHelpVisible) {
      event.preventDefault()
      event.stopPropagation()
      setShortcutHelpVisible(false)
      return
    }

    if (event.key === 'Escape' && canClearSearch) {
      event.preventDefault()
      event.stopPropagation()
      handleClearSearch()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(resolvedSelectedIndex + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(resolvedSelectedIndex - 1)
      return
    }

    if (event.key === 'PageDown') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(resolvedSelectedIndex + 10)
      return
    }

    if (event.key === 'PageUp') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(resolvedSelectedIndex - 10)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      selectTrackAtIndex(tracks.length - 1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void playTrack(resolvedSelectedIndex)
      return
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      event.stopPropagation()

      if (selectedTrack && currentTrack?.id === selectedTrack.id) {
        void togglePlaybackCommand()
        return
      }

      void playTrack(resolvedSelectedIndex)
      return
    }

    if ((event.key === 'q' || event.key === 'Q') && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()
      handleQueueSelectedTrack(selectedTrack, event.shiftKey ? 'next' : 'last')
      return
    }

    if ((event.key === 'f' || event.key === 'F') && selectedTrack) {
      event.preventDefault()
      event.stopPropagation()
      void handleToggleFavoriteSelectedTrack(selectedTrack)
      return
    }

    if ((event.key === 'l' || event.key === 'L') && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      event.stopPropagation()
      handleToggleLyricsPanel()
      return
    }

    if ((event.key === 'k' || event.key === 'K') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleToggleQueueDrawer()
      return
    }

    if ((event.key === 'm' || event.key === 'M') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleCyclePlayMode()
      return
    }

    if ((event.key === 'p' || event.key === 'P') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      void togglePlaybackCommand()
      return
    }

    if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      toggleShortcutHelp()
      return
    }

    if ((event.key === 'n' || event.key === 'N') && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      event.stopPropagation()
      handleJumpToCurrentTrack()
      return
    }

    if ((event.key === 'a' || event.key === 'A') && selectedTrack && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      handleOpenSelectedDetail(getAlbumRoute(selectedTrack.artist, selectedTrack.album))
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTrack && canRemoveSelectedTrack) {
      event.preventDefault()
      event.stopPropagation()
      void handleRemoveSelectedTrack(selectedTrack)
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="grid"
      aria-label={ariaLabel}
      aria-colcount={hasActions ? 7 : 6}
      aria-rowcount={tracks.length + 1}
      aria-activedescendant={activeDescendantId}
      aria-describedby={describedById}
      aria-keyshortcuts={ariaKeyShortcuts}
      onKeyDown={handleKeyDown}
      onFocus={() => setKeyboardFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setKeyboardFocused(false)
        }
      }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-aurora/60"
    >
      <div
        role="row"
        aria-rowindex={1}
        className={`grid gap-4 border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-400 ${headerPaddingClass}`}
        style={{ gridTemplateColumns: hasActions ? GRID_WITH_ACTIONS : BASE_GRID_COLUMNS }}
      >
        <span role="columnheader" aria-colindex={1}>#</span>
        <span role="columnheader" aria-colindex={2}>Title</span>
        <span role="columnheader" aria-colindex={3}>Artist</span>
        <span role="columnheader" aria-colindex={4}>Album</span>
        <span role="columnheader" aria-colindex={5}>Format</span>
        <span role="columnheader" aria-colindex={6}>Time</span>
        {hasActions ? <span role="columnheader" aria-colindex={7} className="text-right">Action</span> : null}
      </div>

      <div role="rowgroup" className="max-h-[56vh] overflow-y-auto">
        {tracks.map((track, index) => {
          const isActive = currentTrack?.id === track.id
          const isSelected = resolvedSelectedIndex === index

          return (
            <div
              key={track.id}
              id={`track-table-row-${track.id}`}
              role="row"
              aria-rowindex={index + 2}
              aria-current={isActive ? 'true' : undefined}
              aria-selected={isSelected}
              ref={(element) => {
                rowRefs.current[index] = element
              }}
              onMouseEnter={() => selectTrackAtIndex(index)}
              onClick={(event) => {
                if (!shouldIgnoreRowSelection(event.target)) {
                  selectTrackAtIndex(index)
                  containerRef.current?.focus()
                }
              }}
              onDoubleClick={(event) => {
                if (!shouldIgnoreRowSelection(event.target)) {
                  selectTrackAtIndex(index)
                  containerRef.current?.focus()
                  void playTrack(index)
                }
              }}
              className={`relative grid gap-4 transition ${rowPaddingClass} ${
                isActive
                  ? 'bg-aurora/20'
                  : isSelected
                    ? 'bg-white/8'
                    : 'hover:bg-white/5'
              }`}
              style={{ gridTemplateColumns: hasActions ? GRID_WITH_ACTIONS : BASE_GRID_COLUMNS }}
            >
              {isActive ? (
                <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-aurora shadow-[0_0_18px_rgba(45,212,191,0.55)]" />
              ) : null}
              <div
                className="grid gap-4"
                style={{
                  gridColumn: hasActions ? '1 / span 6' : '1 / -1',
                  gridTemplateColumns: BASE_GRID_COLUMNS
                }}
              >
                <span
                  role="gridcell"
                  aria-colindex={1}
                  className={`text-sm ${isActive ? 'font-semibold text-aurora' : 'text-slate-400'}`}
                >
                  {isActive ? 'PLAY' : String(index + 1).padStart(2, '0')}
                </span>
                <div role="gridcell" aria-colindex={2}>
                  <button
                    type="button"
                    onClick={() => void playTrack(index)}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <CoverArtwork
                      coverPath={track.coverPath}
                      title={track.title}
                      className={artworkClassName}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`min-w-0 flex-1 ${titleClassName}`}>{track.title}</div>
                        {track.isFavorite ? (
                          <span className="shrink-0 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200">
                            Favorite
                          </span>
                        ) : null}
                      </div>
                      <div className={metaClassName}>
                        {isActive ? 'Now Playing' : 'Click to Play'}
                      </div>
                    </div>
                  </button>
                </div>
                <div role="gridcell" aria-colindex={3}>
                  <span className={cellTextClassName}>
                    {track.artist}
                  </span>
                </div>
                <div role="gridcell" aria-colindex={4}>
                  <Link
                    to={getAlbumRoute(track.artist, track.album)}
                    className={`${cellTextClassName} transition hover:text-white`}
                  >
                    {track.album}
                  </Link>
                </div>
                <span role="gridcell" aria-colindex={5} className={metricTextClassName}>
                  {formatTrackMeta(track.format, track.bitrate)}
                </span>
                <span role="gridcell" aria-colindex={6} className={metricTextClassName}>
                  {formatDuration(track.duration)}
                </span>
              </div>

              {hasActions ? (
                <div role="gridcell" aria-colindex={7} className="flex items-center justify-end">
                  {renderActions?.(track)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {selectedTrack && shortcutHelpVisible ? (
        <div className="border-t border-white/10 bg-slate-950/85 px-5 py-4 text-sm text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-aurora">Keyboard Help</div>
              <div className="mt-1 text-xs text-slate-400">
                Shortcuts for the current track list context. Press <span className="font-semibold text-white">?</span> or <span className="font-semibold text-white">Esc</span> to close.
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              {selectedTrack.title}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Selection</div>
              <div className="mt-2 space-y-1 text-sm">
                <div><span className="text-white">Arrow Up/Down</span> move selection</div>
                <div><span className="text-white">Page Up/Down</span> jump 10 rows</div>
                <div><span className="text-white">Home/End</span> jump to first or last</div>
                <div><span className="text-white">N</span> jump to now playing</div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Playback</div>
              <div className="mt-2 space-y-1 text-sm">
                <div><span className="text-white">P</span> toggle current playback</div>
                <div><span className="text-white">Enter</span> play selected</div>
                <div><span className="text-white">Space</span> play selected or pause current</div>
                <div><span className="text-white">Alt+Left/Right</span> previous or next track</div>
                <div><span className="text-white">Alt+Shift+Left/Right</span> seek 10 seconds</div>
                <div><span className="text-white">[ / ]</span> volume down or up</div>
                <div><span className="text-white">\</span> mute or restore volume</div>
                <div><span className="text-white">Q / Shift+Q</span> queue end or next</div>
                <div><span className="text-white">M</span> cycle play mode</div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Panels</div>
              <div className="mt-2 space-y-1 text-sm">
                <div><span className="text-white">K</span> toggle queue drawer</div>
                <div><span className="text-white">L</span> toggle lyrics</div>
                <div><span className="text-white">/</span> focus filter</div>
                <div><span className="text-white">Ctrl/Cmd+F</span> focus filter</div>
                <div><span className="text-white">Esc</span> clear filter or close help</div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Details</div>
              <div className="mt-2 space-y-1 text-sm">
                <div><span className="text-white">A</span> open album</div>
                <div><span className="text-white">O</span> reveal in folder</div>
                <div><span className="text-white">Shift+O</span> open with system player</div>
                {hasSelectedCover ? (
                  <>
                    <div><span className="text-white">I</span> open cover artwork</div>
                    <div><span className="text-white">Shift+I</span> reveal cover artwork</div>
                  </>
                ) : null}
                {hasSelectedLyrics ? (
                  <>
                    <div><span className="text-white">Y</span> open lyric file</div>
                    <div><span className="text-white">Shift+Y</span> reveal lyric file</div>
                  </>
                ) : null}
                <div><span className="text-white">Ctrl/Cmd+C</span> copy file path</div>
                {hasSelectedLyrics || hasSelectedCover ? (
                  <div><span className="text-white">Ctrl/Cmd+Shift+C</span> copy lyric or cover path</div>
                ) : null}
                <div><span className="text-white">Double Click</span> play row</div>
                <div><span className="text-white">F</span> toggle favorite</div>
              </div>
            </div>
            {canRemoveSelectedTrack ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Playlist Editing</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div><span className="text-white">Delete</span> {removeShortcutLabel.toLowerCase()}</div>
                  {canMoveSelectedTrack ? (
                    <div><span className="text-white">Alt+Up/Down</span> reorder selected track</div>
                  ) : null}
                  {canMoveSelectedTrackToEdge ? (
                    <div><span className="text-white">Alt+Shift+Up/Down</span> move to top or bottom</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {selectedTrack ? (
        <div
          id={instructionsId}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-slate-300"
        >
          <div className="min-w-0">
            <span className="text-slate-500">Selected</span>{' '}
            <span className="font-semibold text-white">{selectedTrack.title}</span>{' '}
            <span className="text-slate-500">by</span>{' '}
            <span>{selectedTrack.artist}</span>
            <span className="ml-2 text-slate-500">
              {resolvedSelectedIndex + 1} of {tracks.length}
            </span>
            {selectedTrack.isFavorite ? (
              <span className="ml-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-rose-200">
                Favorite
              </span>
            ) : null}
            {currentTrack?.id === selectedTrack.id ? (
              <span className="ml-2 rounded-full border border-aurora/30 bg-aurora/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-aurora">
                Now Playing
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {keyboardFocused ? (
              <span className="rounded-full border border-aurora/30 bg-aurora/10 px-2 py-1 text-aurora">
                Keyboard Active
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 px-2 py-1">P</span>
            <span>Play/Pause Current</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Enter</span>
            <span>Play Selected</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Space</span>
            <span>{currentTrack?.id === selectedTrack.id ? 'Play/Pause Current' : 'Play Selected'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Home/End</span>
            <span>Jump</span>
            <span className="rounded-full border border-white/10 px-2 py-1">PgUp/PgDn</span>
            <span>Skip</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Alt+Left/Right</span>
            <span>Prev/Next</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Alt+Shift+Left/Right</span>
            <span>Seek 10s</span>
            <span className="rounded-full border border-white/10 px-2 py-1">[ / ]</span>
            <span>{Math.round(volume * 100)}% Vol</span>
            <span className="rounded-full border border-white/10 px-2 py-1">\</span>
            <span>{volume === 0 ? 'Unmute' : 'Mute'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Q</span>
            <span>Queue End</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Shift+Q</span>
            <span>Play Next</span>
            <span className="rounded-full border border-white/10 px-2 py-1">F</span>
            <span>{favoriteBusyTrackId === selectedTrack.id ? 'Saving Favorite' : 'Toggle Favorite'}</span>
            {canFocusSearch ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">/</span>
                <span>Focus Filter</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Ctrl/Cmd+F</span>
                <span>Focus Filter</span>
              </>
            ) : null}
            {canClearSearch ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Esc</span>
                <span>Clear Filter</span>
              </>
            ) : null}
            <span className="rounded-full border border-white/10 px-2 py-1">L</span>
            <span>{lyricsVisible ? 'Hide Lyrics' : 'Show Lyrics'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">K</span>
            <span>{queueVisible ? 'Hide Queue' : 'Show Queue'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">M</span>
            <span>{PLAY_MODE_LABELS[playMode]}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">?</span>
            <span>{shortcutHelpVisible ? 'Hide Help' : 'Show Help'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">N</span>
            <span>Now Playing</span>
            <span className="rounded-full border border-white/10 px-2 py-1">A</span>
            <span>Open Album</span>
            <span className="rounded-full border border-white/10 px-2 py-1">O</span>
            <span>Open Folder</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Shift+O</span>
            <span>Open File</span>
            {hasSelectedCover ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">I</span>
                <span>Open Cover</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Shift+I</span>
                <span>Reveal Cover</span>
              </>
            ) : null}
            {hasSelectedLyrics ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Y</span>
                <span>Open Lyrics</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Shift+Y</span>
                <span>Reveal Lyrics</span>
              </>
            ) : null}
            <span className="rounded-full border border-white/10 px-2 py-1">Ctrl/Cmd+C</span>
            <span>Copy Path</span>
            {hasSelectedLyrics || hasSelectedCover ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Ctrl/Cmd+Shift+C</span>
                <span>Copy Resource Path</span>
              </>
            ) : null}
            {canRemoveSelectedTrack ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Delete</span>
                <span>{removeBusyTrackId === selectedTrack.id ? `${removeShortcutLabel}...` : removeShortcutLabel}</span>
              </>
            ) : null}
            {canMoveSelectedTrack ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Alt+Up/Down</span>
                <span>{moveBusyTrackId === selectedTrack.id ? 'Reordering...' : 'Reorder'}</span>
              </>
            ) : null}
            {canMoveSelectedTrackToEdge ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Alt+Shift+Up/Down</span>
                <span>{moveBusyTrackId === selectedTrack.id ? 'Moving...' : 'Top/Bottom'}</span>
              </>
            ) : null}
            <span className="rounded-full border border-white/10 px-2 py-1">Double Click</span>
            <span>Play Row</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
