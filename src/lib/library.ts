import type { Track } from '../types/track'

export type AlbumSummary = {
  id: string
  name: string
  artist: string
  tracks: Track[]
  coverPath?: string
  trackCount: number
  totalDuration: number
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function encodeLibraryParam(value: string) {
  return encodeURIComponent(value)
}

export function decodeLibraryParam(value: string) {
  return safeDecode(value)
}

export function getAlbumRoute(artist: string, album: string) {
  return `/library/albums/${encodeLibraryParam(artist)}/${encodeLibraryParam(album)}`
}

export function buildAlbumSummaries(tracks: Track[]) {
  const groups = new Map<string, AlbumSummary>()

  for (const track of tracks) {
    const key = `${track.artist}::${track.album}`
    const current = groups.get(key)

    if (current) {
      current.tracks.push(track)
      current.trackCount += 1
      current.totalDuration += track.duration

      if (!current.coverPath && track.coverPath) {
        current.coverPath = track.coverPath
      }

      continue
    }

    groups.set(key, {
      id: key,
      name: track.album,
      artist: track.artist,
      tracks: [track],
      coverPath: track.coverPath,
      trackCount: 1,
      totalDuration: track.duration
    })
  }

  return Array.from(groups.values()).sort((left, right) => {
    const artistCompare = left.artist.localeCompare(right.artist)

    if (artistCompare !== 0) {
      return artistCompare
    }

    return left.name.localeCompare(right.name)
  })
}

export function findAlbumTracks(tracks: Track[], artist: string, album: string) {
  return tracks.filter((track) => track.artist === artist && track.album === album)
}
