import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../../components/common/EmptyState'
import AddToQueueButton from '../../components/library/AddToQueueButton'
import SearchInput from '../../components/common/SearchInput'
import TrackActionMenu from '../../components/library/TrackActionMenu'
import TrackTable from '../../components/library/TrackTable'
import CoverArtwork from '../../components/player/CoverArtwork'
import { useSaveTracksAsPlaylist } from '../../hooks/useSaveTracksAsPlaylist'
import { formatCollectionDuration, formatLibraryTimestamp } from '../../lib/format'
import { matchesSearchTerms } from '../../lib/search'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlayerStore } from '../../store/playerStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { useSettingsStore } from '../../store/settingsStore'
import { resolvePersistedPlaylistViewState } from '../../types/settings'
import type { Track } from '../../types/track'

type PlaylistSortOption = 'playlist-order' | 'title-asc' | 'artist-asc' | 'album-asc' | 'duration-desc' | 'recent-desc'
type TableDensity = 'comfortable' | 'compact'

const playlistSortOptions: Array<{ value: PlaylistSortOption; label: string }> = [
  { value: 'playlist-order', label: 'Playlist Order' },
  { value: 'recent-desc', label: 'Recently Updated' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'artist-asc', label: 'Artist A-Z' },
  { value: 'album-asc', label: 'Album A-Z' },
  { value: 'duration-desc', label: 'Longest First' }
]

