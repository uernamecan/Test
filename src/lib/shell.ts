export const DEFAULT_LYRICS_PANEL_WIDTH = 432
export const MIN_LYRICS_PANEL_WIDTH = 320
export const MAX_LYRICS_PANEL_WIDTH = 720
export const DEFAULT_QUEUE_DRAWER_WIDTH = 396
export const MIN_QUEUE_DRAWER_WIDTH = 320
export const MAX_QUEUE_DRAWER_WIDTH = 640

function resolveViewportWidth(viewportWidth?: number, fallbackWidth = MAX_LYRICS_PANEL_WIDTH + 120) {
  const globalViewportWidth =
    typeof globalThis === 'object' && typeof (globalThis as { innerWidth?: unknown }).innerWidth === 'number'
      ? ((globalThis as { innerWidth?: number }).innerWidth as number)
      : undefined

  return typeof viewportWidth === 'number' && Number.isFinite(viewportWidth)
    ? viewportWidth
    : typeof globalViewportWidth === 'number'
      ? globalViewportWidth
      : fallbackWidth
}

function clampFloatingPanelWidth(
  width: number,
  minWidth: number,
  maxWidth: number,
  viewportWidth?: number
) {
  const resolvedViewportWidth = resolveViewportWidth(viewportWidth, maxWidth + 120)
  const viewportMaxWidth = Math.max(minWidth, Math.min(maxWidth, resolvedViewportWidth - 120))

  return Math.min(viewportMaxWidth, Math.max(minWidth, Math.round(width)))
}

export function clampLyricsPanelWidth(width: number, viewportWidth?: number) {
  return clampFloatingPanelWidth(
    width,
    MIN_LYRICS_PANEL_WIDTH,
    MAX_LYRICS_PANEL_WIDTH,
    viewportWidth
  )
}

export function clampQueueDrawerWidth(width: number, viewportWidth?: number) {
  return clampFloatingPanelWidth(
    width,
    MIN_QUEUE_DRAWER_WIDTH,
    MAX_QUEUE_DRAWER_WIDTH,
    viewportWidth
  )
}
