import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import AddToQueueButton from '../../components/library/AddToQueueButton'
import EmptyState from '../../components/common/EmptyState'
import SearchInput from '../../components/common/SearchInput'
import AlbumGrid, { type AlbumSortOption } from '../../components/library/AlbumGrid'
import FolderImportButton from '../../components/library/FolderImportButton'
import MusicFileImportButton from '../../components/library/MusicFileImportButton'
import TrackLibraryActions from '../../components/library/TrackLibraryActions'
import TrackTable from '../../components/library/TrackTable'
import { useSaveTracksAsPlaylist } from '../../hooks/useSaveTracksAsPlaylist'
import { formatCollectionDuration } from '../../lib/format'
import { shuffleItems } from '../../lib/random'
import { matchesSearchTerms } from '../../lib/search'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { resolvePersistedLibraryViewState } from '../../types/settings'
import type { Track } from '../../types/track'

type LibraryMode = 'tracks' | 'albums' | 'favorites'
type TrackSortOption = 'title-asc' | 'artist-asc' | 'album-asc' | 'duration-desc' | 'recent-desc'
type LibrarySortOption = TrackSortOption | AlbumSortOption
type TableDensity = 'comfortable' | 'compact'

type LibraryPageProps = {
  mode?: LibraryMode
}

const sectionCopy: Record<LibraryMode, { title: string; description: string }> = {
  tracks: {
    title: 'All Tracks',
    description: 'Browse the local library stored in SQLite and start playback with one click.'
  },
  albums: {
    title: 'Albums',
    description: 'Browse imported releases as a cover grid and jump into album detail pages.'
  },
  favorites: {
    title: 'Favorites',
    description: 'Keep a dedicated shelf of liked tracks and jump straight into the songs you want to revisit.'
  }
}

const sortOptionsByMode: Record<LibraryMode, Array<{ value: LibrarySortOption; label: string }>> = {
  tracks: [
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'artist-asc', label: 'Artist A-Z' },
    { value: 'album-asc', label: 'Album A-Z' },
    { value: 'duration-desc', label: 'Longest First' },
    { value: 'recent-desc', label: 'Recently Updated' }
  ],
  favorites: [
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'artist-asc', label: 'Artist A-Z' },
    { value: 'album-asc', label: 'Album A-Z' },
    { value: 'duration-desc', label: 'Longest First' },
    { value: 'recent-desc', label: 'Recently Updated' }
  ],
  albums: [
    { value: 'album-asc', label: 'Album A-Z' },
    { value: 'artist-asc', label: 'Artist A-Z' },
    { value: 'tracks-desc', label: 'Most Tracks' },
    { value: 'duration-desc', label: 'Longest Runtime' },
    { value: 'recent-desc', label: 'Recently Updated' }
  ]
}

const defaultSortByMode: Record<LibraryMode, LibrarySortOption> = {
  tracks: 'recent-desc',
  favorites: 'recent-desc',
  albums: 'recent-desc'
}

const defaultDensityByMode: Record<LibraryMode, TableDensity> = {
  tracks: 'comfortable',
  favorites: 'comfortable',
  albums: 'comfortable'
}

const keyboardHints = [
  { key: '/', label: 'Focus Search' },
  { key: 'Up/Down', label: 'Move Selection' },
  { key: 'Enter', label: 'Play Selected' },
  { key: 'Esc', label: 'Clear Search' }
]

