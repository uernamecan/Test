import { useEffect } from 'react'

type MenuNavigationOptions = {
  enabled: boolean
  container: HTMLElement | null
}

const MENU_SELECTOR = '[data-menu-item]'

function getMenuItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(MENU_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled')
  )
}

export function useMenuNavigation({ enabled, container }: MenuNavigationOptions) {
  useEffect(() => {
    if (!enabled || !container) {
      return
    }

    const focusFirstItem = window.requestAnimationFrame(() => {
      const [firstItem] = getMenuItems(container)
      firstItem?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = getMenuItems(container)

      if (items.length === 0) {
        return
      }

      const activeIndex = items.findIndex((item) => item === document.activeElement)
      const currentIndex = activeIndex >= 0 ? activeIndex : 0

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        items[(currentIndex + 1) % items.length]?.focus()
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        items[(currentIndex - 1 + items.length) % items.length]?.focus()
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        items[0]?.focus()
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        items[items.length - 1]?.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFirstItem)
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [container, enabled])
}
