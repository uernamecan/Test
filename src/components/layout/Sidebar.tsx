import { useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import PlaylistQuickActions from '../library/PlaylistQuickActions'
import CoverArtwork from '../player/CoverArtwork'
import { APP_NAME } from '../../lib/constants'
import { matchesSearchTerms } from '../../lib/search'
import { useFeedbackStore } from '../../store/feedbackStore'
import { usePlaylistStore } from '../../store/playlistStore'
import { useUiStore } from '../../store/uiStore'

const navigationItems = [
  { to: '/', label: 'Listen Now', icon: '>' },
  { to: '/library/tracks', label: 'Songs', icon: 'S' },
  { to: '/library/favorites', label: 'Favorites', icon: 'F' },
  { to: '/library/albums', label: 'Albums', icon: 'A' },
  { to: '/search', label: 'Search', icon: '/' },
  { to: '/settings', label: 'Settings', icon: '*' }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const playlists = usePlaylistStore((state) => state.playlists)
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist)
  const loading = usePlaylistStore((state) => state.loading)
  const error = usePlaylistStore((state) => state.error)
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [draftName, setDraftName] = useState('')
  const [playlistFilter, setPlaylistFilter] = useState('')

  const filteredPlaylists = useMemo(() => {
    return playlists.filter((playlist) => matchesSearchTerms([playlist.name], playlistFilter)).slice(0, 10)
  }, [playlistFilter, playlists])

  const handleCreatePlaylist = async () => {
    const trimmedName = draftName.trim()

    if (!trimmedName) {
      return
    }

    const playlist = await createPlaylist(trimmedName)

    if (playlist) {
      setDraftName('')
      showFeedback(`Created playlist ${playlist.name}.`)
      navigate(`/playlists/${playlist.id}`)
    }
  }

  return (
    <aside
      className={`flex h-full flex-col border-r border-black/10 bg-[#f2f2f7]/88 px-3 py-4 text-slate-950 backdrop-blur-2xl transition dark:border-white/10 dark:bg-[#1c1c1f]/92 dark:text-slate-100 ${
        sidebarCollapsed ? 'w-[82px]' : 'w-[260px]'
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-3 px-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Music</div>
          {!sidebarCollapsed ? (
            <div className="mt-1 truncate text-xl font-bold tracking-tight">{APP_NAME}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-sm text-slate-500 transition hover:bg-black/10 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '>' : '<'}
        </button>
      </div>

      <nav className="grid gap-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-accent shadow-sm dark:bg-white/10'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
              }`
            }
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center text-base">{item.icon}</span>
            {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      {!sidebarCollapsed ? (
        <section className="mt-7 min-h-0 flex-1">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Playlists
            </div>
            <div className="text-xs text-slate-400">{playlists.length}</div>
          </div>

          <input
            value={playlistFilter}
            onChange={(event) => setPlaylistFilter(event.target.value)}
            placeholder="Filter playlists"
            className="mb-3 w-full rounded-xl border border-black/5 bg-white/70 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-accent/40 dark:border-white/10 dark:bg-white/8 dark:text-white"
          />

          <div className="grid max-h-[34vh] gap-1 overflow-y-auto pr-1">
            {filteredPlaylists.length > 0 ? (
              filteredPlaylists.map((playlist) => (
                <NavLink
                  key={playlist.id}
                  to={`/playlists/${playlist.id}`}
                  className={({ isActive }) =>
                    `group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm transition ${
                      isActive
                        ? 'bg-white text-slate-950 shadow-sm dark:bg-white/10 dark:text-white'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
                    }`
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CoverArtwork
                      coverPath={playlist.coverPath}
                      title={playlist.name}
                      className="h-9 w-9 shrink-0 rounded-lg"
                      fallbackLabel={playlist.name.slice(0, 2)}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{playlist.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{playlist.trackCount ?? 0} songs</div>
                    </div>
                  </div>
                  <PlaylistQuickActions playlistId={playlist.id} playlistName={playlist.name} />
                </NavLink>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {playlists.length > 0 ? 'No matching playlists.' : 'No playlists yet.'}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-white/60 p-3 shadow-sm dark:bg-white/7">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              New Playlist
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={80}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreatePlaylist()
                  }
                }}
                placeholder="Name"
                className="min-w-0 flex-1 rounded-xl border border-black/5 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-accent/40 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <button
                type="button"
                onClick={() => void handleCreatePlaylist()}
                disabled={loading || !draftName.trim()}
                className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
          </div>
        </section>
      ) : null}
    </aside>
  )
}
