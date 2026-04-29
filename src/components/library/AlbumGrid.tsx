import { Link } from 'react-router-dom'
import { formatDuration, formatLibraryTimestamp } from '../../lib/format'
import { buildAlbumSummaries, getAlbumRoute } from '../../lib/library'
import { playTrackCommand } from '../../services/playerCommands'
import { usePlayerStore } from '../../store/playerStore'
import type { Track } from '../../types/track'
import CoverArtwork from '../player/CoverArtwork'
import CollectionActionMenu from './CollectionActionMenu'

export type AlbumSortOption = 'album-asc' | 'artist-asc' | 'tracks-desc' | 'duration-desc' | 'recent-desc'

type AlbumGridProps = {
  tracks: Track[]
  sortBy?: AlbumSortOption
}

function getLatestTrackTimestamp(tracks: Track[]) {
  return Math.max(...tracks.map((track) => new Date(track.updatedAt).getTime()))
}

export default function AlbumGrid({ tracks, sortBy = 'album-asc' }: AlbumGridProps) {
  const playSelection = usePlayerStore((state) => state.playSelection)
  const albums = [...buildAlbumSummaries(tracks)].sort((left, right) => {
    if (sortBy === 'recent-desc') {
      const leftUpdatedAt = getLatestTrackTimestamp(left.tracks)
      const rightUpdatedAt = getLatestTrackTimestamp(right.tracks)

      return rightUpdatedAt - leftUpdatedAt || left.name.localeCompare(right.name)
    }

    if (sortBy === 'artist-asc') {
      return left.artist.localeCompare(right.artist) || left.name.localeCompare(right.name)
    }

    if (sortBy === 'tracks-desc') {
      return right.trackCount - left.trackCount || left.name.localeCompare(right.name)
    }

    if (sortBy === 'duration-desc') {
      return right.totalDuration - left.totalDuration || left.name.localeCompare(right.name)
    }

    return left.name.localeCompare(right.name) || left.artist.localeCompare(right.artist)
  })

  const handlePlayAlbum = async (albumTracks: Track[]) => {
    const firstTrack = playSelection(albumTracks, 0)

    if (firstTrack) {
      await playTrackCommand(firstTrack)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {albums.map((album) => {
        const latestUpdatedAt = new Date(getLatestTrackTimestamp(album.tracks)).toISOString()

        return (
          <article
            key={album.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft transition hover:-translate-y-1 hover:bg-white/10"
          >
            <Link to={getAlbumRoute(album.artist, album.name)} className="block">
              <div className="mb-4">
                <CoverArtwork
                  coverPath={album.coverPath}
                  title={album.name}
                  className="aspect-square w-full rounded-2xl"
                />
              </div>
              <h3 className="truncate text-lg font-semibold text-white">{album.name}</h3>
              <p className="mt-1 truncate text-sm text-slate-300">{album.artist}</p>
              <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
                <span>{album.trackCount} tracks</span>
                <span>{formatDuration(album.totalDuration)}</span>
              </div>
              <div className="mt-3 rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Updated {formatLibraryTimestamp(latestUpdatedAt)}
              </div>
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handlePlayAlbum(album.tracks)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Play
              </button>
              <CollectionActionMenu
                title={album.name}
                tracks={album.tracks}
                detailHref={getAlbumRoute(album.artist, album.name)}
                detailLabel="Open Album"
              />
            </div>
          </article>
        )
      })}
    </div>
  )
}