function sortTracks(tracks: Track[], sortBy: TrackSortOption) {
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

export default function LibraryPage({ mode = 'tracks' }: LibraryPageProps) {
  const tracks = useLibraryStore((state) => state.tracks)
  const loading = useLibraryStore((state) => state.loading)
  const error = useLibraryStore((state) => state.error)
  const searchKeyword = useLibraryStore((state) => state.searchKeyword)
  const setSearchKeyword = useLibraryStore((state) => state.setSearchKeyword)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const saveTracksAsPlaylist = useSaveTracksAsPlaylist()
  const settingsReady = useSettingsStore((state) => state.ready)
  const persistedLibraryViewState = useSettingsStore((state) => state.settings.libraryViewState)
  const saveSetting = useSettingsStore((state) => state.setSetting)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const libraryViewHydratedRef = useRef(false)
  const [sortByMode, setSortByMode] = useState<Record<LibraryMode, LibrarySortOption>>(defaultSortByMode)
  const [densityByMode, setDensityByMode] = useState<Record<LibraryMode, TableDensity>>(defaultDensityByMode)
  const sortBy = sortByMode[mode]
  const density = densityByMode[mode]
  const showDensityControl = mode === 'tracks' || mode === 'favorites'
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const searchIsPending = deferredSearchKeyword !== searchKeyword

  const setSortBy = (nextSortBy: LibrarySortOption) => {
    setSortByMode((current) => ({
      ...current,
      [mode]: nextSortBy
    }))
  }

  const setDensity = (nextDensity: TableDensity) => {
    setDensityByMode((current) => ({
      ...current,
      [mode]: nextDensity
    }))
  }

  const scopedTracks = useMemo(
    () => (mode === 'favorites' ? tracks.filter((track) => track.isFavorite) : tracks),
    [mode, tracks]
  )
  const filteredTracks = useMemo(
    () =>
      scopedTracks.filter((track) =>
        matchesSearchTerms([track.title, track.artist, track.album], deferredSearchKeyword)
      ),
    [deferredSearchKeyword, scopedTracks]
  )
  const sortedTracks = useMemo(
    () =>
      mode === 'tracks' || mode === 'favorites'
        ? sortTracks(filteredTracks, sortBy as TrackSortOption)
        : filteredTracks,
    [filteredTracks, mode, sortBy]
  )
  const actionTracks = mode === 'tracks' || mode === 'favorites' ? sortedTracks : filteredTracks
  const copy = sectionCopy[mode]
  const sortOptions = sortOptionsByMode[mode]
  const activeSortLabel =
    sortOptions.find((option) => option.value === sortBy)?.label ?? sortOptions[0]?.label ?? 'Default'
  const visibleDuration = useMemo(
    () => filteredTracks.reduce((sum, track) => sum + track.duration, 0),
    [filteredTracks]
  )
  const visibleArtistCount = useMemo(
    () => new Set(filteredTracks.map((track) => track.artist)).size,
    [filteredTracks]
  )
  const visibleAlbumCount = useMemo(
    () => new Set(filteredTracks.map((track) => `${track.artist}::${track.album}`)).size,
    [filteredTracks]
  )

  useEffect(() => {
    if (!settingsReady || libraryViewHydratedRef.current) {
      return
    }

    const persistedState = resolvePersistedLibraryViewState(persistedLibraryViewState)

    if (persistedState) {
      setSortByMode((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(persistedState.sortByMode).filter(([mode, sortBy]) =>
            sortOptionsByMode[mode as LibraryMode]?.some((option) => option.value === sortBy)
          )
        )
      }))
      setDensityByMode((current) => ({
        ...current,
        ...persistedState.densityByMode
      }))
    }

    libraryViewHydratedRef.current = true
  }, [persistedLibraryViewState, settingsReady])

  useEffect(() => {
    if (!libraryViewHydratedRef.current) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveSetting('libraryViewState', {
        sortByMode,
        densityByMode
      }).catch(() => {
        showFeedback('Library view preferences could not be saved.', 'muted')
      })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [densityByMode, saveSetting, showFeedback, sortByMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target

      if (event.key === '/' && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current && searchKeyword) {
        event.preventDefault()
        setSearchKeyword('')
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [searchKeyword, setSearchKeyword])

  const emptyState =
    tracks.length === 0
      ? {
          title: 'No Music Imported Yet',
          description:
            'Import a local folder or audio files first. After the scan finishes, tracks and albums will appear here.',
          action: (
            <div className="flex flex-wrap justify-center gap-3">
              <FolderImportButton />
              <MusicFileImportButton />
            </div>
          )
        }
      : mode === 'favorites' && scopedTracks.length === 0
        ? {
            title: 'No Favorite Tracks Yet',
            description:
              'Mark songs as favorite from the library, search results, or player bar and they will appear here.',
            action: undefined
          }
        : {
            title: 'No Matching Results',
            description:
              mode === 'favorites'
                ? 'Try a different keyword, or clear search to see every liked track again.'
                : 'Try a different keyword, or clear search to bring the full library view back.',
            action: undefined
          }

  const handlePlayResults = async (shuffle = false) => {
    if (actionTracks.length === 0) {
      showFeedback('No visible results to play right now.', 'muted')
      return
    }

    const nextQueue = shuffle ? shuffleItems(actionTracks) : actionTracks

    const track = playSelection(nextQueue, 0)

    if (!track) {
      return
    }

    const started = await playTrackCommand(track)

    if (started) {
      showFeedback(
        shuffle
          ? `Shuffled ${nextQueue.length} visible results.`
          : `Playing ${nextQueue.length} visible results.`,
        'success',
        null,
        {
          detail: `${visibleArtistCount} artist${visibleArtistCount === 1 ? '' : 's'} across ${visibleAlbumCount} album${visibleAlbumCount === 1 ? '' : 's'}.`
        }
      )
    }
  }

  const handleSaveVisibleAsPlaylist = async () => {
    await saveTracksAsPlaylist({
      tracks: actionTracks,
      defaultName: searchKeyword.trim() ? `${copy.title} - ${searchKeyword.trim()}` : `${copy.title} Snapshot`,
      promptMessage: 'Save the visible library results as:',
      emptyMessage: 'No visible results to save right now.',
      failureMessage: 'Could not save visible results as a playlist right now.'
    })
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">{copy.title}</div>
          <h2 className="mt-3 text-2xl font-semibold text-white">{copy.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{copy.description}</p>
          {showDensityControl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {keyboardHints.map((hint) => (
                <div
                  key={hint.key}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 text-xs text-slate-300"
                >
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {hint.key}
                  </span>
                  <span>{hint.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <FolderImportButton />
          <MusicFileImportButton />
        </div>
      </section>

      <div className={`grid gap-4 ${showDensityControl ? 'lg:grid-cols-[minmax(0,1fr)_220px_180px_220px]' : 'lg:grid-cols-[minmax(0,1fr)_220px_220px]'}`}>
        <SearchInput value={searchKeyword} onChange={setSearchKeyword} inputRef={searchInputRef} />
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as LibrarySortOption)}
            className="w-full bg-transparent text-sm text-white outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {showDensityControl ? (
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
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
          {searchIsPending ? 'Filtering...' : `${filteredTracks.length} results / ${activeSortLabel}`}
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Visible Results</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Listen To What You Filtered</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handlePlayResults(false)}
                disabled={actionTracks.length === 0}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play Results
              </button>
              <button
                type="button"
                onClick={() => void handlePlayResults(true)}
                disabled={actionTracks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Shuffle
              </button>
              <AddToQueueButton tracks={actionTracks} />
              <button
                type="button"
                onClick={() => void handleSaveVisibleAsPlaylist()}
                disabled={actionTracks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Visible
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tracks</div>
              <div className="mt-2 text-lg font-semibold text-white">{filteredTracks.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artists</div>
              <div className="mt-2 text-lg font-semibold text-white">{visibleArtistCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Albums</div>
              <div className="mt-2 text-lg font-semibold text-white">{visibleAlbumCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Runtime</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatCollectionDuration(visibleDuration)}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Result Context</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Current View</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Mode</div>
              <div className="mt-2 text-sm font-semibold text-white">{copy.title}</div>
              <div className="mt-2 text-xs text-slate-400">{copy.description}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Search</div>
              <div className="mt-2 text-sm text-slate-200">
                {searchKeyword.trim() ? searchKeyword : 'No active keyword'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sort</div>
              <div className="mt-2 text-sm text-slate-200">{activeSortLabel}</div>
            </div>
          </div>
        </article>
      </section>

      {error ? <EmptyState title="Library Load Failed" description={error} /> : null}

      {!loading && filteredTracks.length === 0 ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      ) : null}

      {filteredTracks.length > 0 && mode === 'tracks' ? (
        <TrackTable
          tracks={sortedTracks}
          onFocusSearch={() => {
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
          }}
          onClearSearch={() => setSearchKeyword('')}
          hasActiveSearch={Boolean(searchKeyword.trim())}
          renderActions={(track) => <TrackLibraryActions track={track} />}
          density={density}
          ariaLabel={`${copy.title} track list`}
        />
      ) : null}
      {filteredTracks.length > 0 && mode === 'favorites' ? (
        <TrackTable
          tracks={sortedTracks}
          onFocusSearch={() => {
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
          }}
          onClearSearch={() => setSearchKeyword('')}
          hasActiveSearch={Boolean(searchKeyword.trim())}
          renderActions={(track) => <TrackLibraryActions track={track} />}
          density={density}
          ariaLabel={`${copy.title} track list`}
        />
      ) : null}
      {filteredTracks.length > 0 && mode === 'albums' ? (
        <AlbumGrid tracks={filteredTracks} sortBy={sortBy as AlbumSortOption} />
      ) : null}
    </div>
  )
}