function sortPlaylistTracks(tracks: Track[], sortBy: PlaylistSortOption) {
  if (sortBy === 'playlist-order') {
    return tracks
  }

  return [...tracks].sort((left, right) => {
    if (sortBy === 'recent-desc') {
      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
        left.title.localeCompare(right.title)
      )
    }

    if (sortBy === 'artist-asc') {
      return left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title)
    }

    if (sortBy === 'album-asc') {
      return left.album.localeCompare(right.album) || left.title.localeCompare(right.title)
    }

    if (sortBy === 'duration-desc') {
      return right.duration - left.duration || left.title.localeCompare(right.title)
    }

    return left.title.localeCompare(right.title) || left.artist.localeCompare(right.artist)
  })
}

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const selectedPlaylist = usePlaylistStore((state) => state.selectedPlaylist)
  const playlistTracks = usePlaylistStore((state) => state.playlistTracks)
  const loading = usePlaylistStore((state) => state.loading)
  const error = usePlaylistStore((state) => state.error)
  const loadPlaylistDetails = usePlaylistStore((state) => state.loadPlaylistDetails)
  const renamePlaylist = usePlaylistStore((state) => state.renamePlaylist)
  const removeTrackFromPlaylist = usePlaylistStore((state) => state.removeTrackFromPlaylist)
  const moveTrackInPlaylist = usePlaylistStore((state) => state.moveTrackInPlaylist)
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const saveTracksAsPlaylist = useSaveTracksAsPlaylist()
  const settingsReady = useSettingsStore((state) => state.ready)
  const persistedPlaylistViewState = useSettingsStore((state) => state.settings.playlistViewState)
  const saveSetting = useSettingsStore((state) => state.setSetting)
  const [draftName, setDraftName] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [sortBy, setSortBy] = useState<PlaylistSortOption>('playlist-order')
  const [density, setDensity] = useState<TableDensity>('comfortable')
  const [movingTrackId, setMovingTrackId] = useState<string | null>(null)
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const playlistViewHydratedRef = useRef(false)

  useEffect(() => {
    if (!id) {
      return
    }

    void loadPlaylistDetails(id)
  }, [id, loadPlaylistDetails])

  useEffect(() => {
    setDraftName(selectedPlaylist?.name ?? '')
  }, [selectedPlaylist?.name])

  useEffect(() => {
    setFilterKeyword('')
  }, [id])

  useEffect(() => {
    if (!settingsReady || playlistViewHydratedRef.current) {
      return
    }

    const persistedState = resolvePersistedPlaylistViewState(persistedPlaylistViewState)

    if (persistedState) {
      if (playlistSortOptions.some((option) => option.value === persistedState.sortBy)) {
        setSortBy(persistedState.sortBy as PlaylistSortOption)
      }

      setDensity(persistedState.density)
    }

    playlistViewHydratedRef.current = true
  }, [persistedPlaylistViewState, settingsReady])

  useEffect(() => {
    if (!playlistViewHydratedRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveSetting('playlistViewState', {
        sortBy,
        density
      }).catch(() => {
        showFeedback('Playlist view preferences could not be saved.', 'muted')
      })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [density, saveSetting, showFeedback, sortBy])

  useEffect(() => {
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
  }, [])

  const filteredTracks = useMemo(
    () =>
      playlistTracks.filter((track) =>
        matchesSearchTerms([track.title, track.artist, track.album], filterKeyword)
      ),
    [filterKeyword, playlistTracks]
  )
  const sortedFilteredTracks = useMemo(
    () => sortPlaylistTracks(filteredTracks, sortBy),
    [filteredTracks, sortBy]
  )
  const visibleDuration = useMemo(
    () => sortedFilteredTracks.reduce((sum, track) => sum + track.duration, 0),
    [sortedFilteredTracks]
  )
  const totalDuration = useMemo(
    () => playlistTracks.reduce((sum, track) => sum + track.duration, 0),
    [playlistTracks]
  )
  const artistCount = useMemo(
    () => new Set(playlistTracks.map((track) => track.artist)).size,
    [playlistTracks]
  )
  const albumCount = useMemo(
    () => new Set(playlistTracks.map((track) => `${track.artist}::${track.album}`)).size,
    [playlistTracks]
  )
  const playlistCreatedLabel = selectedPlaylist?.createdAt
    ? formatLibraryTimestamp(selectedPlaylist.createdAt)
    : 'Unknown date'
  const playlistUpdatedLabel = selectedPlaylist?.updatedAt
    ? formatLibraryTimestamp(selectedPlaylist.updatedAt)
    : 'Unknown date'
  const canReorderPlaylist = sortBy === 'playlist-order' && !filterKeyword.trim()

  const handlePlayTracks = async (tracks: typeof playlistTracks) => {
    if (tracks.length === 0) {
      return
    }

    const track = playSelection(tracks, 0)

    if (!track) {
      return
    }

    await playTrackCommand(track)
  }

  const handleShufflePlay = async () => {
    if (sortedFilteredTracks.length === 0) {
      return
    }

    const shuffledTracks = [...sortedFilteredTracks]

    for (let index = shuffledTracks.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffledTracks[index], shuffledTracks[swapIndex]] = [shuffledTracks[swapIndex], shuffledTracks[index]]
    }

    const track = playSelection(shuffledTracks, 0)

    if (!track) {
      return
    }

    const started = await playTrackCommand(track)

    if (started) {
      showFeedback(`Shuffled ${shuffledTracks.length} tracks from this playlist.`)
    }
  }

  const handleSaveVisibleAsPlaylist = async () => {
    const sourceName = selectedPlaylist?.name ?? 'Playlist'

    await saveTracksAsPlaylist({
      tracks: sortedFilteredTracks,
      defaultName: filterKeyword.trim() ? `${sourceName} - ${filterKeyword.trim()}` : `${sourceName} Copy`,
      promptMessage: 'Save the visible playlist tracks as:',
      emptyMessage: 'No visible tracks to save right now.',
      failureMessage: 'Could not save visible tracks as a playlist right now.'
    })
  }

  const handleRename = async () => {
    if (!id) {
      return
    }

    const trimmedName = draftName.trim()

    if (!trimmedName || trimmedName === selectedPlaylist?.name) {
      return
    }

    const playlist = await renamePlaylist(id, trimmedName)

    if (playlist) {
      showFeedback(`Renamed playlist to ${playlist.name}.`, 'success', null, {
        detail:
          playlist.name !== trimmedName
            ? 'PulseLocal normalized the requested name or added a number because it already existed.'
            : null
      })
    } else {
      showFeedback('Could not rename the playlist right now.', 'error')
    }
  }

  const handleDelete = async () => {
    if (!id) {
      return
    }

    const shouldDelete = window.confirm(
      `Delete playlist "${selectedPlaylist?.name ?? 'Untitled'}"? This cannot be undone.`
    )

    if (!shouldDelete) {
      return
    }

    const deleted = await deletePlaylist(id)

    if (deleted) {
      showFeedback(`Deleted ${selectedPlaylist?.name ?? 'playlist'}.`)
      navigate('/library/tracks')
    } else {
      showFeedback('Could not delete the playlist right now.', 'error')
    }
  }

  const handleRemoveTrack = async (trackId: string, trackTitle: string) => {
    if (!id) {
      return
    }

    setRemovingTrackId(trackId)

    try {
      const removed = await removeTrackFromPlaylist(id, trackId)

      if (removed) {
        showFeedback(`Removed ${trackTitle} from the playlist.`)
      } else {
        showFeedback('Could not remove that track right now.', 'error')
      }
    } finally {
      setRemovingTrackId((currentTrackId) => (currentTrackId === trackId ? null : currentTrackId))
    }
  }

  const handleMoveTrackToPosition = async (trackId: string, trackTitle: string, targetPosition: number) => {
    if (!id || !canReorderPlaylist) {
      return
    }

    const currentPosition = playlistTracks.findIndex((track) => track.id === trackId)

    if (currentPosition < 0) {
      return
    }

    const safeTargetPosition = Math.min(Math.max(targetPosition, 0), playlistTracks.length - 1)

    if (currentPosition === safeTargetPosition) {
      return
    }

    setMovingTrackId(trackId)

    try {
      const moved = await moveTrackInPlaylist(id, trackId, safeTargetPosition)

      if (moved) {
        const directionLabel =
          safeTargetPosition === 0
            ? 'to the top'
            : safeTargetPosition === playlistTracks.length - 1
              ? 'to the bottom'
              : safeTargetPosition < currentPosition
                ? 'up'
                : 'down'

        showFeedback(`Moved ${trackTitle} ${directionLabel} in the playlist.`)
      } else {
        showFeedback('Could not move that track right now.', 'error')
      }
    } finally {
      setMovingTrackId((currentTrackId) => (currentTrackId === trackId ? null : currentTrackId))
    }
  }

  if (!id) {
    return (
      <EmptyState
        title="Playlist Not Found"
        description="Choose a playlist from the sidebar or create a new one first."
      />
    )
  }

  if (error && !selectedPlaylist) {
    return <EmptyState title="Playlist Load Failed" description={error} />
  }

  if (!loading && !selectedPlaylist) {
    return (
      <EmptyState
        title="Playlist Not Found"
        description="This playlist does not exist yet, or it may have been removed."
      />
    )
  }
  return (
    <div className="grid gap-6">
      <section className="grid gap-6 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <CoverArtwork
            coverPath={selectedPlaylist?.coverPath}
            title={selectedPlaylist?.name}
            className="aspect-square w-full max-w-[180px] rounded-[28px]"
            fallbackLabel={(selectedPlaylist?.name ?? 'PL').slice(0, 2)}
          />
        </div>

        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Playlist</div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold text-white">
                {selectedPlaylist?.name ?? 'Loading...'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This page is wired to real playlist data from SQLite. You can rename, reorder,
                filter, save subsets, or delete it entirely.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={loading || !selectedPlaylist}
              className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete Playlist
            </button>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Playlist name"
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => void handleRename()}
              disabled={loading || !draftName.trim() || draftName.trim() === selectedPlaylist?.name}
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rename
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
            {playlistTracks.length} tracks in this playlist
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Created</div>
              <div className="mt-2 text-sm font-semibold text-white">{playlistCreatedLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Updated</div>
              <div className="mt-2 text-sm font-semibold text-white">{playlistUpdatedLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artwork</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {selectedPlaylist?.coverPath ? 'Track cover' : 'Fallback mark'}
              </div>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Playback</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Run This Playlist</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handlePlayTracks(sortedFilteredTracks)}
                disabled={sortedFilteredTracks.length === 0}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play All
              </button>
              <button
                type="button"
                onClick={() => void handleShufflePlay()}
                disabled={sortedFilteredTracks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Shuffle
              </button>
              <AddToQueueButton tracks={sortedFilteredTracks} />
              <button
                type="button"
                onClick={() => void handleSaveVisibleAsPlaylist()}
                disabled={sortedFilteredTracks.length === 0 || loading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Visible
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
            <SearchInput
              value={filterKeyword}
              onChange={setFilterKeyword}
              placeholder="Filter this playlist by track, artist, or album"
              inputRef={searchInputRef}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Sort
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as PlaylistSortOption)}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                {playlistSortOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Density
              </span>
              <select
                value={density}
                onChange={(event) => setDensity(event.target.value as TableDensity)}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                <option value="comfortable" className="bg-slate-950 text-white">
                  Comfortable
                </option>
                <option value="compact" className="bg-slate-950 text-white">
                  Compact
                </option>
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tracks</div>
              <div className="mt-2 text-lg font-semibold text-white">{playlistTracks.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artists</div>
              <div className="mt-2 text-lg font-semibold text-white">{artistCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Albums</div>
              <div className="mt-2 text-lg font-semibold text-white">{albumCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Visible Runtime</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatCollectionDuration(visibleDuration)}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Filter Status</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Focused Listening</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use the playlist filter to narrow by song, artist, or album, then play or queue only
            that slice.
          </p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Visible Tracks</div>
              <div className="mt-2 text-lg font-semibold text-white">{sortedFilteredTracks.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Active Filter</div>
              <div className="mt-2 text-sm text-slate-200">
                {filterKeyword.trim().length > 0 ? filterKeyword : 'Showing the full playlist'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Shortcut tips: press `/` to jump into the filter box, and `Esc` clears it while the
              field is focused.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sort</div>
              <div className="mt-2 text-sm text-slate-200">
                {playlistSortOptions.find((option) => option.value === sortBy)?.label ?? 'Playlist Order'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              {canReorderPlaylist
                ? 'Playlist order is editable here. Use Up and Down on tracks, or press Alt+Up / Alt+Down while the table is focused. Add Shift to jump straight to the top or bottom.'
                : 'Switch to Playlist Order and clear the filter to edit the saved order.'}
            </div>
          </div>
        </article>
      </section>

      {sortedFilteredTracks.length > 0 ? (
        <TrackTable
          tracks={sortedFilteredTracks}
          ariaLabel={`${selectedPlaylist?.name ?? 'Playlist'} track list`}
          onFocusSearch={() => {
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
          }}
          onClearSearch={() => setFilterKeyword('')}
          hasActiveSearch={Boolean(filterKeyword.trim())}
          onRemoveSelectedTrack={(track) => handleRemoveTrack(track.id, track.title)}
          removeBusyTrackId={removingTrackId}
          removeShortcutLabel="Remove Track"
          onMoveSelectedTrack={
            canReorderPlaylist
              ? (track, direction) => {
                  const currentPosition = playlistTracks.findIndex((playlistTrack) => playlistTrack.id === track.id)
                  const targetPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1
                  return handleMoveTrackToPosition(track.id, track.title, targetPosition)
                }
              : undefined
          }
          onMoveSelectedTrackToEdge={
            canReorderPlaylist
              ? (track, edge) =>
                  handleMoveTrackToPosition(
                    track.id,
                    track.title,
                    edge === 'top' ? 0 : playlistTracks.length - 1
                  )
              : undefined
          }
          moveBusyTrackId={movingTrackId}
          renderActions={(track) => (
            <div className="flex items-center justify-end gap-2">
              {canReorderPlaylist ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleMoveTrackToPosition(track.id, track.title, 0)}
                    disabled={playlistTracks[0]?.id === track.id || loading || movingTrackId !== null}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentPosition = playlistTracks.findIndex((playlistTrack) => playlistTrack.id === track.id)
                      void handleMoveTrackToPosition(track.id, track.title, currentPosition - 1)
                    }}
                    disabled={playlistTracks[0]?.id === track.id || loading || movingTrackId !== null}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentPosition = playlistTracks.findIndex((playlistTrack) => playlistTrack.id === track.id)
                      void handleMoveTrackToPosition(track.id, track.title, currentPosition + 1)
                    }}
                    disabled={playlistTracks[playlistTracks.length - 1]?.id === track.id || loading || movingTrackId !== null}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMoveTrackToPosition(track.id, track.title, playlistTracks.length - 1)}
                    disabled={playlistTracks[playlistTracks.length - 1]?.id === track.id || loading || movingTrackId !== null}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Bottom
                  </button>
                </>
              ) : null}
              <TrackActionMenu
                track={track}
                onRemove={() => void handleRemoveTrack(track.id, track.title)}
              />
            </div>
          )}
          density={density}
        />
      ) : (
        <EmptyState
          title={playlistTracks.length > 0 ? 'No Matching Tracks' : 'Playlist Is Empty'}
          description={
            playlistTracks.length > 0
              ? 'Try a different filter, or clear the current keyword to view the full playlist again.'
              : 'Open the library and use the Playlist action on any track to start building this list.'
          }
        />
      )}
    </div>
  )
}
