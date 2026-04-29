export type PlayMode = 'sequence' | 'repeat-all' | 'repeat-one' | 'shuffle'

export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  duration: number
  coverPath?: string
  lyricPath?: string
  isFavorite?: boolean
  format: string
  bitrate?: number
  sampleRate?: number
  createdAt: string
  updatedAt: string
}
