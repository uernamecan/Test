import type { Track } from '../../../src/types/track'
import { getDatabase } from '../client'

export type TrackRow = {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: number
  cover_path: string | null
  lyric_path: string | null
  format: string
  bitrate: number | null
  sample_rate: number | null
  created_at: string
  updated_at: string
  is_favorite: number
}

const TRACK_UPSERT_SQL = `
  INSERT INTO tracks (
    id, path, title, artist, album, duration, cover_path, lyric_path,
    format, bitrate, sample_rate, created_at, updated_at
  ) VALUES (
    @id, @path, @title, @artist, @album, @duration, @coverPath, @lyricPath,
    @format, @bitrate, @sampleRate, @createdAt, @updatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    path = excluded.path,
    title = excluded.title,
    artist = excluded.artist,
    album = excluded.album,
    duration = excluded.duration,
    cover_path = excluded.cover_path,
    lyric_path = excluded.lyric_path,
    format = excluded.format,
    bitrate = excluded.bitrate,
    sample_rate = excluded.sample_rate,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at
`

export function mapTrackRow(row: TrackRow): Track {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    coverPath: row.cover_path ?? undefined,
    lyricPath: row.lyric_path ?? undefined,
    isFavorite: Boolean(row.is_favorite),
    format: row.format,
    bitrate: row.bitrate ?? undefined,
    sampleRate: row.sample_rate ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export function upsertTracks(tracks: Track[]) {
  if (tracks.length === 0) {
    return
  }

  const database = getDatabase()
  const upsert = database.prepare(TRACK_UPSERT_SQL)

  const transaction = database.transaction((items: Track[]) => {
    for (const track of items) {
      upsert.run(track)
    }
  })

  transaction(tracks)
}

export function replaceLibraryTracks(tracks: Track[]) {
  const database = getDatabase()
  const upsert = database.prepare(TRACK_UPSERT_SQL)

  const deleteAll = database.prepare('DELETE FROM tracks')
  const createNextTrackIdsTable = database.prepare(`
    CREATE TEMP TABLE IF NOT EXISTS next_library_track_ids (
      id TEXT PRIMARY KEY
    )
  `)
  const clearNextTrackIdsTable = database.prepare('DELETE FROM next_library_track_ids')
  const insertNextTrackId = database.prepare(`
    INSERT OR IGNORE INTO next_library_track_ids (id)
    VALUES (?)
  `)
  const deleteMissing = database.prepare(`
    DELETE FROM tracks
    WHERE NOT EXISTS (
      SELECT 1
      FROM next_library_track_ids
      WHERE next_library_track_ids.id = tracks.id
    )
  `)
  const deleteOrphanedPlaylistTracks = database.prepare(`
    DELETE FROM playlist_tracks
    WHERE track_id NOT IN (SELECT id FROM tracks)
  `)
  const deleteOrphanedFavorites = database.prepare(`
    DELETE FROM favorite_tracks
    WHERE track_id NOT IN (SELECT id FROM tracks)
  `)
  const deleteOrphanedHistory = database.prepare(`
    DELETE FROM history
    WHERE track_id NOT IN (SELECT id FROM tracks)
  `)

  const transaction = database.transaction((items: Track[]) => {
    if (items.length === 0) {
      deleteAll.run()
      deleteOrphanedPlaylistTracks.run()
      deleteOrphanedFavorites.run()
      deleteOrphanedHistory.run()
      return
    }

    createNextTrackIdsTable.run()
    clearNextTrackIdsTable.run()

    for (const track of items) {
      insertNextTrackId.run(track.id)
    }

    deleteMissing.run()

    for (const track of items) {
      upsert.run(track)
    }

    deleteOrphanedPlaylistTracks.run()
    deleteOrphanedFavorites.run()
    deleteOrphanedHistory.run()
  })

  transaction(tracks)
}

export function getAllTracks() {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT
        tracks.*,
        CASE WHEN favorite_tracks.track_id IS NULL THEN 0 ELSE 1 END AS is_favorite
      FROM tracks
      LEFT JOIN favorite_tracks ON favorite_tracks.track_id = tracks.id
      ORDER BY artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC, title COLLATE NOCASE ASC
    `
    )
    .all() as TrackRow[]

  return rows.map(mapTrackRow)
}

export function searchTracks(keyword: string) {
  const database = getDatabase()
  const trimmedKeyword = keyword.trim()

  if (!trimmedKeyword) {
    return getAllTracks()
  }

  const likeValue = `%${escapeLikePattern(trimmedKeyword)}%`
  const rows = database
    .prepare(
      `
      SELECT
        tracks.*,
        CASE WHEN favorite_tracks.track_id IS NULL THEN 0 ELSE 1 END AS is_favorite
      FROM tracks
      LEFT JOIN favorite_tracks ON favorite_tracks.track_id = tracks.id
      WHERE
        title LIKE @keyword ESCAPE '\\'
        OR artist LIKE @keyword ESCAPE '\\'
        OR album LIKE @keyword ESCAPE '\\'
      ORDER BY title COLLATE NOCASE ASC
    `
    )
    .all({ keyword: likeValue }) as TrackRow[]

  return rows.map(mapTrackRow)
}
