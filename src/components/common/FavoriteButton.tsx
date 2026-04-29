import { useState } from 'react'
import { setTrackFavorite } from '../../services/favorites'
import { useFeedbackStore } from '../../store/feedbackStore'

type FavoriteButtonProps = {
  trackId: string
  isFavorite?: boolean
  compact?: boolean
}

export default function FavoriteButton({
  trackId,
  isFavorite = false,
  compact = false
}: FavoriteButtonProps) {
  const showFeedback = useFeedbackStore((state) => state.showFeedback)
  const [busy, setBusy] = useState(false)

  const handleToggleFavorite = async () => {
    setBusy(true)

    try {
      await setTrackFavorite(trackId, !isFavorite)
      showFeedback(!isFavorite ? 'Added to favorites.' : 'Removed from favorites.')
    } catch {
      showFeedback('Could not update favorites right now.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? 'Saving' : isFavorite ? 'Liked' : compact ? 'Like' : 'Favorite'

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      onClick={() => void handleToggleFavorite()}
      disabled={busy}
      className={`rounded-xl border px-3 py-2 text-xs transition ${
        isFavorite
          ? 'border-aurora/40 bg-aurora/15 text-white hover:bg-aurora/20'
          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {label}
    </button>
  )
}
