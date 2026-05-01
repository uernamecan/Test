import fs from 'node:fs'
import path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { getDatabasePath } from '../utils/paths'
import { logger } from '../utils/logger'

const FALLBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  duration REAL NOT NULL DEFAULT 0,
  cover_path TEXT,
  lyric_path TEXT,
  format TEXT NOT NULL,
  bitrate INTEGER,
  sample_rate INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  cover_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  played_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorite_tracks (
  track_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks (artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks (album);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks (playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks (track_id);
CREATE INDEX IF NOT EXISTS idx_history_track ON history (track_id);
CREATE INDEX IF NOT EXISTS idx_history_played_at ON history (played_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorite_tracks_created_at ON favorite_tracks (created_at DESC);
`

let database: BetterSqlite3.Database | null = null

function readSchema() {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'electron', 'db', 'schema.sql')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8')
    }
  }

  return FALLBACK_SCHEMA
}

export function initDatabase(databasePath = getDatabasePath()) {
  if (database) {
    return database
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true })

  database = new BetterSqlite3(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  database.exec(readSchema())

  logger.info('Database initialized:', databasePath)

  return database
}

export function getDatabase() {
  if (!database) {
    return initDatabase()
  }

  return database
}

export function closeDatabase() {
  if (!database) {
    return
  }

  database.close()
  database = null
}
