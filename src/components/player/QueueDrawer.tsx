import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useSaveTracksAsPlaylist } from '../../hooks/useSaveTracksAsPlaylist'
import { PLAY_MODE_LABELS } from '../../lib/constants'
import {
  clampQueueDrawerWidth,
  DEFAULT_QUEUE_DRAWER_WIDTH
} from '../../lib/shell'
import { formatCollectionDuration, formatDuration } from '../../lib/format'
import { matchesSearchTerms } from '../../lib/search'
import {
  clearQueueCommand,
  moveQueueItemCommand,
  playTrackCommand,
  removeQueueItemCommand
} from '../../services/playerCommands'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import SearchInput from '../common/SearchInput'
import CoverArtwork from './CoverArtwork'

export default function QueueDrawer() {
  const navigate = useNavigate()
  const queueVisible = useUiStore((state) => state.queueVisible)
  const toggleQueue = useUiStore((state) => state.toggleQueue)
  const queueDrawerWidth = useUiStore((state) => state.queueDrawerWidth)
  const setQueueDrawerWidth = useUiStore((state) => state.setQueueDrawerWidth)
  const queue = usePlayerStore((state) => state.queue)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const playMode = usePlayerStore((state) => state.playMode)
  const selectQueueIndex = usePlayerStore((state) => state.selectQueueIndex)
  const saveTracksAsPlaylist = useSaveTracksAsPlaylist()
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const currentTrackRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null)
  const [filterKeyword, setFilterKeyword] = useState('')
  const nextTrack = currentTrack ? queue[currentIndex + 1] ?? null : null
  const queuePositionLabel =
    currentTrack && queue.length > 0 ? `${currentIndex + 1} of ${queue.length}` : 'Queue idle'
  const modeDescription =
    playMode === 'sequence'
      ? 'Plays forward through the current queue.'
      : playMode === 'repeat-all'
        ? 'Loops back to the start when the queue ends.'
        : playMode === 'repeat-one'
          ? 'Keeps replaying the current track.'
          : 'Picks upcoming tracks in shuffled order.'
  const filteredQueue = useMemo(() => {
    return queue.filter((track) =>
      matchesSearchTerms([track.title, track.artist, track.album], filterKeyword)
    )
  }, [filterKeyword, queue])
  const hasQueueFilter = filterKeyword.trim().length > 0
  const filteredDuration = useMemo(
    () => filteredQueue.reduce((total, track) => total + track.duration, 0),
    [filteredQueue]
  )

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      setQueueDrawerWidth(
        clampQueueDrawerWidth(dragState.startWidth - (event.clientX - dragState.startX))
      )
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, setQueueDrawerWidth])

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = clampQueueDrawerWidth(queueDrawerWidth)

      if (nextWidth !== queueDrawerWidth) {
        setQueueDrawerWidth(nextWidth)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [queueDrawerWidth, setQueueDrawerWidth])

  useEffect(() => {
    if (!queueVisible) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (event.key === '/' && !isTypingTarget) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setFilterKeyword('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [queueVisible])

  useEffect(() => {
    if (!queueVisible || !currentTrackRef.current) {
      return
    }

    currentTrackRef.current.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    })
  }, [currentTrack?.id, queueVisible])

  const handlePlayQueueTrack = async (index: number) => {
    const nextTrack = selectQueueIndex(index)

    if (nextTrack) {
      await playTrackCommand(nextTrack)
    }
  }

  const handleMoveQueueTrack = (index: number, targetIndex: number) => {
    if (busyActionKey) {
      return
    }

    moveQueueItemCommand(index, targetIndex)
  }

  const handleRemoveQueueTrack = async (index: number, trackTitle: string) => {
    const actionKey = `remove:${index}`

    if (busyActionKey) {
      return
    }

    const removingCurrent = currentTrack?.id === queue[index]?.id
    const shouldRemove =
      !removingCurrent ||
      window.confirm(
        isPlaying
          ? `Remove "${trackTitle}" from the queue and jump to the next track?`
          : `Remove "${trackTitle}" from the queue and update the current selection?`
      )

    if (!shouldRemove) {
      return
    }

    setBusyActionKey(actionKey)

    try {
      await removeQueueItemCommand(index)
    } finally {
      setBusyActionKey((currentActionKey) =>
        currentActionKey === actionKey ? null : currentActionKey
      )
    }
  }

  const handleClearQueue = async () => {
    if (queue.length === 0 || busyActionKey) {
      return
    }

    const shouldClear = window.confirm(
      currentTrack
        ? 'Clear the entire queue and stop playback?'
        : 'Clear the entire queue?'
    )

    if (!shouldClear) {
      return
    }

    setBusyActionKey('clear')

    try {
      clearQueueCommand()
    } finally {
      setBusyActionKey(null)
    }
  }

  const handleSaveQueueAsPlaylist = async (tracksToSave = queue) => {
    if (tracksToSave.length === 0 || busyActionKey) {
      return
    }

    const now = new Date()
    const defaultName = `Queue ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    setBusyActionKey('save-playlist')

    try {
      await saveTracksAsPlaylist({
        tracks: tracksToSave,
        defaultName,
        promptMessage: 'Save these queue tracks as a playlist:',
        emptyMessage: 'No queue tracks to save right now.',
        failureMessage: 'Could not save the queue as a playlist right now.',
        onOpenPlaylist: (playlistId) => {
          navigate(`/playlists/${playlistId}`)
          toggleQueue()
        }
      })
    } finally {
      setBusyActionKey((currentActionKey) =>
        currentActionKey === 'save-playlist' ? null : currentActionKey
      )
    }
  }

  return (
    <aside
      className={cn(
        'absolute right-6 top-24 z-30 rounded-3xl border border-white/10 bg-slate-950/92 p-5 shadow-soft backdrop-blur-xl transition',
        queueVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      )}
      style={{
        width: `${queueDrawerWidth}px`,
        maxWidth: 'calc(100vw - 8rem)'
      }}
    >
      <button
        type="button"
        aria-label="Resize queue drawer"
        title="Drag to resize. Double-click to reset."
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }

          event.preventDefault()
          dragStateRef.current = {
            startX: event.clientX,
            startWidth: queueDrawerWidth
          }
          setIsResizing(true)
        }}
        onDoubleClick={() => {
          setQueueDrawerWidth(DEFAULT_QUEUE_DRAWER_WIDTH)
        }}
        className={`absolute inset-y-8 -left-3 flex w-6 items-center justify-center rounded-full border border-white/10 bg-slate-950/95 text-[10px] uppercase tracking-[0.22em] text-slate-400 transition ${
          isResizing ? 'bg-aurora/20 text-white' : 'hover:bg-white/10'
        }`}
        style={{ touchAction: 'none' }}
      >
        ||
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Queue</h3>
          <p className="mt-1 text-xs text-slate-500">
            {queue.length} tracks lined up{filterKeyword.trim() ? `, ${filteredQueue.length} visible` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQueueDrawerWidth(DEFAULT_QUEUE_DRAWER_WIDTH)
            }}
            className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Reset Width
          </button>
          <button
            type="button"
            onClick={() => void handleSaveQueueAsPlaylist()}
            disabled={queue.length === 0 || busyActionKey !== null}
            className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyActionKey === 'save-playlist' ? 'Saving' : 'Save Queue'}
          </button>
          <button
            type="button"
            onClick={() => void handleClearQueue()}
            disabled={queue.length === 0 || busyActionKey !== null}
            className="rounded-xl border border-red-400/30 px-3 py-1 text-xs text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyActionKey === 'clear' ? 'Clearing' : 'Clear Queue'}
          </button>
          <button
            type="button"
            onClick={toggleQueue}
            className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>

      {queue.length > 0 ? (
        <section className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              {PLAY_MODE_LABELS[playMode]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              {queuePositionLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              {isPlaying ? 'Playing' : 'Paused'}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Visible</div>
                    <div className="mt-2 text-sm font-semibold text-white">{filteredQueue.length} tracks</div>
                    <div className="mt-1 text-xs text-slate-400">{formatCollectionDuration(filteredDuration)}</div>
                  </div>
                  {hasQueueFilter ? (
                    <button
                      type="button"
                      onClick={() => void handleSaveQueueAsPlaylist(filteredQueue)}
                      disabled={filteredQueue.length === 0 || busyActionKey !== null}
                      className="rounded-xl border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save Visible
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Shortcuts</div>
                <div className="mt-2 text-xs leading-5 text-slate-300">
                  Press `/` to focus queue search, `Esc` to clear it.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current</div>
              <div className="mt-2 truncate text-sm font-semibold text-white">
                {currentTrack?.title ?? 'No active track'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="truncate">{currentTrack?.artist ?? 'Queue is ready when you are'}</span>
                {currentTrack ? <span>{formatDuration(currentTrack.duration)}</span> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Next Up</div>
              <div className="mt-2 truncate text-sm font-semibold text-white">
                {nextTrack?.title ?? 'No later track queued yet'}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="truncate">{nextTrack?.artist ?? modeDescription}</span>
                {nextTrack ? <span>{formatDuration(nextTrack.duration)}</span> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {queue.length > 0 ? (
        <div className="mb-4">
          <SearchInput
            value={filterKeyword}
            onChange={setFilterKeyword}
            placeholder="Filter queue by track, artist, or album"
            inputRef={searchInputRef}
          />
        </div>
      ) : null}

      <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
        {filteredQueue.length > 0 ? (
          filteredQueue.map((track) => {
            const index = queue.findIndex((queuedTrack) => queuedTrack.id === track.id)

            if (index < 0) {
              return null
            }

            return (
            <article
              key={track.id}
              ref={currentTrack?.id === track.id ? currentTrackRef : null}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 transition ${
                currentTrack?.id === track.id ? 'bg-aurora/20' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => void handlePlayQueueTrack(index)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <CoverArtwork
                  coverPath={track.coverPath}
                  title={track.title}
                  className="h-12 w-12 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-white">{track.title}</div>
                    {currentTrack?.id === track.id ? (
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-aurora">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span className="truncate">{track.artist}</span>
                    <span>{formatDuration(track.duration)}</span>
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Queue {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
              </button>
              <div className="grid gap-1 self-center">
                <button
                  type="button"
                  onClick={() => handleMoveQueueTrack(index, index - 1)}
                  disabled={busyActionKey !== null || index === 0}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveQueueTrack(index, index + 1)}
                  disabled={busyActionKey !== null || index === queue.length - 1}
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemoveQueueTrack(index, track.title)}
                  disabled={busyActionKey !== null}
                  className="rounded-lg border border-red-400/30 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyActionKey === `remove:${index}` ? 'Removing' : 'Remove'}
                </button>
              </div>
            </article>
            )
          })
        ) : queue.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
            No queue entries match this filter.
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
            Add a track to start building the queue.
          </div>
        )}
      </div>
    </aside>
  )
}
