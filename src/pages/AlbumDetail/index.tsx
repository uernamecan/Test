import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../../components/common/EmptyState'
import SearchInput from '../../components/common/SearchInput'
import AddToQueueButton from '../../components/library/AddToQueueButton'
import TrackActionMenu from '../../components/library/TrackActionMenu'
import TrackLibraryActions from '../../components/library/TrackLibraryActions'
import TrackTable from '../../components/library/TrackTable'
import CoverArtwork from '../../components/player/CoverArtwork'
import { useSaveTracksAsPlaylist } from '../../hooks/useSaveTracksAsPlaylist'
import { formatCollectionDuration, formatDuration, formatLibraryTimestamp, formatTrackMeta } from '../../lib/format'
import { decodeLibraryParam, findAlbumTracks } from '../../lib/library'
import { matchesSearchTerms } from '../../lib/search'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'

export default function AlbumDetailPage() {
  const { artistId, albumId } = useParams()
  const tracks = useLibraryStore((state) => state.tracks)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const saveTracksAsPlaylist = useSaveTracksAsPlaylist()
  const [searchValue, setSearchValue] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const artist = decodeLibraryParam(artistId ?? '')
  const album = decodeLibraryParam(albumId ?? '')
  const albumTracks = findAlbumTracks(tracks, artist, album)
  const filteredAlbumTracks = useMemo(
    () =>
      albumTracks.filter((track) =>
        matchesSearchTerms([track.title, track.artist, track.album, track.format], searchValue)
      ),
    [albumTracks, searchValue]
  )
  const totalDuration = albumTracks.reduce((sum, track) => sum + track.duration, 0)
  const latestUpdatedAt = Math.max(0, ...albumTracks.map((track) => new Date(track.updatedAt).getTime()))
  const latestUpdatedLabel = latestUpdatedAt
    ? formatLibraryTimestamp(new Date(latestUpdatedAt).toISOString())
    : 'Unknown date'
  const coverPath = albumTracks.find((track) => track.coverPath)?.coverPath
  const favoriteCount = albumTracks.filter((track) => track.isFavorite).length
  const filteredFavoriteCount = filteredAlbumTracks.filter((track) => track.isFavorite).length
  const uniqueFormats = Array.from(new Set(albumTracks.map((track) => track.format.toUpperCase()))).length
  const featuredTracks = useMemo(
    () =>
      [...filteredAlbumTracks]
        .sort((left, right) => {
          if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) {
            return left.isFavorite ? -1 : 1
          }

          return right.duration - left.duration || left.title.localeCompare(right.title)
        })
        .slice(0, 4),
    [filteredAlbumTracks]
  )

  const handlePlayAlbum = async () => {
    const firstTrack = playSelection(albumTracks, 0)

    if (firstTrack) {
      await playTrackCommand(firstTrack)
    }
  }

  const handlePlayTrack = async (trackId: string) => {
    const trackIndex = albumTracks.findIndex((track) => track.id === trackId)

    if (trackIndex < 0) {
      return
    }

    const nextTrack = playSelection(albumTracks, trackIndex)

    if (nextTrack) {
      await playTrackCommand(nextTrack)
    }
  }

  const handlePlayFilteredAlbum = async (shuffle = false) => {
    if (filteredAlbumTracks.length === 0) {
      showFeedback('No visible album tracks to play right now.', 'muted')
      return
    }

    const nextQueue = shuffle ? [...filteredAlbumTracks] : filteredAlbumTracks

    if (shuffle) {
      for (let index = nextQueue.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[nextQueue[index], nextQueue[swapIndex]] = [nextQueue[swapIndex], nextQueue[index]]
      }
    }

    const nextTrack = playSelection(nextQueue, 0)

    if (!nextTrack) {
      return
    }

    const started = await playTrackCommand(nextTrack)

    if (started) {
      showFeedback(
        shuffle
          ? `Shuffled ${nextQueue.length} tracks from ${album}.`
          : `Playing ${nextQueue.length} tracks from ${album}.`,
        'success',
        null,
        {
          detail: `${filteredFavoriteCount} favorite track${filteredFavoriteCount === 1 ? '' : 's'} in the current album filter.`
        }
      )
    }
  }

  const handleSaveVisibleAsPlaylist = async () => {
    await saveTracksAsPlaylist({
      tracks: filteredAlbumTracks,
      defaultName: searchValue.trim() ? `${album} - ${searchValue.trim()}` : `${album} Selection`,
      promptMessage: 'Save the visible album tracks as:',
      emptyMessage: 'No visible album tracks to save right now.',
      failureMessage: 'Could not save visible album tracks as a playlist right now.'
    })
  }

  if (!artist || !album || albumTracks.length === 0) {
    return (
      <EmptyState
        title="Album Not Found"
        description="This album is not available in the imported library yet."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <CoverArtwork
            coverPath={coverPath}
            title={album}
            className="aspect-square w-full max-w-[220px] rounded-[28px]"
          />
        </div>

        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-aurora">Album Detail</div>
            <h2 className="mt-3 truncate text-3xl font-semibold text-white">{album}</h2>
            <div className="mt-3 inline-flex text-sm text-slate-300">
              {artist}
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {albumTracks.length} tracks / {formatDuration(totalDuration)} total runtime / Updated {latestUpdatedLabel}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handlePlayAlbum()}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Play Album
            </button>
            <AddToQueueButton tracks={albumTracks} />
            <Link
              to="/library/albums"
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Back to Albums
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Track Count</div>
          <div className="mt-3 text-3xl font-semibold text-white">{albumTracks.length}</div>
          <div className="mt-2 text-sm text-slate-400">Songs queued in album order for one-tap playback</div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Runtime</div>
          <div className="mt-3 text-3xl font-semibold text-white">{formatDuration(totalDuration)}</div>
          <div className="mt-2 text-sm text-slate-400">Full album listening time from first track to last</div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Collection Notes</div>
          <div className="mt-3 text-3xl font-semibold text-white">{favoriteCount}</div>
          <div className="mt-2 text-sm text-slate-400">
            Favorites across {uniqueFormats} format{uniqueFormats === 1 ? '' : 's'}
          </div>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest Update</div>
          <div className="mt-3 text-2xl font-semibold text-white">{latestUpdatedLabel}</div>
          <div className="mt-2 text-sm text-slate-400">Most recent scan timestamp inside this album</div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          placeholder={`Filter tracks inside ${album}`}
          inputRef={searchInputRef}
        />
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
          {filteredAlbumTracks.length} tracks
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-aurora">Album Actions</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Play What You Filtered</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handlePlayFilteredAlbum(false)}
                disabled={filteredAlbumTracks.length === 0}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Play Visible
              </button>
              <button
                type="button"
                onClick={() => void handlePlayFilteredAlbum(true)}
                disabled={filteredAlbumTracks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Shuffle
              </button>
              <AddToQueueButton tracks={filteredAlbumTracks} />
              <button
                type="button"
                onClick={() => void handleSaveVisibleAsPlaylist()}
                disabled={filteredAlbumTracks.length === 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Visible
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Visible Tracks</div>
              <div className="mt-2 text-lg font-semibold text-white">{filteredAlbumTracks.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Favorites</div>
              <div className="mt-2 text-lg font-semibold text-white">{filteredFavoriteCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Formats</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {new Set(filteredAlbumTracks.map((track) => track.format.toUpperCase())).size}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Runtime</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {formatCollectionDuration(filteredAlbumTracks.reduce((sum, track) => sum + track.duration, 0))}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Filter Context</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Album Focus</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Artist</div>
              <div className="mt-2 text-sm text-slate-200">{artist}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Search</div>
              <div className="mt-2 text-sm text-slate-200">
                {searchValue.trim() ? searchValue : 'No active filter'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Narrow this release down to a few cuts, then play or queue only that slice.
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-aurora">Highlights</div>
            <h3 className="mt-2 text-xl font-semibold text-white">Start With These Cuts</h3>
          </div>
          <div className="text-sm text-slate-400">{featuredTracks.length} picks</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {featuredTracks.map((track) => (
            <article
              key={track.id}
              className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void handlePlayTrack(track.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <CoverArtwork
                    coverPath={track.coverPath}
                    title={track.title}
                    className="h-16 w-16 shrink-0 rounded-2xl"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{track.title}</div>
                    <div className="mt-2 truncate text-xs text-slate-400">
                      {artist} / {formatDuration(track.duration)}
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      {formatTrackMeta(track.format, track.bitrate)}
                    </div>
                  </div>
                </button>
                <TrackActionMenu track={track} placement="bottom" compact buttonLabel="More" />
              </div>
            </article>
          ))}
          {featuredTracks.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              No highlighted tracks match this filter yet.
            </div>
          ) : null}
        </div>
      </section>

      {filteredAlbumTracks.length > 0 ? (
        <TrackTable
          tracks={filteredAlbumTracks}
          onFocusSearch={() => {
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
          }}
          onClearSearch={() => setSearchValue('')}
          hasActiveSearch={Boolean(searchValue.trim())}
          renderActions={(track) => <TrackLibraryActions track={track} />}
          ariaLabel={`${album} album track list`}
        />
      ) : (
        <EmptyState
          title="No Matching Tracks"
          description="Try another keyword to bring this album's tracks back into view."
        />
      )}
    </div>
  )
}
