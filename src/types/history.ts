import type { Track } from './track'

export interface HistoryEntry {
  id: string
  trackId: string
  playedAt: string
  track: Track
}

