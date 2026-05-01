import { Link } from 'react-router-dom'
import TrackActionMenu from '../library/TrackActionMenu'
import AudioVisualizer from './AudioVisualizer'
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
import { useUiStore } from '../../store/uiStore'
import { usePlayerStore } from '../../store/playerStore'
import { formatDuration, formatTrackMeta } from '../../lib/format'
import { getAlbumRoute } from '../../lib/library'
import { PLAY_MODE_LABELS } from '../../lib/constants'

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
  const lyricsVisible = useUiStore((state) => state.lyricsVisible)
  const setQueueVisible = useUiStore((state) => state.setQueueVisible)
  const toggleLyrics = useUiStore((state) => state.toggleLyrics)

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

  const trackMetaBadges = currentTrack
    ? [
        formatTrackMeta(currentTrack.format, currentTrack.bitrate),
        formatDuration(currentTrack.duration),
        currentTrack.sampleRate ? `${Math.round(currentTrack.sampleRate / 1000)} kHz` : null
      ].filter((value): value is string => Boolean(value))
    : ['Local library', 'Drag in folders', 'Gapless vibes pending']
  const remainingQueueCount = currentTrack ? Math.max(queue.length - currentIndex - 1, 0) : 0
  const queuePositionLabel = currentTrack && queue.length > 0 ? `${currentIndex + 1}/${queue.length}` : 'Idle'
  const modeDescription =
    playMode === 'sequence'
      ? 'Queue moves forward in order.'
      : playMode === 'repeat-all'
        ? 'Entire queue loops continuously.'
        : playMode === 'repeat-one'
          ? 'Current track repeats until changed.'
          : 'Queue order is shuffled on next steps.'
  const lyricsButtonLabel = !currentTrack
    ? 'Lyrics Idle'
    : lyricsVisible
      ? 'Hide Lyrics'
      : currentTrack.lyricPath
        ? 'Show Lyrics'
        : 'Lyrics Panel'
  const lyricsDescription = !currentTrack
    ? 'Load a track to open synced lyrics.'
    : currentTrack.lyricPath
      ? 'Timed lyrics are ready for this track.'
      : 'No .lrc found yet, but the panel can still stay handy.'

  return (
    <footer className="border-t border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_420px] xl:items-center">
        <div className="flex min-w-0 flex-col items-start gap-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] px-3 py-3 sm:flex-row sm:items-center">
          {currentTrack ? (
            <Link
              to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
              className="shrink-0 transition hover:scale-[1.02]"
              aria-label={`Open album ${currentTrack.album}`}
            >
              <CoverArtwork
                coverPath={currentTrack.coverPath}
                title={currentTrack.title}
                className="h-20 w-20 rounded-[1.4rem]"
                fallbackLabel="Mix"
              />
            </Link>
          ) : (
            <CoverArtwork
              className="h-20 w-20 rounded-[1.4rem]"
              fallbackLabel="Mix"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-white">
                  {currentTrack ? 'Now Playing' : 'Library Ready'}
                </div>
                <div className="mt-1 truncate text-sm text-slate-400">
                  {currentTrack ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        {currentTrack.artist}
                      </span>
                      <span className="text-slate-500">/</span>
                      <Link
                        to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
                        className="transition hover:text-white"
                      >
                        {currentTrack.album}
                      </Link>
                    </div>
                  ) : (
                    'Supports mp3 / flac / wav / m4a / ogg'
                  )}
                </div>
              </div>
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
            <div className="mt-3 flex items-center gap-2">
              {currentTrack ? (
                <Link
                  to={getAlbumRoute(currentTrack.artist, currentTrack.album)}
                  className="min-w-0 truncate text-sm font-semibold text-white transition hover:text-aurora"
                >
                  {currentTrack.title}
                </Link>
              ) : (
                <div className="min-w-0 truncate text-sm font-semibold text-white">
                  Choose a local track to start playback
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {trackMetaBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="order-3 space-y-3 lg:col-span-2 lg:order-2 xl:col-span-1">
          <div className="flex justify-center">
            <PlaybackControls
              isPlaying={isPlaying}
              playMode={playMode}
              onPrevious={() => void playPreviousCommand()}
              onToggle={() => void togglePlaybackCommand()}
              onNext={() => void playNextCommand()}
              onCycleMode={cyclePlayMode}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.16em] text-slate-300">
              {PLAY_MODE_LABELS[playMode]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.16em] text-slate-300">
              Queue {queuePositionLabel}
            </span>
            <button
              type="button"
              onClick={() => setQueueVisible(true)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/10"
            >
              {remainingQueueCount > 0 ? `${remainingQueueCount} Next Up` : 'Open Queue'}
            </button>
            <button
              type="button"
              onClick={toggleLyrics}
              disabled={!currentTrack}
              className={`rounded-full border px-3 py-1 uppercase tracking-[0.16em] transition ${
                !currentTrack
                  ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500'
                  : lyricsVisible
                    ? 'border-aurora/40 bg-aurora/15 text-aurora hover:bg-aurora/20'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {lyricsButtonLabel}
            </button>
          </div>
          <div className="space-y-1 text-center text-xs text-slate-500">
            <div>{modeDescription}</div>
            <div>{lyricsDescription}</div>
          </div>
          <ProgressBar progress={progress} duration={duration} onSeek={handleSeek} />
        </div>
        <div className="order-2 grid gap-3 lg:col-span-1 lg:order-3 xl:col-span-1">
          <AudioVisualizer />
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <VolumeControl volume={volume} onChange={handleVolumeChange} onToggleMute={handleToggleMute} />
            <SleepTimerControl />
          </div>
        </div>
      </div>
    </footer>
  )
}
