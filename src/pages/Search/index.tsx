import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/common/EmptyState'
import SearchInput from '../../components/common/SearchInput'
import AddToQueueButton from '../../components/library/AddToQueueButton'
import CollectionActionMenu from '../../components/library/CollectionActionMenu'
import TrackLibraryActions from '../../components/library/TrackLibraryActions'
import TrackTable from '../../components/library/TrackTable'
import CoverArtwork from '../../components/player/CoverArtwork'
import { useSaveTracksAsPlaylist } from '../../hooks/useSaveTracksAsPlaylist'
import { useMinuteTicker } from '../../hooks/useMinuteTicker'
import { formatCollectionDuration, formatRelativeTime } from '../../lib/format'
import { buildAlbumSummaries, getAlbumRoute } from '../../lib/library'
import { shuffleItems } from '../../lib/random'
import { matchesSearchTerms, normalizeSearchText } from '../../lib/search'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { useSettingsStore } from '../../store/settingsStore'
import { resolvePersistedSearchState } from '../../types/settings'

const SEARCH_STATE_KEY = 'searchState'
const MAX_RECENT_SEARCHES = 8
const LEGACY_SEARCH_TIMESTAMP = new Date(0).toISOString()

type RecentSearchEntry = {
  keyword: string
  searchedAt: string
}

function normalizeRecentSearches(entries: RecentSearchEntry[]) {
  const seenKeywords = new Set<string>()
  const nextEntries: RecentSearchEntry[] = []

  for (const entry of entries) {
    const keyword = entry.keyword.trim()
    const normalizedKeyword = normalizeSearchText(keyword)

    if (!keyword || seenKeywords.has(normalizedKeyword)) {
      continue
    }

    seenKeywords.add(normalizedKeyword)
    nextEntries.push({
      keyword,
      searchedAt: entry.searchedAt
    })

    if (nextEntries.length >= MAX_RECENT_SEARCHES) {
      break
    }
  }

  return nextEntries
}

