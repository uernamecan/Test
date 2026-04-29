import { cn } from '../../lib/cn'
import { musicApi } from '../../services/api'

type CoverArtworkProps = {
  coverPath?: string
  title?: string
  className?: string
  fallbackLabel?: string
}

export default function CoverArtwork({
  coverPath,
  title,
  className,
  fallbackLabel = 'LP'
}: CoverArtworkProps) {
  const src = coverPath ? musicApi.toFileUrl(coverPath) : undefined
  const artworkClassName = cn('h-16 w-16 rounded-2xl', className)

  return src ? (
    <img
      src={src}
      alt={title ? `${title} cover art` : 'Album artwork'}
      className={cn(artworkClassName, 'object-cover shadow-soft')}
    />
  ) : (
    <div
      className={cn(
        artworkClassName,
        'flex items-center justify-center bg-gradient-to-br from-aurora/30 to-accent/30 text-lg font-semibold uppercase tracking-[0.16em] text-white shadow-soft'
      )}
    >
      {fallbackLabel}
    </div>
  )
}
