import { randomUUID } from 'node:crypto'
import type { HistoryEntry } from '../../../src/types/history'
import { getDatabase } from '../client'
import { mapTrackRow, type TrackRow } from './tracksRepo'

type HistoryRow = TrackRow & {
  history_id: string
  track_id: string
  played_at: string
}

function mapHistoryRow(row: HistoryRow): HistoryEntry {
  return {
    id: row.history_id,
    trackId: row.track_id,
    playedAt: row.played_at,
    track: mapTrackRow(row)
  }
}

export function addHistoryEntry(trackId: string) {
  const database = getDatabase()
  const historyId = randomUUID()
  const playedAt = new Date().toISOString()

  database
    .prepare(
      `
      INSERT INTO history (id, track_id, played_at)
      VALUES (?, ?, ?)
    `
    )
    .run(historyId, trackId, playedAt)

  const row = database
    .prepare(
      `
      SELECT
        history.id AS history_id,
        history.track_id,
        history.played_at,
        tracks.*,
        CASE WHEN favorite_tracks.track_id IS NULL THEN 0 ELSE 1 END AS is_favorite
      FROM history
      INNER JOIN tracks ON tracks.id = history.track_id
      LEFT JOIN favorite_tracks ON favorite_tracks.track_id = tracks.id
      WHERE history.id = ?
    `
    )
    .get(historyId) as HistoryRow | undefined

  return row ? mapHistoryRow(row) : null
}

export function getRecentHistory(limit = 10) {
  const database = getDatabase()
  const rows = database
    .prepare(
      `
      SELECT
        deduped.history_id,
        deduped.track_id,
        deduped.played_at,
        deduped.id,
        deduped.path,
        deduped.title,
        deduped.artist,
        deduped.album,
        deduped.duration,
        deduped.cover_path,
        deduped.lyric_path,
        deduped.format,
        deduped.bitrate,
        deduped.sample_rate,
        deduped.created_at,
        deduped.updated_at,
        deduped.is_favorite
      FROM (
        SELECT
          history.id AS history_id,
          history.track_id,
          history.played_at,
          tracks.*,
          CASE WHEN favorite_tracks.track_id IS NULL THEN 0 ELSE 1 END AS is_favorite,
          ROW_NUMBER() OVER (
            PARTITION BY history.track_id
            ORDER BY history.played_at DESC, history.id DESC
          ) AS track_rank
        FROM history
        INNER JOIN tracks ON tracks.id = history.track_id
        LEFT JOIN favorite_tracks ON favorite_tracks.track_id = tracks.id
      ) AS deduped
      WHERE deduped.track_rank = 1
      ORDER BY deduped.played_at DESC
      LIMIT ?
    `
    )
    .all(limit) as HistoryRow[]

  return rows.map(mapHistoryRow)
}

export function clearHistory() {
  const database = getDatabase()
  const result = database.prepare('DELETE FROM history').run()

  return result.changes
}

export function removeHistoryEntry(historyId: string) {
  const database = getDatabase()
  const result = database.prepare('DELETE FROM history WHERE id = ?').run(historyId)

  return result.changes
}
