import { getDatabase } from '../client'

export function setTrackFavorite(trackId: string, isFavorite: boolean) {
  const database = getDatabase()

  if (isFavorite) {
    database
      .prepare(
        `
        INSERT OR IGNORE INTO favorite_tracks (track_id, created_at)
        VALUES (?, ?)
      `
      )
      .run(trackId, new Date().toISOString())

    return true
  }

  database
    .prepare(
      `
      DELETE FROM favorite_tracks
      WHERE track_id = ?
    `
    )
    .run(trackId)

  return false
}
