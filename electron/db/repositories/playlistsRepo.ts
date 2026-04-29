import { randomUUID } from 'node:crypto'
import type { Playlist } from '../../../src/types/playlist'
import type { Track } from '../../../src/types/track'
import { getDatabase } from '../client'
import { mapTrackRow, type TrackRow } from './tracksRepo'

type PlaylistRow = {
  id: string
  name: string
  cover_path: string | null
  track_count?: number
  created_at: string
  updated_at: string
}

function mapPlaylistRow(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    coverPath: row.cover_path ?? undefined,
    trackCount: row.track_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function normalizePlaylistName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function resolveUniquePlaylistName(name: string, currentPlaylistId?: string) {
  const database = getDatabase()
  const trimmedName = normalizePlaylistName(name)
  const rows = database
    .prepare(
      `
      SELECT id, name
      FROM playlists
      WHERE name = ? OR name LIKE ?
    `
    )
    .all(trimmedName, `${trimmedName} (%)`) as Array<{ id: string; name: string }>
  const existingNames = new Set(
    rows
      .filter((row) => row.id !== currentPlaylistId)
      .map((row) => row.name.toLowerCase())
  )

  if (!existingNames.has(trimmedName.toLowerCase())) {
    return trimmedName
  }

  for (let index = 2; index < 10000; index += 1) {
    const candidateName = `${trimmedName} (${index})`

    if (!existingNames.has(candidateName.toLowerCase())) {
      return candidateName
    }
  }

  return `${trimmedName} (${Date.now()})`
}

function refreshPlaylistCover(playlistId: string) {
  const database = getDatabase()
  const row = database
    .prepare(
      `
      SELECT tracks.cover_path
      FROM playlist_tracks
      INNER JOIN tracks ON tracks.id = playlist_tracks.track_id
      WHERE playlist_tracks.playlist_id = ? AND tracks.cover_path IS NOT NULL
      ORDER BY playlist_tracks.position ASC
      LIMIT 1
    `
    )
    .get(playlistId) as { cover_path: string | null } | undefined
  const coverPath = row?.cover_path ?? null

  database
    .prepare(
      `
      UPDATE playlists
      SET cover_path = ?
      WHERE id = ?
    `
    )
    .run(coverPath, playlistId)

  return coverPath
}

function refreshPlaylistCoverIfChanged(playlistId: string, currentCoverPath: string | null) {
  const nextCoverPath = refreshPlaylistCover(playlistId)

  if ((nextCoverPath ?? null) === (currentCoverPath ?? null)) {
    return false
  }

  databaseTouchPlaylist(playlistId)
  return true
}

function databaseTouchPlaylist(playlistId: string) {
  const database = getDatabase()

  database
    .prepare(
      `
      UPDATE playlists
      SET updated_at = ?
      WHERE id = ?
    `
    )
    .run(new Date().toISOString(), playlistId)
}

export function refreshAllPlaylistCovers() {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT id, cover_path
      FROM playlists
    `
    )
    .all() as Array<{ id: string; cover_path: string | null }>
  const transaction = database.transaction(() => {
    let changedCount = 0

    rows.forEach((row) => {
      if (refreshPlaylistCoverIfChanged(row.id, row.cover_path)) {
        changedCount += 1
      }
    })

    return {
      checkedCount: rows.length,
      changedCount
    }
  })

  return transaction()
}

export function createPlaylist(name: string) {
  const database = getDatabase()
  const timestamp = new Date().toISOString()
  const playlistName = resolveUniquePlaylistName(name)
  const playlist: Playlist = {
    id: randomUUID(),
    name: playlistName,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  database
    .prepare(
      `
      INSERT INTO playlists (id, name, cover_path, created_at, updated_at)
      VALUES (@id, @name, @coverPath, @createdAt, @updatedAt)
    `
    )
    .run({
      ...playlist,
      coverPath: null
    })

  return playlist
}

export function createPlaylistWithTracks(name: string, trackIds: string[]) {
  const database = getDatabase()
  const uniqueTrackIds = Array.from(new Set(trackIds.filter((trackId) => trackId.trim().length > 0)))
  const timestamp = new Date().toISOString()
  const playlistName = resolveUniquePlaylistName(name)
  const playlist: Playlist = {
    id: randomUUID(),
    name: playlistName,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  const transaction = database.transaction(() => {
    database
      .prepare(
        `
        INSERT INTO playlists (id, name, cover_path, created_at, updated_at)
        VALUES (@id, @name, @coverPath, @createdAt, @updatedAt)
      `
      )
      .run({
        ...playlist,
        coverPath: null
      })

    const insertTrack = database.prepare(
      `
      INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
      VALUES (?, ?, ?)
    `
    )

    let addedCount = 0

    uniqueTrackIds.forEach((trackId, index) => {
      const result = insertTrack.run(playlist.id, trackId, index)

      if (result.changes > 0) {
        addedCount += 1
      }
    })

    const coverPath = refreshPlaylistCover(playlist.id)

    return {
      playlist: {
        ...playlist,
        coverPath: coverPath ?? undefined,
        trackCount: addedCount
      },
      addedCount,
      skippedCount: trackIds.length - addedCount
    }
  })

  return transaction()
}

export function renamePlaylist(playlistId: string, name: string) {
  const database = getDatabase()
  const updatedAt = new Date().toISOString()
  const playlistName = resolveUniquePlaylistName(name, playlistId)

  database
    .prepare(
      `
      UPDATE playlists
      SET name = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(playlistName, updatedAt, playlistId)

  return getPlaylistById(playlistId)
}

export function getPlaylists() {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT
        playlists.*,
        COUNT(playlist_tracks.track_id) AS track_count,
        COALESCE(
          playlists.cover_path,
          (
            SELECT tracks.cover_path
            FROM playlist_tracks AS cover_playlist_tracks
            INNER JOIN tracks ON tracks.id = cover_playlist_tracks.track_id
            WHERE cover_playlist_tracks.playlist_id = playlists.id
              AND tracks.cover_path IS NOT NULL
            ORDER BY cover_playlist_tracks.position ASC
            LIMIT 1
          )
        ) AS cover_path
      FROM playlists
      LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
      GROUP BY playlists.id
      ORDER BY playlists.updated_at DESC, playlists.name COLLATE NOCASE ASC
    `
    )
    .all() as PlaylistRow[]

  return rows.map(mapPlaylistRow)
}

export function addTrackToPlaylist(playlistId: string, trackId: string) {
  const database = getDatabase()
  const positionRow = database
    .prepare(
      `
      SELECT COALESCE(MAX(position), -1) + 1 AS next_position
      FROM playlist_tracks
      WHERE playlist_id = ?
    `
    )
    .get(playlistId) as { next_position: number } | undefined

  const insertionResult = database
    .prepare(
      `
      INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
      VALUES (?, ?, ?)
    `
    )
    .run(playlistId, trackId, positionRow?.next_position ?? 0)

  if (insertionResult.changes > 0) {
    refreshPlaylistCover(playlistId)
    database
      .prepare(
        `
        UPDATE playlists
        SET updated_at = ?
        WHERE id = ?
      `
      )
      .run(new Date().toISOString(), playlistId)
  }

  return insertionResult.changes > 0
}

export function getPlaylistById(playlistId: string) {
  const database = getDatabase()
  const row = database
    .prepare(
      `
      SELECT
        playlists.*,
        COUNT(playlist_tracks.track_id) AS track_count,
        COALESCE(
          playlists.cover_path,
          (
            SELECT tracks.cover_path
            FROM playlist_tracks AS cover_playlist_tracks
            INNER JOIN tracks ON tracks.id = cover_playlist_tracks.track_id
            WHERE cover_playlist_tracks.playlist_id = playlists.id
              AND tracks.cover_path IS NOT NULL
            ORDER BY cover_playlist_tracks.position ASC
            LIMIT 1
          )
        ) AS cover_path
      FROM playlists
      LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
      WHERE playlists.id = ?
      GROUP BY playlists.id
    `
    )
    .get(playlistId) as PlaylistRow | undefined

  if (!row) {
    return null
  }

  return mapPlaylistRow(row)
}

export function getPlaylistTracks(playlistId: string) {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT
        tracks.*,
        CASE WHEN favorite_tracks.track_id IS NULL THEN 0 ELSE 1 END AS is_favorite
      FROM playlist_tracks
      INNER JOIN tracks ON tracks.id = playlist_tracks.track_id
      LEFT JOIN favorite_tracks ON favorite_tracks.track_id = tracks.id
      WHERE playlist_tracks.playlist_id = ?
      ORDER BY playlist_tracks.position ASC, tracks.title COLLATE NOCASE ASC
    `
    )
    .all(playlistId) as TrackRow[]

  return rows.map(mapTrackRow)
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  const database = getDatabase()
  const transaction = database.transaction(() => {
    database
      .prepare(
        `
        DELETE FROM playlist_tracks
        WHERE playlist_id = ? AND track_id = ?
      `
      )
      .run(playlistId, trackId)

    const rows = database
      .prepare(
        `
        SELECT track_id
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC
      `
      )
      .all(playlistId) as Array<{ track_id: string }>

    const updatePosition = database.prepare(
      `
      UPDATE playlist_tracks
      SET position = ?
      WHERE playlist_id = ? AND track_id = ?
    `
    )

    rows.forEach((row, index) => {
      updatePosition.run(index, playlistId, row.track_id)
    })

    refreshPlaylistCover(playlistId)

    database
      .prepare(
        `
        UPDATE playlists
        SET updated_at = ?
        WHERE id = ?
      `
      )
      .run(new Date().toISOString(), playlistId)
  })

  transaction()
}

