import { matchPath, useLocation } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import { musicApi } from '../../services/api'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'

const titles: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Local Music Hub',
    subtitle: 'Import folders, scan metadata, and grow the player from a clean desktop-first base.'
  },
  '/library/tracks': {
    title: 'All Tracks',
    subtitle: 'Browse everything in the local library and start playback with one click.'
  },
  '/library/favorites': {
    title: 'Favorites',
    subtitle: 'Keep a focused shelf of liked tracks and return to them instantly.'
  },
  '/library/albums': {
    title: 'Albums',
    subtitle: 'Explore the library album by album, then drill into individual releases.'
  },
  '/search': {
    title: 'Search',
    subtitle: 'Filter the local library quickly now, and grow into SQLite search later if needed.'
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Manage theme, saved folders, and the app-level behavior exposed through the preload bridge.'
  }
}

export default function Header() {
  const location = useLocation()
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const lyricsVisible = useUiStore((state) => state.lyricsVisible)
  const queueVisible = useUiStore((state) => state.queueVisible)
  const toggleQueue = useUiStore((state) => state.toggleQueue)
  const toggleLyrics = useUiStore((state) => state.toggleLyrics)

  const copy =
    titles[location.pathname] ??
    (matchPath('/library/albums/:artistId/:albumId', location.pathname)
        ? {
            title: 'Album Detail',
            subtitle: 'Review the track list for a release and play it as a focused queue.'
          }
      : matchPath('/playlists/:id', location.pathname)
          ? {
              title: 'Playlist Detail',
              subtitle: 'Rename, curate, and manage a custom listening queue from the local library.'
            }
          : {
              title: 'Player',
              subtitle: 'Keep iterating on the desktop shell with richer views and playback workflows.'
            })

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-aurora">PulseLocal</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{copy.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleLyrics}
          disabled={!currentTrack}
          className={`rounded-2xl border px-4 py-2 text-sm transition ${
            !currentTrack
              ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500'
              : lyricsVisible
                ? 'border-aurora/40 bg-aurora/15 text-aurora hover:bg-aurora/20'
                : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
          }`}
        >
          {lyricsVisible ? 'Hide Lyrics' : 'Lyrics'}
        </button>
        <button
          type="button"
          onClick={toggleQueue}
          className={`rounded-2xl border px-4 py-2 text-sm transition ${
            queueVisible
              ? 'border-aurora/40 bg-aurora/15 text-aurora hover:bg-aurora/20'
              : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
          }`}
        >
          {queueVisible ? 'Hide Queue' : 'Queue'}
        </button>
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void musicApi.minimizeWindow()}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            Minimize
          </button>
          <button
            type="button"
            onClick={() => void musicApi.toggleMaximizeWindow()}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            Maximize
          </button>
          <button
            type="button"
            onClick={() => void musicApi.closeWindow()}
            className="rounded-xl border border-red-400/30 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10"
          >
            Close
          </button>
        </div>
      </div>
    </header>
  )
}
