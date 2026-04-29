export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const safeSeconds = Math.floor(seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export function formatTrackMeta(format?: string, bitrate?: number) {
  const normalizedFormat = format?.toUpperCase() ?? 'Audio'

  if (!bitrate) {
    return normalizedFormat
  }

  return `${normalizedFormat} / ${Math.round(bitrate / 1000)} kbps`
}

export function formatCollectionDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min'
  }

  const roundedMinutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${minutes} min`
}

export function formatRelativeTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'unknown time'
  }

  const diffMilliseconds = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMilliseconds / (1000 * 60))

  if (Math.abs(diffMinutes) < 1) {
    return 'just now'
  }

  if (Math.abs(diffMinutes) < 60) {
    return `${Math.abs(diffMinutes)} min ago`
  }

  const diffHours = Math.round(diffMinutes / 60)

  if (Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)} hr ago`
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function formatPlayedAt(value: string) {
  return formatRelativeTime(value)
}

export function formatLibraryTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}
