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

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`
}

export function formatDurationMs(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0 ms'
  }

  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`
  }

  const seconds = milliseconds / 1000

  if (seconds < 60) {
    return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)} sec`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`
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
