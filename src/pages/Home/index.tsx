import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AddToQueueButton from '../../components/library/AddToQueueButton'
import CollectionActionMenu from '../../components/library/CollectionActionMenu'
import FolderImportButton from '../../components/library/FolderImportButton'
import TrackActionMenu from '../../components/library/TrackActionMenu'
import CoverArtwork from '../../components/player/CoverArtwork'
import { useMinuteTicker } from '../../hooks/useMinuteTicker'
import {
  formatCollectionDuration,
  formatDuration,
  formatLibraryTimestamp,
  formatPlayedAt,
  formatRelativeTime
} from '../../lib/format'
import { buildAlbumSummaries, getAlbumRoute } from '../../lib/library'
import { resolvePersistedLibraryScanState } from '../../types/settings'
import {
  playTrackCommand,
  restartCurrentTrackCommand,
  togglePlaybackCommand
} from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useHistoryStore } from '../../store/historyStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

export default function HomePage() {
  useMinuteTicker()

  const tracks = useLibraryStore((state) => state.tracks)
  const lastScanStats = useLibraryStore((state) => state.lastScanStats)
  const settings = useSettingsStore((state) => state.settings)
  const settingsReady = useSettingsStore((state) => state.ready)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const albums = useMemo(() => buildAlbumSummaries(tracks), [tracks])
  const artistNameCount = useMemo(() => new Set(tracks.map((track) => track.artist)).size, [tracks])
  const topAlbums = useMemo(
    () =>
      [...albums]
        .sort(
          (left, right) =>
            right.trackCount - left.trackCount ||
            right.totalDuration - left.totalDuration ||
            left.name.localeCompare(right.name)
        )
        .slice(0, 3),
    [albums]
  )
  const recentEntries = useHistoryStore((state) => state.entries)
  const historyLoaded = useHistoryStore((state) => state.loaded)
  const historyLoading = useHistoryStore((state) => state.loading)
  const historyError = useHistoryStore((state) => state.error)
  const loadRecentHistory = useHistoryStore((state) => state.loadRecentHistory)
  const clearHistory = useHistoryStore((state) => state.clearHistory)
  const removeHistoryEntry = useHistoryStore((state) => state.removeHistoryEntry)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const queue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const progress = usePlayerStore((state) => state.progress)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const setQueueVisible = useUiStore((state) => state.setQueueVisible)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null)
  const nextUpTrack = currentTrack ? queue[currentIndex + 1] ?? null : null
  const queuedPreviewTracks = useMemo(
    () => (queue.length > 0 ? queue.slice(currentTrack ? currentIndex + 1 : 0, (currentTrack ? currentIndex + 1 : 0) + 4) : []),
    [currentIndex, currentTrack, queue]
  )
  const currentProgressRatio =
    currentTrack && currentTrack.duration > 0
      ? Math.min(Math.max(progress / currentTrack.duration, 0), 1)
      : 0
  const favoriteTracks = useMemo(() => tracks.filter((track) => track.isFavorite), [tracks])
  const recentTracks = useMemo(() => recentEntries.map((entry) => entry.track), [recentEntries])
  const freshTracks = useMemo(
    () =>
      [...tracks]
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
            right.createdAt.localeCompare(left.createdAt)
        )
        .slice(0, 4),
    [tracks]
  )
  const persistedLibraryScanState = resolvePersistedLibraryScanState(settings.libraryScanState)
  const visibleScanStats = lastScanStats ?? persistedLibraryScanState
  const visibleScanTimeLabel = visibleScanStats?.scannedAt
    ? formatRelativeTime(visibleScanStats.scannedAt)
    : null
  const visibleScanExactTimeLabel = visibleScanStats?.scannedAt
    ? new Date(visibleScanStats.scannedAt).toLocaleString()
    : null

  useEffect(() => {
    if (!historyLoaded) {
      void loadRecentHistory()
    }
  }, [historyLoaded, loadRecentHistory])

  useEffect(() => {
    if (!settingsReady) {
      void loadSettings()
    }
  }, [loadSettings, settingsReady])

  const handlePlayRecent = async (trackId: string) => {
    const queueIndex = tracks.findIndex((track) => track.id === trackId)

    if (queueIndex >= 0) {
      const track = playSelection(tracks, queueIndex)

      if (track) {
        await playTrackCommand(track)
      }

      return
    }

    const recentEntry = recentEntries.find((entry) => entry.trackId === trackId)

    if (!recentEntry) {
      return
    }

    const track = playSelection([recentEntry.track], 0)

    if (track) {
      await playTrackCommand(track)
    }
  }

  const handlePlayQueueTrack = async (trackId: string) => {
    const queueIndex = queue.findIndex((track) => track.id === trackId)

    if (queueIndex < 0) {
      return
    }

    const track = usePlayerStore.getState().selectQueueIndex(queueIndex)

    if (track) {
      await playTrackCommand(track)
    }
  }

  const handleClearHistory = async () => {
    if (recentEntries.length === 0 || historyLoading) {
      return
    }

    const shouldClear = window.confirm('Clear the recent play history?')

    if (!shouldClear) {
      return
    }

    const cleared = await clearHistory()

    if (cleared) {
      showFeedback('Cleared recent play history.')
    } else {
      showFeedback('Could not clear recent plays right now.', 'error')
    }
  }

  const handleRemoveHistoryEntry = async (historyId: string, trackTitle: string) => {
    if (historyLoading || removingEntryId === historyId) {
      return
    }

    setRemovingEntryId(historyId)

    try {
      const removed = await removeHistoryEntry(historyId)

      if (removed) {
        showFeedback(`Removed ${trackTitle} from recent plays.`)
      } else {
        showFeedback('Could not remove that history entry right now.', 'error')
      }
    } finally {
      setRemovingEntryId((current) => (current === historyId ? null : current))
    }
  }

  const handlePrimaryNowPlayingAction = async () => {
    if (!currentTrack) {
      return
    }

    if (isPlaying) {
      const restarted = await restartCurrentTrackCommand()

      if (restarted) {
        showFeedback(`Restarted ${currentTrack.title}.`)
      }
      return
    }

    await togglePlaybackCommand()
  }

  const handlePlayTrackList = async (
    trackList: typeof tracks,
    emptyMessage: string,
    feedbackMessage: string,
    shuffle = false
  ) => {
    if (trackList.length === 0) {
      showFeedback(emptyMessage, 'muted')
      return
    }

    const nextQueue = shuffle ? [...trackList] : trackList

    if (shuffle) {
      for (let index = nextQueue.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[nextQueue[index], nextQueue[swapIndex]] = [nextQueue[swapIndex], nextQueue[index]]
      }
    }

    const track = playSelection(nextQueue, 0)

    if (!track) {
      return
    }

    const started = await playTrackCommand(track)

    if (started) {
      showFeedback(feedbackMessage)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Quick Start</div>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-white">
            The desktop player now has real browsing, playlists, lyrics, and desktop controls.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Import local folders, scan metadata into SQLite, play tracks instantly, manage playlists,
            open album detail pages, and keep using tray controls and media keys.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <FolderImportButton />
            <Link
              to="/library/tracks"
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Open Track Library
            </Link>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Library Snapshot</div>
          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tracks</div>
              <div className="mt-3 text-3xl font-semibold text-white">{tracks.length}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Artist Tags</div>
              <div className="mt-3 text-3xl font-semibold text-white">{artistNameCount}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Albums</div>
              <div className="mt-3 text-3xl font-semibold text-white">{albums.length}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Library Runtime</div>
              <div className="mt-3 text-lg font-semibold text-white">
                {formatCollectionDuration(tracks.reduce((sum, track) => sum + track.duration, 0))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Last Scan</div>
              {visibleScanStats ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1">
                      +{visibleScanStats.addedCount}
                    </span>
                    <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1">
                      -{visibleScanStats.removedCount}
                    </span>
                    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1">
                      {visibleScanStats.updatedCount} Updated
                    </span>
                  </div>
                  {visibleScanTimeLabel ? (
                    <div className="mt-3 text-xs text-slate-400" title={visibleScanExactTimeLabel ?? undefined}>
                      {visibleScanTimeLabel}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-3 text-sm text-slate-400">No scan summary yet</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Now Playing</div>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {currentTrack ? currentTrack.title : 'Nothing is playing right now'}
              </h3>
            </div>
            {currentTrack ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                {isPlaying ? 'Playing' : 'Paused'}
              </span>
            ) : null}
          </div>

          {currentTrack ? (
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
                className="shrink-0 transition hover:scale-[1.02]"
              >
                <CoverArtwork
                  coverPath={currentTrack.coverPath}
                  title={currentTrack.title}
                  className="h-24 w-24 rounded-[1.6rem]"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
                  <span>
                    {currentTrack.artist}
                  </span>
                  <span className="text-slate-500">/</span>
                  <Link
                    to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
                    className="transition hover:text-white"
                  >
                    {currentTrack.album}
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    {formatDuration(currentTrack.duration)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    At {formatDuration(progress)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                    Queue {currentIndex + 1}/{queue.length}
                  </span>
                  {nextUpTrack ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                      Next {nextUpTrack.title}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span>Playback progress</span>
                    <span>
                      {formatDuration(progress)} / {formatDuration(currentTrack.duration)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-aurora via-sky-400 to-accent transition-[width]"
                      style={{ width: `${currentProgressRatio * 100}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handlePrimaryNowPlayingAction()}
                    className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    {isPlaying ? 'Restart Track' : 'Resume Track'}
                  </button>
                  <AddToQueueButton tracks={currentTrack} compact />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              Start any track from the library, an album page, search results, or a playlist and it
              will show up here with quick actions.
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Collection Pulse</div>
          <h3 className="mt-2 text-xl font-semibold text-white">What Rises To The Top</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Largest Album</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {topAlbums[0] ? `${topAlbums[0].name} by ${topAlbums[0].artist}` : 'Import music to rank albums'}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {topAlbums[0]
                  ? `${topAlbums[0].trackCount} tracks / ${formatCollectionDuration(topAlbums[0].totalDuration)}`
                  : 'Albums are ranked by track count, then runtime.'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artist Metadata</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {artistNameCount > 0 ? `${artistNameCount} artist names` : 'Import music to read artist tags'}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Artist values stay as local metadata for filtering, search, and table context.
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Instant Mixes</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Start From Familiar Ground</h3>
            </div>
            <Link to="/library/favorites" className="text-sm text-slate-300 hover:text-white">
              Open favorites
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Favorites Mix</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {favoriteTracks.length > 0 ? `${favoriteTracks.length} liked tracks ready` : 'No favorites yet'}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {favoriteTracks.length > 0
                  ? `${formatCollectionDuration(favoriteTracks.reduce((sum, track) => sum + track.duration, 0))} of saved picks`
                  : 'Tap Favorite on any track and it will show up here.'}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void handlePlayTrackList(
                      favoriteTracks,
                      'Add a few favorites first.',
                      `Playing your ${favoriteTracks.length}-track favorites mix.`
                    )
                  }
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Play Favorites
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handlePlayTrackList(
                      favoriteTracks,
                      'Add a few favorites first.',
                      'Shuffled your favorites mix.',
                      true
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                >
                  Shuffle
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Rotation</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {recentTracks.length > 0 ? `${recentTracks.length} recent tracks lined up` : 'No recent plays yet'}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {recentTracks.length > 0
                  ? 'Jump back into what you touched last without opening the history shelf.'
                  : 'Once you play a few tracks, the latest rotation will appear here.'}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void handlePlayTrackList(
                      recentTracks,
                      'Play something first to seed recent rotation.',
                      'Playing your recent rotation.'
                    )
                  }
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Play Recent
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handlePlayTrackList(
                      recentTracks,
                      'Play something first to seed recent rotation.',
                      'Shuffled your recent rotation.',
                      true
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                >
                  Shuffle
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Today In PulseLocal</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Your Listening Snapshot</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Favorites Ready</div>
              <div className="mt-2 text-lg font-semibold text-white">{favoriteTracks.length}</div>
              <div className="mt-2 text-xs text-slate-400">Tracks marked for easy return.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Rotation</div>
              <div className="mt-2 text-lg font-semibold text-white">{recentTracks.length}</div>
              <div className="mt-2 text-xs text-slate-400">Unique tracks from your latest plays.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Queue Depth</div>
              <div className="mt-2 text-lg font-semibold text-white">{queue.length}</div>
              <div className="mt-2 text-xs text-slate-400">
                {queue.length > 0 ? `Current slot ${currentIndex + 1} of ${queue.length}.` : 'Queue is idle right now.'}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Queue Snapshot</div>
              <h3 className="mt-2 text-xl font-semibold text-white">What Plays After This</h3>
            </div>
            <button
              type="button"
              onClick={() => setQueueVisible(true)}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Open Queue
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {queuedPreviewTracks.length > 0 ? (
              queuedPreviewTracks.map((track, index) => (
                <article
                  key={track.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void handlePlayQueueTrack(track.id)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <CoverArtwork
                        coverPath={track.coverPath}
                        title={track.title}
                        className="h-14 w-14 shrink-0 rounded-2xl"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{track.title}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                          <span>
                            {track.artist}
                          </span>
                          <span className="text-slate-500">/</span>
                          <Link
                            to={getAlbumRoute(track.artist, track.album)}
                            onClick={(event) => event.stopPropagation()}
                            className="truncate transition hover:text-white"
                          >
                            {track.album}
                          </Link>
                        </div>
                      </div>
                    </button>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        Up Next {index + 1}
                      </div>
                      <div className="mt-2 text-xs text-slate-300">{formatDuration(track.duration)}</div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                {queue.length > 0
                  ? 'There is nothing after the current track yet. Add more songs to grow the queue.'
                  : 'Build a queue from albums, artists, playlists, or search results and it will appear here.'}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Queue Notes</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Active Listening Context</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current Slot</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {queue.length > 0 ? `${currentIndex + 1} / ${queue.length}` : 'Queue idle'}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {currentTrack ? 'The queue is anchored to the current playback position.' : 'Start a track to establish queue flow.'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Upcoming Runtime</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatCollectionDuration(queuedPreviewTracks.reduce((sum, track) => sum + track.duration, 0))}
              </div>
              <div className="mt-2 text-xs text-slate-400">Listening time across the next visible queue slice.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Use this shelf to jump forward in the queue without opening the full drawer.
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Fresh Finds</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Recently Updated In Your Library</h3>
            </div>
            <Link to="/library/tracks" className="text-sm text-slate-300 hover:text-white">
              Browse all tracks
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {freshTracks.length > 0 ? (
              freshTracks.map((track) => (
                <article
                  key={track.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void handlePlayTrackList([track], 'Track unavailable.', `Playing ${track.title}.`)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <CoverArtwork
                        coverPath={track.coverPath}
                        title={track.title}
                        className="h-16 w-16 shrink-0 rounded-2xl"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{track.title}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                          <span>
                            {track.artist}
                          </span>
                          <span className="text-slate-500">/</span>
                          <Link
                            to={getAlbumRoute(track.artist, track.album)}
                            onClick={(event) => event.stopPropagation()}
                            className="truncate transition hover:text-white"
                          >
                            {track.album}
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          <span>{formatDuration(track.duration)}</span>
                          <span>{formatLibraryTimestamp(track.updatedAt)}</span>
                        </div>
                      </div>
                    </button>
                    <TrackActionMenu track={track} placement="bottom" compact buttonLabel="More" />
                  </div>
                </article>
              ))
            ) : (
              <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                Import a folder and recently updated tracks will surface here automatically.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Fresh Stats</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Latest Library Motion</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Updates</div>
              <div className="mt-2 text-lg font-semibold text-white">{freshTracks.length}</div>
              <div className="mt-2 text-xs text-slate-400">Tracks surfaced from the most recent file timestamps.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest Runtime</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatCollectionDuration(freshTracks.reduce((sum, track) => sum + track.duration, 0))}
              </div>
              <div className="mt-2 text-xs text-slate-400">How much listening sits inside the latest updates.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              This section uses local file timestamps, so it works best as a "what changed in the library"
              shelf after new imports or edited metadata.
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-aurora">Recent Plays</div>
            <h3 className="mt-2 text-xl font-semibold text-white">Pick Up Where You Left Off</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">
              {historyLoading ? 'Refreshing...' : `${recentEntries.length} entries`}
            </div>
            <button
              type="button"
              onClick={() => void handleClearHistory()}
              disabled={historyLoading || recentEntries.length === 0}
              className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recentEntries.length > 0 ? (
            recentEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:bg-white/10"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <TrackActionMenu
                    track={entry.track}
                    onRemove={() => void handleRemoveHistoryEntry(entry.id, entry.track.title)}
                  />
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {removingEntryId === entry.id ? 'Removing...' : formatPlayedAt(entry.playedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePlayRecent(entry.trackId)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <CoverArtwork
                    coverPath={entry.track.coverPath}
                    title={entry.track.title}
                    className="h-16 w-16 shrink-0 rounded-2xl"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{entry.track.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span>
                        {entry.track.artist}
                      </span>
                      <span className="text-slate-500">/</span>
                      <Link
                        to={getAlbumRoute(entry.track.artist, entry.track.album)}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate transition hover:text-white"
                      >
                        {entry.track.album}
                      </Link>
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatPlayedAt(entry.playedAt)}
                    </div>
                  </div>
                </button>
              </article>
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              {historyError
                ? historyError
                : 'No recent plays yet. Start any track and it will appear here automatically.'}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Top Albums</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Jump Back In</h3>
            </div>
            <Link to="/library/albums" className="text-sm text-slate-300 hover:text-white">
              View all
            </Link>
          </div>
          <div className="mt-5 grid gap-3">
            {topAlbums.length > 0 ? (
              topAlbums.map((album) => (
                <article
                  key={album.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4 transition hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={getAlbumRoute(album.artist, album.name)}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <CoverArtwork
                        coverPath={album.coverPath}
                        title={album.name}
                        className="h-16 w-16 shrink-0 rounded-2xl"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{album.name}</div>
                        <div className="mt-2 truncate text-xs text-slate-400">
                          {album.artist} / {album.trackCount} tracks
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {formatCollectionDuration(album.totalDuration)}
                        </div>
                      </div>
                    </Link>
                    <CollectionActionMenu
                      title={album.name}
                      tracks={album.tracks}
                      detailHref={getAlbumRoute(album.artist, album.name)}
                      detailLabel="Open Album"
                    />
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                Import a music folder to populate this section.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-aurora">Local Metadata</div>
            <h3 className="mt-2 text-xl font-semibold text-white">Artist Tags Stay Lightweight</h3>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artist Names</div>
              <div className="mt-2 text-2xl font-semibold text-white">{artistNameCount}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Artist is still indexed from file tags for search, sorting, and track context, but the app
                keeps navigation centered on tracks, albums, playlists, and local files.
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm leading-6 text-slate-400">
              This keeps the MVP closer to a desktop library manager instead of a streaming-style artist
              profile browser.
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
