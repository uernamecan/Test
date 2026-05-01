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
  { to: '/', label: 'Home' },
  { to: '/library/tracks', label: 'Tracks' },
  { to: '/library/favorites', label: 'Favorites' },
  { to: '/library/albums', label: 'Albums' },
  { to: '/search', label: 'Search' },
  { to: '/settings', label: 'Settings' }
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
    return playlists.filter((playlist) => matchesSearchTerms([playlist.name], playlistFilter))
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
      className={`flex h-full flex-col border-r border-white/10 bg-slate-950/70 px-4 py-5 backdrop-blur-xl transition ${
        sidebarCollapsed ? 'w-[92px]' : 'w-[280px]'
      }`}
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-aurora">Desktop Player</div>
          {!sidebarCollapsed ? (
            <div className="truncate text-lg font-semibold text-white">{APP_NAME}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          {sidebarCollapsed ? '>>' : '<<'}
        </button>
      </div>

      <nav className="grid gap-2">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-2xl px-4 py-3 text-sm transition ${
                isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {sidebarCollapsed ? item.label.slice(0, 2) : item.label}
          </NavLink>
        ))}
      </nav>

      {!sidebarCollapsed ? (
        <div className="mt-8 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Playlists</div>
              <div className="text-xs text-slate-500">{playlists.length}</div>
            </div>
            <div className="mt-3">
              <input
                value={playlistFilter}
                onChange={(event) => setPlaylistFilter(event.target.value)}
                placeholder="Filter playlists"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="mt-3 grid gap-2">
              {filteredPlaylists.length > 0 ? (
                filteredPlaylists.map((playlist) => (
                  <NavLink
                    key={playlist.id}
                    to={`/playlists/${playlist.id}`}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                        isActive
                          ? 'bg-white text-slate-950'
                          : 'bg-slate-950/45 text-slate-100 hover:bg-white/10'
                      }`
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <CoverArtwork
                        coverPath={playlist.coverPath}
                        title={playlist.name}
                        className="h-10 w-10 shrink-0 rounded-xl"
                        fallbackLabel={playlist.name.slice(0, 2)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{playlist.name}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] opacity-70">
                          {playlist.trackCount ?? 0} tracks
                        </div>
                      </div>
                    </div>
                    <PlaylistQuickActions
                      playlistId={playlist.id}
                      playlistName={playlist.name}
                    />
                  </NavLink>
                ))
              ) : playlists.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  No playlists match this filter.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  No playlists yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Create Playlist</div>
            <div className="mt-3 grid gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={80}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreatePlaylist()
                  }
                }}
                placeholder="Playlist name"
                className="rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => void handleCreatePlaylist()}
                disabled={loading || !draftName.trim()}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create
              </button>
              {error ? <p className="text-xs text-rose-200">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">MVP</div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Import folders, scan metadata, browse the library, play tracks, and manage playlists in
          one desktop shell.
        </p>
      </div>
    </aside>
  )
}
