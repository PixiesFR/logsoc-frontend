/**
 * CrisisThemeProvider — applies the deep-dark crisis theme to the document root.
 *
 * Ticket #51 — War Room shell mode crise (CDC Part6 §24.1+24.8).
 * Sets `data-mode="crisis"` on <html> when active, removing it on exit.
 * This triggers the `--color-bg-crisis: #0a0a0f` variables defined in crisis.css.
 *
 * Usage: wrap the War Room route (or any subtree that should receive the
 * crisis theme) with <CrisisThemeProvider>.
 */
import { useEffect, type ReactNode } from 'react'
import { useCrisisStore } from '../../stores/crisisStore'

interface CrisisThemeProviderProps {
  children: ReactNode
}

export function CrisisThemeProvider({ children }: CrisisThemeProviderProps) {
  const crisisActive = useCrisisStore((s) => s.active)

  useEffect(() => {
    if (crisisActive) {
      document.documentElement.setAttribute('data-mode', 'crisis')
    } else {
      document.documentElement.removeAttribute('data-mode')
    }
    return () => {
      document.documentElement.removeAttribute('data-mode')
    }
  }, [crisisActive])

  return <>{children}</>
}