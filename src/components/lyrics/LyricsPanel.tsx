import { useEffect, useMemo, useRef, useState } from 'react'
import { clampLyricsPanelWidth, DEFAULT_LYRICS_PANEL_WIDTH } from '../../lib/shell'
import { formatDuration } from '../../lib/format'
import { playerService } from '../../services/player'
import { useLyricsStore } from '../../store/lyricsStore'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'

function getActiveLyricIndex(progress: number, times: number[]) {
  if (times.length === 0) {
    return -1
  }

  for (let index = times.length - 1; index >= 0; index -= 1) {
    if (progress >= times[index]) {
      return index
    }
  }

  return -1
}

export default function LyricsPanel() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const progress = usePlayerStore((state) => state.progress)
  const lyricsVisible = useUiStore((state) => state.lyricsVisible)
  const lyricsPanelWidth = useUiStore((state) => state.lyricsPanelWidth)
  const setLyricsPanelWidth = useUiStore((state) => state.setLyricsPanelWidth)
  const toggleLyrics = useUiStore((state) => state.toggleLyrics)
  const lyricPath = useLyricsStore((state) => state.lyricPath)
  const lines = useLyricsStore((state) => state.lines)
  const loading = useLyricsStore((state) => state.loading)
  const error = useLyricsStore((state) => state.error)
  const loadLyrics = useLyricsStore((state) => state.loadLyrics)
  const clearLyrics = useLyricsStore((state) => state.clearLyrics)
  const activeLineRef = useRef<HTMLButtonElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!lyricsVisible) {
      return
    }

    void loadLyrics(currentTrack?.lyricPath)
  }, [currentTrack?.lyricPath, loadLyrics, lyricsVisible])

  useEffect(() => {
    if (!currentTrack?.lyricPath && lyricPath) {
      clearLyrics()
    }
  }, [clearLyrics, currentTrack?.lyricPath, lyricPath])

  const lineTimes = useMemo(() => lines.map((line) => line.time), [lines])
  const activeIndex = useMemo(() => getActiveLyricIndex(progress, lineTimes), [lineTimes, progress])
  const activeLine = activeIndex >= 0 ? lines[activeIndex] : null
  const nextLine =
    activeIndex >= 0 && activeIndex < lines.length - 1
      ? lines[activeIndex + 1]
      : activeIndex < 0
        ? lines[0] ?? null
        : null
  const lyricsStatusLabel = !currentTrack
    ? 'Idle'
    : !currentTrack.lyricPath
      ? 'Missing LRC'
      : loading
        ? 'Loading'
        : error
          ? 'Error'
          : lines.length > 0
            ? 'Synced'
            : 'Unreadable'
  const lyricsStatusTone = !currentTrack
    ? 'border-white/10 bg-white/5 text-slate-400'
    : !currentTrack.lyricPath
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
      : loading
        ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
        : error
          ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
          : lines.length > 0
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
            : 'border-white/10 bg-white/5 text-slate-400'
  const currentLineLabel = activeLine?.text ?? (lines.length > 0 ? 'Waiting for the first timed line.' : 'No active lyric line yet.')
  const nextLineLabel = nextLine?.text ?? 'No next line queued.'

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }, [activeIndex])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      setLyricsPanelWidth(
        clampLyricsPanelWidth(dragState.startWidth - (event.clientX - dragState.startX))
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
  }, [isResizing, setLyricsPanelWidth])

  useEffect(() => {
    if (!lyricsVisible || isResizing) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (event.key === 'Escape' && !isTypingTarget) {
        toggleLyrics()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isResizing, lyricsVisible, toggleLyrics])

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = clampLyricsPanelWidth(lyricsPanelWidth)

      if (nextWidth !== lyricsPanelWidth) {
        setLyricsPanelWidth(nextWidth)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [lyricsPanelWidth, setLyricsPanelWidth])

  if (!lyricsVisible) {
    return null
  }

  return (
    <aside
      className="absolute bottom-28 right-6 z-30 rounded-3xl border border-white/10 bg-slate-950/92 p-5 shadow-soft backdrop-blur-xl"
      style={{
        width: `${lyricsPanelWidth}px`,
        maxWidth: 'calc(100vw - 8rem)'
      }}
    >
      <button
        type="button"
        aria-label="Resize lyrics panel"
        title="Drag to resize. Double-click to reset."
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }

          event.preventDefault()
          dragStateRef.current = {
            startX: event.clientX,
            startWidth: lyricsPanelWidth
          }
          setIsResizing(true)
        }}
        onDoubleClick={() => {
          setLyricsPanelWidth(DEFAULT_LYRICS_PANEL_WIDTH)
        }}
        className={`absolute inset-y-8 -left-3 flex w-6 items-center justify-center rounded-full border border-white/10 bg-slate-950/95 text-[10px] uppercase tracking-[0.22em] text-slate-400 transition ${
          isResizing ? 'bg-aurora/20 text-white' : 'hover:bg-white/10'
        }`}
        style={{ touchAction: 'none' }}
      >
        ||
      </button>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Lyrics</h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            {currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : 'No track selected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLyricsPanelWidth(DEFAULT_LYRICS_PANEL_WIDTH)
            }}
            className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Reset Width
          </button>
          <button
            type="button"
            onClick={toggleLyrics}
            className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${lyricsStatusTone}`}
          >
            {lyricsStatusLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
            {currentTrack ? formatDuration(progress) : '00:00'}
          </span>
          {activeLine ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              Active {formatDuration(activeLine.time)}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current Line</div>
            <div className="mt-2 text-sm leading-6 text-white">{currentLineLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Next Line</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">{nextLineLabel}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        {!currentTrack ? (
          <div className="px-3 py-12 text-center text-sm text-slate-400">
            Start playing a track to view synced lyrics.
          </div>
        ) : null}

        {currentTrack && !currentTrack.lyricPath ? (
          <div className="px-3 py-12 text-center text-sm text-slate-400">
            No `.lrc` file was found beside this track.
          </div>
        ) : null}

        {currentTrack?.lyricPath && loading ? (
          <div className="px-3 py-12 text-center text-sm text-slate-400">Loading lyrics...</div>
        ) : null}

        {currentTrack?.lyricPath && error ? (
          <div className="px-3 py-12 text-center text-sm text-rose-200">{error}</div>
        ) : null}

        {currentTrack?.lyricPath && !loading && !error && lines.length === 0 ? (
          <div className="px-3 py-12 text-center text-sm text-slate-400">
            The lyric file was found, but no timed lines could be parsed.
          </div>
        ) : null}

        {currentTrack?.lyricPath && lines.length > 0 ? (
          <div className="max-h-[24rem] space-y-1 overflow-y-auto px-1 py-2">
            {lines.map((line, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  key={`${line.time}-${line.text}-${index}`}
                  ref={isActive ? activeLineRef : null}
                  type="button"
                  onClick={() => {
                    playerService.seekTo(line.time)
                    usePlayerStore.getState().setProgress(line.time)
                  }}
                  className={`block w-full rounded-2xl px-4 py-3 text-left text-sm leading-6 transition ${
                    isActive
                      ? 'bg-aurora/20 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  {line.text}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
