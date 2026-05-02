import { useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FolderImportButton from '../../components/library/FolderImportButton'
import MusicFileImportButton from '../../components/library/MusicFileImportButton'
import CoverArtwork from '../../components/player/CoverArtwork'
import { formatCollectionDuration, formatDuration, formatPlayedAt } from '../../lib/format'
import { buildAlbumSummaries, getAlbumRoute } from '../../lib/library'
import { playTrackCommand } from '../../services/playerCommands'
import { useFeedbackStore } from '../../store/feedbackStore'
import { useHistoryStore } from '../../store/historyStore'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import type { Track } from '../../types/track'

function SectionHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group flex min-w-0 items-center gap-3 rounded-2xl bg-white/72 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/8 dark:hover:bg-white/12"
    >
      <CoverArtwork coverPath={track.coverPath} title={track.title} className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950 group-hover:text-accent dark:text-white">
          {track.title}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{track.artist}</div>
      </div>
      <div className="text-xs text-slate-400">{formatDuration(track.duration)}</div>
    </button>
  )
}

export default function HomePage() {
  const tracks = useLibraryStore((state) => state.tracks)
  const lastScanStats = useLibraryStore((state) => state.lastScanStats)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const queue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const playSelection = usePlayerStore((state) => state.playSelection)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const recentEntries = useHistoryStore((state) => state.entries)
  const historyLoaded = useHistoryStore((state) => state.loaded)
  const loadRecentHistory = useHistoryStore((state) => state.loadRecentHistory)

  useEffect(() => {
    if (!historyLoaded) {
      void loadRecentHistory()
    }
  }, [historyLoaded, loadRecentHistory])

  const albums = useMemo(() => buildAlbumSummaries(tracks), [tracks])
  const favoriteTracks = useMemo(() => tracks.filter((track) => track.isFavorite).slice(0, 6), [tracks])
  const recentTracks = useMemo(() => recentEntries.slice(0, 6), [recentEntries])
  const freshTracks = useMemo(
    () =>
      [...tracks]
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
            left.title.localeCompare(right.title)
        )
        .slice(0, 8),
    [tracks]
  )
  const topAlbums = useMemo(
    () =>
      [...albums]
        .sort(
          (left, right) =>
            right.trackCount - left.trackCount ||
            right.totalDuration - left.totalDuration ||
            left.name.localeCompare(right.name)
        )
        .slice(0, 5),
    [albums]
  )
  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)
  const nextUpTrack = currentTrack ? queue[currentIndex + 1] ?? null : null

  const playTracks = async (trackList: Track[], startIndex = 0, label = 'Playing selection.') => {
    if (trackList.length === 0) {
      showFeedback('No tracks available yet.', 'muted')
      return
    }

    const track = playSelection(trackList, startIndex)

    if (track && (await playTrackCommand(track))) {
      showFeedback(label)
    }
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#fa233b] via-[#fb4960] to-[#ff8a9a] p-7 text-white shadow-soft">
          <div className="grid gap-6 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
                {currentTrack ? (isPlaying ? 'Now Playing' : 'Paused') : 'Welcome'}
              </div>
              <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                {currentTrack ? currentTrack.title : 'Your music, cleaned up.'}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/78">
                {currentTrack
                  ? `${currentTrack.artist} - ${currentTrack.album}`
                  : 'Import local folders or individual files, then browse them with a calmer Apple Music inspired layout.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {tracks.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void playTracks(tracks, 0, `Playing ${tracks.length} songs.`)}
                      className="rounded-full bg-white px-5 py-3 text-sm font-bold text-accent transition hover:bg-white/92"
                    >
                      Play Library
                    </button>
                    <Link
                      to="/library/tracks"
                      className="rounded-full bg-white/16 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/22 transition hover:bg-white/24"
                    >
                      Open Songs
                    </Link>
                  </>
                ) : (
                  <>
                    <FolderImportButton className="rounded-full bg-white text-accent hover:bg-white/92" />
                    <MusicFileImportButton className="rounded-full border-white/30 bg-white/16 text-white hover:bg-white/24" />
                  </>
                )}
              </div>
            </div>

            <div className="justify-self-start md:justify-self-end">
              <CoverArtwork
                coverPath={currentTrack?.coverPath ?? topAlbums[0]?.coverPath}
                title={currentTrack?.title ?? topAlbums[0]?.name ?? 'PulseLocal'}
                className="h-44 w-44 rounded-[32px] shadow-[0_28px_70px_rgba(0,0,0,0.28)]"
                fallbackLabel="PL"
              />
            </div>
          </div>
        </article>

        <aside className="rounded-[34px] bg-white/72 p-6 shadow-sm dark:bg-white/8">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Library
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/[0.04] p-4 dark:bg-white/8">
              <div className="text-3xl font-black text-slate-950 dark:text-white">{tracks.length}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Songs</div>
            </div>
            <div className="rounded-2xl bg-black/[0.04] p-4 dark:bg-white/8">
              <div className="text-3xl font-black text-slate-950 dark:text-white">{albums.length}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Albums</div>
            </div>
            <div className="col-span-2 rounded-2xl bg-black/[0.04] p-4 dark:bg-white/8">
              <div className="text-lg font-bold text-slate-950 dark:text-white">
                {formatCollectionDuration(totalDuration)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total listening time</div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-black/5 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            {lastScanStats
              ? `Last scan: +${lastScanStats.addedCount}, -${lastScanStats.removedCount}, ${lastScanStats.updatedCount} updated.`
              : 'Import music to build your local library.'}
          </div>
        </aside>
      </section>

      {currentTrack ? (
        <section>
          <SectionHeader eyebrow="Continue" title="Up Next" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TrackCard track={currentTrack} onPlay={() => void playTrackCommand(currentTrack)} />
            {nextUpTrack ? (
              <TrackCard
                track={nextUpTrack}
                onPlay={() => void playTracks([nextUpTrack], 0, `Playing ${nextUpTrack.title}.`)}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader
          eyebrow="Recently Added"
          title="Fresh in Your Library"
          action={
            <Link to="/library/tracks" className="text-sm font-semibold text-accent hover:brightness-90">
              See All
            </Link>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {freshTracks.length > 0 ? (
            freshTracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => void playTracks(freshTracks, index, `Playing ${track.title}.`)}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white/50 px-5 py-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              Import a folder or audio files and recent songs will appear here.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article>
          <SectionHeader
            eyebrow="Albums"
            title="Made From Your Files"
            action={
              <Link to="/library/albums" className="text-sm font-semibold text-accent hover:brightness-90">
                Browse Albums
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topAlbums.length > 0 ? (
              topAlbums.map((album) => (
                <Link
                  key={album.id}
                  to={getAlbumRoute(album.artist, album.name)}
                  className="group min-w-0"
                >
                  <CoverArtwork
                    coverPath={album.coverPath}
                    title={album.name}
                    className="aspect-square w-full rounded-[26px] shadow-sm transition group-hover:-translate-y-1"
                  />
                  <div className="mt-3 truncate text-sm font-semibold text-slate-950 group-hover:text-accent dark:text-white">
                    {album.name}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {album.artist} - {album.trackCount} songs
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-black/10 bg-white/50 px-5 py-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                Album cards will appear after metadata scanning.
              </div>
            )}
          </div>
        </article>

        <aside>
          <SectionHeader eyebrow="History" title="Recently Played" />
          <div className="grid gap-2">
            {recentTracks.length > 0 ? (
              recentTracks.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  onClick={() => void playTracks([entry.track], 0, `Playing ${entry.track.title}.`)}
                  className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/72 p-3 text-left shadow-sm transition hover:bg-white dark:bg-white/8 dark:hover:bg-white/12"
                >
                  <CoverArtwork
                    coverPath={entry.track.coverPath}
                    title={entry.track.title}
                    className="h-12 w-12 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                      {entry.track.title}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {formatPlayedAt(entry.playedAt)}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-black/10 bg-white/50 px-5 py-8 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                Play a song and it will show up here.
              </div>
            )}
          </div>
        </aside>
      </section>

      {favoriteTracks.length > 0 ? (
        <section>
          <SectionHeader
            eyebrow="Favorites"
            title="Songs You Marked"
            action={
              <Link to="/library/favorites" className="text-sm font-semibold text-accent hover:brightness-90">
                Open Favorites
              </Link>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {favoriteTracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => void playTracks(favoriteTracks, index, `Playing favorites.`)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
