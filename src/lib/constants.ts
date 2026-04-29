import type { PlayMode } from '../types/track'

export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'PulseLocal'

export const PLAY_MODE_ORDER: PlayMode[] = [
  'sequence',
  'repeat-all',
  'repeat-one',
  'shuffle'
]

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: 'Sequence',
  'repeat-all': 'Repeat All',
  'repeat-one': 'Repeat One',
  shuffle: 'Shuffle'
}
