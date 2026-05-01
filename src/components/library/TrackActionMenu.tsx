import { Link } from 'react-router-dom'
import { useCallback, useRef, useState } from 'react'
import { useTrackSystemActions } from '../../hooks/useTrackSystemActions'
import FavoriteButton from '../common/FavoriteButton'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { useMenuNavigation } from '../../hooks/useMenuNavigation'
import { getAlbumRoute } from '../../lib/library'
import type { Track } from '../../types/track'
import AddToPlaylistButton from './AddToPlaylistButton'
import AddToQueueButton from './AddToQueueButton'

type TrackActionMenuProps = {
  track: Track
  onRemove?: () => void
  placement?: 'top' | 'bottom'
  compact?: boolean
  buttonLabel?: string
  triggerAriaLabel?: string
  removeSectionLabel?: string
  removeButtonLabel?: string
}

export default function TrackActionMenu({
  track,
  onRemove,
  placement = 'bottom',
  compact = false,
  buttonLabel = 'Actions',
  triggerAriaLabel,
  removeSectionLabel = 'Playlist',
  removeButtonLabel = 'Remove From Playlist'
}: TrackActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<
    'folder' | 'system' | 'copy' | 'lyrics-folder' | 'lyrics-file' | 'cover-folder' | 'cover-file' | null
  >(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const {
    showTrackInFolder,
    openTrackFile,
    showTrackLyricsInFolder,
    openTrackLyricsFile,
    showTrackCoverInFolder,
    openTrackCoverFile,
    copyTrackPath,
    copyTrackLyricsPath,
    copyTrackCoverPath
  } = useTrackSystemActions()
  const menuPlacementClass = placement === 'top' ? 'bottom-11 right-0' : 'right-0 top-11'
  const triggerClassName = compact
    ? 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10'
    : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10'

  const handleDismiss = useCallback(() => {
    setOpen(false)
  }, [])

  useDismissableLayer({
    enabled: open,
    container: containerRef.current,
    onDismiss: handleDismiss
  })
  useMenuNavigation({
    enabled: open,
    container: containerRef.current
  })

  const handleShowInFolder = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('folder')
      await showTrackInFolder(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'folder' ? null : currentAction))
    }
  }

  const handleOpenTrackFile = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('system')
      await openTrackFile(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'system' ? null : currentAction))
    }
  }

  const handleCopyTrackPath = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('copy')
      await copyTrackPath(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'copy' ? null : currentAction))
    }
  }

  const handleCopyLyricsPath = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('copy')
      await copyTrackLyricsPath(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'copy' ? null : currentAction))
    }
  }

  const handleCopyCoverPath = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('copy')
      await copyTrackCoverPath(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'copy' ? null : currentAction))
    }
  }

  const handleShowLyricsInFolder = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('lyrics-folder')
      await showTrackLyricsInFolder(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'lyrics-folder' ? null : currentAction))
    }
  }

  const handleOpenLyricsFile = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('lyrics-file')
      await openTrackLyricsFile(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'lyrics-file' ? null : currentAction))
    }
  }

  const handleShowCoverInFolder = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('cover-folder')
      await showTrackCoverInFolder(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'cover-folder' ? null : currentAction))
    }
  }

  const handleOpenCoverFile = async () => {
    if (busyAction) {
      return
    }

    try {
      setBusyAction('cover-file')
      await openTrackCoverFile(track, {
        onSuccess: () => setOpen(false)
      })
    } finally {
      setBusyAction((currentAction) => (currentAction === 'cover-file' ? null : currentAction))
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerAriaLabel ?? `Actions for ${track.title}`}
        className={triggerClassName}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${track.title}`}
          aria-busy={busyAction ? 'true' : undefined}
          className={`absolute z-20 w-56 rounded-2xl border border-white/10 bg-slate-950/96 p-3 shadow-soft backdrop-blur-xl ${menuPlacementClass}`}
        >
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {track.title}
          </div>
          <div className="grid gap-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Navigate</div>
            <Link
              to={getAlbumRoute(track.artist, track.album)}
              onClick={() => setOpen(false)}
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Open Album
            </Link>

            <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Local Files</div>
            <button
              type="button"
              onClick={() => void handleShowInFolder()}
              disabled={busyAction !== null}
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'folder' ? 'Opening Folder...' : 'Open Folder'}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenTrackFile()}
              disabled={busyAction !== null}
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'system' ? 'Opening Player...' : 'Open with System Player'}
            </button>
            {track.coverPath ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleOpenCoverFile()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'cover-file' ? 'Opening Cover...' : 'Open Cover Artwork'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyCoverPath()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'copy' ? 'Copying Path...' : 'Copy Cover Path'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShowCoverInFolder()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'cover-folder' ? 'Opening Cover Folder...' : 'Reveal Cover Artwork'}
                </button>
              </>
            ) : null}
            {track.lyricPath ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleOpenLyricsFile()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'lyrics-file' ? 'Opening Lyrics...' : 'Open Lyrics File'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyLyricsPath()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'copy' ? 'Copying Path...' : 'Copy Lyrics Path'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShowLyricsInFolder()}
                  disabled={busyAction !== null}
                  data-menu-item
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'lyrics-folder' ? 'Opening Lyrics Folder...' : 'Reveal Lyrics File'}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void handleCopyTrackPath()}
              disabled={busyAction !== null}
              data-menu-item
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'copy' ? 'Copying Path...' : 'Copy File Path'}
            </button>

            <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Library Actions</div>
            <div data-menu-item>
              <FavoriteButton trackId={track.id} isFavorite={track.isFavorite} />
            </div>
            <div data-menu-item>
              <AddToQueueButton tracks={track} />
            </div>
            <div data-menu-item>
              <AddToPlaylistButton trackId={track.id} track={track} />
            </div>
            {onRemove ? (
              <>
                <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {removeSectionLabel}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onRemove()
                    setOpen(false)
                  }}
                  data-menu-item
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/20"
                >
                  {removeButtonLabel}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
