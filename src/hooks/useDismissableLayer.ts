import { useEffect } from 'react'

type DismissableLayerOptions = {
  enabled: boolean
  container: HTMLElement | null
  onDismiss: () => void
}

export function useDismissableLayer({
  enabled,
  container,
  onDismiss
}: DismissableLayerOptions) {
  useEffect(() => {
    if (!enabled || !container) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!container.contains(event.target as Node)) {
        onDismiss()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [container, enabled, onDismiss])
}
