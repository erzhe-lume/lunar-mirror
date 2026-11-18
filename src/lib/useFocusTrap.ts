import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden',
      )

    const focusFirst = () => {
      const items = focusables()
      ;(items[0] ?? node).focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        node.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (!node.contains(current)) {
        event.preventDefault()
        first.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (current === first || current === node)) {
        event.preventDefault()
        last.focus()
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) {
        focusFirst()
      }
    }

    const timer = window.setTimeout(focusFirst, 0)
    node.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)

    return () => {
      window.clearTimeout(timer)
      node.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      previous?.focus()
    }
  }, [active])

  return ref
}
