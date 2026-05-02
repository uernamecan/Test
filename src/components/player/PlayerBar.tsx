import { Link } from 'react-router-dom'
import TrackActionMenu from '../library/TrackActionMenu'
import CoverArtwork from './CoverArtwork'
import PlaybackControls from './PlaybackControls'
import ProgressBar from './ProgressBar'
import SleepTimerControl from './SleepTimerControl'
import VolumeControl from './VolumeControl'
import { playerService } from '../../services/player'
import {
  playNextCommand,
  playPreviousCommand,
  togglePlaybackCommand
} from '../../services/playerCommands'
import { usePlayerStore } from '../../store/playerStore'
import { formatTrackMeta } from '../../lib/format'
import { getAlbumRoute } from '../../lib/library'

export default function PlayerBar() {
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const queue = usePlayerStore((state) => state.queue)
  const currentIndex = usePlayerStore((state) => state.currentIndex)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const volume = usePlayerStore((state) => state.volume)
  const progress = usePlayerStore((state) => state.progress)
  const duration = usePlayerStore((state) => state.duration)
  const playMode = usePlayerStore((state) => state.playMode)
  const setVolume = usePlayerStore((state) => state.setVolume)
  const toggleMute = usePlayerStore((state) => state.toggleMute)
  const setProgress = usePlayerStore((state) => state.setProgress)
  const cyclePlayMode = usePlayerStore((state) => state.cyclePlayMode)

  const handleSeek = (nextProgress: number) => {
    if (!currentTrack || duration <= 0) {
      return
    }

    const safeProgress = Math.min(Math.max(nextProgress, 0), duration)
    playerService.seekTo(safeProgress)
    setProgress(safeProgress)
  }

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume)
    playerService.setVolume(nextVolume)
  }

  const handleToggleMute = () => {
    const nextVolume = toggleMute()
    playerService.setVolume(nextVolume)
  }

  return (
    <footer className="border-t border-black/10 bg-[#f8f8fb]/92 px-4 py-3 shadow-[0_-18px_44px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#202024]/92 sm:px-6">
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(360px,1.2fr)_minmax(230px,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack ? (
            <Link
              to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
              className="shrink-0 transition hover:scale-[1.02]"
              aria-label={`Open album ${currentTrack.album}`}
            >
              <CoverArtwork
                coverPath={currentTrack.coverPath}
                title={currentTrack.title}
                className="h-14 w-14 rounded-xl"
                fallbackLabel="Mix"
              />
            </Link>
          ) : (
            <CoverArtwork className="h-14 w-14 rounded-xl" fallbackLabel="Mix" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              {currentTrack ? (
                <Link
                  to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
                  className="truncate text-sm font-semibold text-slate-950 transition hover:text-accent dark:text-white"
                >
                  {currentTrack.title}
                </Link>
              ) : (
                <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  Choose a song
                </div>
              )}
              {currentTrack ? (
                <TrackActionMenu
                  track={currentTrack}
                  placement="top"
                  compact
                  buttonLabel="More"
                  triggerAriaLabel={`More actions for ${currentTrack.title}`}
                />
              ) : null}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {currentTrack
                ? `${currentTrack.artist} - ${currentTrack.album}`
                : 'Import local music to start listening'}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <PlaybackControls
            isPlaying={isPlaying}
            playMode={playMode}
            onPrevious={() => void playPreviousCommand()}
            onToggle={() => void togglePlaybackCommand()}
            onNext={() => void playNextCommand()}
            onCycleMode={cyclePlayMode}
          />
          <ProgressBar progress={progress} duration={duration} onSeek={handleSeek} />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <div className="hidden min-w-0 text-right text-xs text-slate-500 dark:text-slate-400 xl:block">
            <div>{currentTrack ? formatTrackMeta(currentTrack.format, currentTrack.bitrate) : 'Local files'}</div>
            <div className="mt-0.5">
              {currentTrack && queue.length > 0 ? `${currentIndex + 1} of ${queue.length}` : 'Queue idle'}
            </div>
          </div>
          <VolumeControl volume={volume} onChange={handleVolumeChange} onToggleMute={handleToggleMute} />
          <SleepTimerControl />
        </div>
      </div>
    </footer>
  )
}