export function moveTrackInPlaylist(playlistId: string, trackId: string, targetPosition: number) {
  const database = getDatabase()
  const transaction = database.transaction(() => {
    const rows = database
      .prepare(
        `
        SELECT track_id
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC
      `
      )
      .all(playlistId) as Array<{ track_id: string }>

    const currentIndex = rows.findIndex((row) => row.track_id === trackId)

    if (currentIndex < 0) {
      return false
    }

    const safeTargetPosition = Math.min(Math.max(targetPosition, 0), rows.length - 1)

    if (currentIndex === safeTargetPosition) {
      return true
    }

    const nextRows = [...rows]
    const [movedRow] = nextRows.splice(currentIndex, 1)
    nextRows.splice(safeTargetPosition, 0, movedRow)

    const updatePosition = database.prepare(
      `
      UPDATE playlist_tracks
      SET position = ?
      WHERE playlist_id = ? AND track_id = ?
    `
    )

    nextRows.forEach((row, index) => {
      updatePosition.run(index, playlistId, row.track_id)
    })

    refreshPlaylistCover(playlistId)

    database
      .prepare(
        `
        UPDATE playlists
        SET updated_at = ?
        WHERE id = ?
      `
      )
      .run(new Date().toISOString(), playlistId)

    return true
  })

  return transaction()
}

export function deletePlaylist(playlistId: string) {
  const database = getDatabase()
  const transaction = database.transaction(() => {
    database
      .prepare(
        `
        DELETE FROM playlist_tracks
        WHERE playlist_id = ?
      `
      )
      .run(playlistId)

    database
      .prepare(
        `
        DELETE FROM playlists
        WHERE id = ?
      `
      )
      .run(playlistId)
  })

  transaction()
}
