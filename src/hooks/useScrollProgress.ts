import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Tracks scroll progress of a scrollable container.
 * Returns a ref to attach to the scrollable element, the current
 * progress (0–100), and whether the user has reached the bottom.
 *
 * The "reached bottom" condition uses a 50px threshold:
 *   scrollTop + clientHeight >= scrollHeight - 50
 */
export function useScrollProgress() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [reachedBottom, setReachedBottom] = useState(false)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const pct = maxScroll > 0 ? Math.min(100, Math.round((scrollTop / maxScroll) * 100)) : 100
    setProgress(pct)
    setReachedBottom(scrollTop + clientHeight >= scrollHeight - 50)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Check on mount in case content is shorter than container
    handleScroll()
  }, [handleScroll])

  return { containerRef, progress, reachedBottom, handleScroll }
}