export default function SearchPage() {
  useMinuteTicker()

  const tracks = useLibraryStore((state) => state.tracks)
  const searchKeyword = useLibraryStore((state) => state.searchKeyword)
  const setSearchKeyword = useLibraryStore((state) => state.setSearchKeyword)
  const settings = useSettingsStore((state) => state.settings)
  const ready = useSettingsStore((state) => state.ready)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const setSetting = useSettingsStore((state) => state.setSetting)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const saveTracksAsPlaylist = useSaveTracksAsPlaylist()
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const deferredSearchKeyword = useDeferredValue(searchKeyword)
  const searchIsPending = deferredSearchKeyword !== searchKeyword

  useEffect(() => {
    if (!ready) {
      void loadSettings()
    }
  }, [loadSettings, ready])

  useEffect(() => {
    if (!ready) {
      return
    }

    const persistedState = resolvePersistedSearchState(settings.searchState)
    const legacyEntries = (persistedState?.recentKeywords ?? []).map((keyword) => ({
      keyword,
      searchedAt: LEGACY_SEARCH_TIMESTAMP
    }))
    const nextRecentSearches = normalizeRecentSearches(persistedState?.recentEntries ?? legacyEntries)

    setRecentSearches(nextRecentSearches)

    if (!persistedState?.recentEntries && nextRecentSearches.length > 0) {
      void setSetting(SEARCH_STATE_KEY, {
        recentKeywords: nextRecentSearches.map((entry) => entry.keyword),
        recentEntries: nextRecentSearches
      })
    }
  }, [ready, setSetting, settings.searchState])

  const persistRecentSearches = async (entries: RecentSearchEntry[]) => {
    const normalizedEntries = normalizeRecentSearches(entries)

    await setSetting(SEARCH_STATE_KEY, {
      recentKeywords: normalizedEntries.map((entry) => entry.keyword),
      recentEntries: normalizedEntries
    })
  }

  const commitSearch = async (value: string) => {
    const trimmedValue = value.trim()

    if (!ready || trimmedValue.length === 0) {
      return
    }

    const nextRecentSearches: RecentSearchEntry[] = [
      {
        keyword: trimmedValue,
        searchedAt: new Date().toISOString()
      },
      ...recentSearches.filter(
        (item) => normalizeSearchText(item.keyword) !== normalizeSearchText(trimmedValue)
      )
    ].slice(0, MAX_RECENT_SEARCHES)

    setRecentSearches(nextRecentSearches)
    await persistRecentSearches(nextRecentSearches)
  }

  const handleUseRecentSearch = async (keyword: string) => {
    setSearchKeyword(keyword)
    await commitSearch(keyword)
  }

  const handleClearRecentSearches = async () => {
    if (recentSearches.length === 0) {
      return
    }

    const shouldClear = window.confirm('Clear all recent search shortcuts?')

    if (!shouldClear) {
      return
    }

    setRecentSearches([])
    await persistRecentSearches([])
    showFeedback('Cleared recent search history.', 'success')
  }

  const handleRemoveRecentSearch = async (keyword: string) => {
    const nextRecentSearches = recentSearches.filter(
      (entry) => normalizeSearchText(entry.keyword) !== normalizeSearchText(keyword)
    )

    setRecentSearches(nextRecentSearches)
    await persistRecentSearches(nextRecentSearches)
    showFeedback(`Removed "${keyword}" from recent searches.`, 'muted')
  }

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
        setSearchKeyword('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [setSearchKeyword])

  const results = useMemo(
    () =>
      tracks.filter((track) =>
        matchesSearchTerms([track.title, track.artist, track.album], deferredSearchKeyword)
      ),
    [deferredSearchKeyword, tracks]
  )
  const albumMatches = useMemo(() => buildAlbumSummaries(results), [results])
  const matchedAlbums = albumMatches.slice(0, 3)
  const matchedArtistNameCount = useMemo(
    () => new Set(results.map((track) => track.artist)).size,
    [results]
  )
  const hasKeyword = searchKeyword.trim().length > 0
  const resultStats = [
    {
      label: 'Tracks',
      value: results.length.toString()
    },
    {
      label: 'Artist Names',
      value: matchedArtistNameCount.toString()
    },
    {
      label: 'Albums',
      value: albumMatches.length.toString()
    },
    {
      label: 'Runtime',
      value: formatCollectionDuration(results.reduce((total, track) => total + track.duration, 0))
    }
  ]

  const handlePlayResults = async (shuffle = false) => {
    if (results.length === 0) {
      showFeedback('No search results to play right now.', 'muted')
      return
    }

    const nextQueue = shuffle ? shuffleItems(results) : results

    const track = playSelection(nextQueue, 0)

    if (!track) {
      return
    }

    const started = await playTrackCommand(track)

    if (started) {
      showFeedback(
        shuffle ? `Shuffled ${nextQueue.length} search results.` : `Playing ${nextQueue.length} search results.`,
        'success',
        null,
        {
          detail: `${matchedArtistNameCount} artist name${matchedArtistNameCount === 1 ? '' : 's'} and ${albumMatches.length} album match${albumMatches.length === 1 ? '' : 'es'} in this search.`
        }
      )
    }
  }

  const handleSaveResultsAsPlaylist = async () => {
    await saveTracksAsPlaylist({
      tracks: results,
      defaultName: searchKeyword.trim() ? `Search - ${searchKeyword.trim()}` : 'Search Results',
      promptMessage: 'Save these search results as:',
      emptyMessage: 'No search results to save right now.',
      failureMessage: 'Could not save search results as a playlist right now.'
    })
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft">
        <div className="text-xs uppercase tracking-[0.22em] text-aurora">Search</div>
        <h2 className="mt-3 text-2xl font-semibold text-white">Search Local Music</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The current MVP keeps search lightweight in memory. If the library grows, it can move to
          SQLite search or FTS next.
        </p>
        <div className="mt-5">
          <SearchInput
            value={searchKeyword}
            onChange={setSearchKeyword}
            onCommit={(value) => void commitSearch(value)}
            inputRef={searchInputRef}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {recentSearches.length > 0 ? (
              recentSearches.map((entry) => (
                <div
                  key={`${entry.keyword}-${entry.searchedAt}`}
                  className="inline-flex items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 text-xs text-slate-200 transition hover:bg-white/10"
                >
                  <button
                    type="button"
                    onClick={() => void handleUseRecentSearch(entry.keyword)}
                    aria-label={`Search for ${entry.keyword}`}
                    title={
                      entry.searchedAt !== LEGACY_SEARCH_TIMESTAMP
                        ? `Searched ${new Date(entry.searchedAt).toLocaleString()}`
                        : undefined
                    }
                    className="px-3 py-2 text-left"
                  >
                    <span>{entry.keyword}</span>
                    {entry.searchedAt !== LEGACY_SEARCH_TIMESTAMP ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        {formatRelativeTime(entry.searchedAt)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveRecentSearch(entry.keyword)}
                    aria-label={`Remove ${entry.keyword} from recent searches`}
                    title={`Remove ${entry.keyword}`}
                    className="border-l border-white/10 px-2.5 py-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <span aria-hidden="true">x</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-full border border-dashed border-white/10 px-3 py-2 text-xs text-slate-400">
                Recent searches will appear here.
              </div>
            )}
          </div>

          {recentSearches.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleClearRecentSearches()}
              className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10"
            >
              Clear History
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {searchIsPending ? (
            <div className="rounded-2xl border border-aurora/30 bg-aurora/10 px-4 py-3 text-sm text-aurora">
              Filtering...
            </div>
          ) : null}
          {resultStats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
              <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Search Actions</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Turn Results Into Playback</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handlePlayResults(false)}
                disabled={results.length === 0}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play Results
              </button>
              <button
                type="button"
                onClick={() => void handlePlayResults(true)}
                disabled={results.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Shuffle
              </button>
              <AddToQueueButton tracks={results} />
              <button
                type="button"
                onClick={() => void handleSaveResultsAsPlaylist()}
                disabled={results.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Results
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {resultStats.map((item) => (
              <div
                key={`action-${item.label}`}
                className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Search Context</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Current Focus</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Keyword</div>
              <div className="mt-2 text-sm text-slate-200">
                {searchKeyword.trim() ? searchKeyword : 'No active keyword'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent Searches</div>
              <div className="mt-2 text-sm text-slate-200">
                {recentSearches.length > 0 ? `${recentSearches.length} saved shortcuts` : 'No saved shortcuts yet'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Search is still in-memory for MVP speed, so this page works best as a fast launcher for
              local listening sessions.
            </div>
          </div>
        </article>
      </section>

      {hasKeyword && matchedAlbums.length > 0 ? (
        <section className="grid gap-4">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-aurora">Albums</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Best Album Matches</h3>
              </div>
              <Link to="/library/albums" className="text-sm text-slate-300 hover:text-white">
                Browse all
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {matchedAlbums.length > 0 ? (
                matchedAlbums.map((album) => (
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
                  No album matches yet.
                </div>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {results.length > 0 ? (
        <TrackTable
          tracks={results}
          onFocusSearch={() => {
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
          }}
          onClearSearch={() => setSearchKeyword('')}
          hasActiveSearch={hasKeyword}
          renderActions={(track) => <TrackLibraryActions track={track} />}
          ariaLabel="Search results track list"
        />
      ) : hasKeyword ? (
        <EmptyState
          title="No Search Results"
          description="Try a shorter keyword, or switch to a recent search to jump back into the library."
          action={
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('')
                searchInputRef.current?.focus()
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Clear Search
            </button>
          }
        />
      ) : tracks.length > 0 ? (
        <EmptyState
          title="Start Searching"
          description="Type any track, artist, or album name and the local library will filter instantly."
        />
      ) : (
        <EmptyState
          title="No Search Results"
          description="Try a shorter keyword, or import a local music folder first."
        />
      )}
    </div>
  )
}
