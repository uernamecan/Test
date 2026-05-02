import { matchPath, useLocation } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import { musicApi } from '../../services/api'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'

const titles: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Listen Now', eyebrow: 'Local library' },
  '/library/tracks': { title: 'Songs', eyebrow: 'Library' },
  '/library/favorites': { title: 'Favorites', eyebrow: 'Library' },
  '/library/albums': { title: 'Albums', eyebrow: 'Library' },
  '/search': { title: 'Search', eyebrow: 'Find music' },
  '/settings': { title: 'Settings', eyebrow: 'PulseLocal' }
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
      ? { title: 'Album', eyebrow: 'Library' }
      : matchPath('/playlists/:id', location.pathname)
        ? { title: 'Playlist', eyebrow: 'Curated' }
        : { title: 'PulseLocal', eyebrow: 'Music' })

  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-white/78 px-5 backdrop-blur-2xl dark:border-white/10 dark:bg-[#17171a]/80 sm:px-8">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {copy.eyebrow}
        </div>
        <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {copy.title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleLyrics}
          disabled={!currentTrack}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !currentTrack
              ? 'cursor-not-allowed bg-black/5 text-slate-400 dark:bg-white/5 dark:text-slate-600'
              : lyricsVisible
                ? 'bg-accent text-white'
                : 'bg-black/5 text-slate-700 hover:bg-black/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-white/12'
          }`}
        >
          Lyrics
        </button>
        <button
          type="button"
          onClick={toggleQueue}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            queueVisible
              ? 'bg-accent text-white'
              : 'bg-black/5 text-slate-700 hover:bg-black/10 dark:bg-white/8 dark:text-slate-200 dark:hover:bg-white/12'
          }`}
        >
          Queue
        </button>
        <ThemeToggle />
        <div className="ml-1 flex items-center gap-1 rounded-full bg-black/5 p-1 dark:bg-white/8">
          <button
            type="button"
            onClick={() => void musicApi.minimizeWindow()}
            className="grid h-8 w-8 place-items-center rounded-full text-xs text-slate-600 transition hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/12"
            aria-label="Minimize window"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => void musicApi.toggleMaximizeWindow()}
            className="grid h-8 w-8 place-items-center rounded-full text-xs text-slate-600 transition hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/12"
            aria-label="Maximize window"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => void musicApi.closeWindow()}
            className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-500/15"
            aria-label="Close window"
          >
            x
          </button>
        </div>
      </div>
    </header>
  )
}
