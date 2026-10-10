import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Sort order for timeline entries: 'desc' = newest at top, 'asc' = newest at bottom. */
export type TimelineSortOrder = 'desc' | 'asc'

interface CrisisState {
  active: boolean
  incidentId: number | null
  fullscreen: boolean
  /** Crisis token used for vault document access (X-Crisis-Token header). */
  crisisToken: string | null
  /** Auto-lock timeout in seconds for timeline entries (default 60, configurable via Settings → Crise). */
  autoLockTimeoutSec: number
  /** Timeline sort order: 'desc' = newest first (top), 'asc' = newest last (bottom). */
  timelineSortOrder: TimelineSortOrder
  enterCrisis: (incidentId: number, crisisToken?: string | null) => void
  setToken: (token: string | null) => void
  exitCrisis: () => void
  toggleFullscreen: () => void
  setAutoLockTimeoutSec: (seconds: number) => void
  setTimelineSortOrder: (order: TimelineSortOrder) => void
}

export const useCrisisStore = create<CrisisState>()(
  persist(
    (set) => ({
      active: false,
      incidentId: null,
      fullscreen: false,
      crisisToken: null,
      autoLockTimeoutSec: 60,
      timelineSortOrder: 'desc',
      enterCrisis: (incidentId, crisisToken = null) =>
        set({ active: true, incidentId, crisisToken }),
      setToken: (crisisToken) => set({ crisisToken }),
      exitCrisis: () => set({ active: false, incidentId: null, fullscreen: false, crisisToken: null }),
      toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
      setAutoLockTimeoutSec: (seconds) => set({ autoLockTimeoutSec: Math.max(0, Math.round(seconds)) }),
      setTimelineSortOrder: (order) => set({ timelineSortOrder: order }),
    }),
    { name: 'logsoc-crisis' }
  )
)