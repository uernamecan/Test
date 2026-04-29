import type { Track } from '../../types/track'
import TrackActionMenu from './TrackActionMenu'

type TrackLibraryActionsProps = {
  track: Track
}

export default function TrackLibraryActions({ track }: TrackLibraryActionsProps) {
  return <TrackActionMenu track={track} />
}
