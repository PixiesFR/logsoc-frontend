import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Auth Store ──

interface AuthUser {
  id: number
  username: string
  email: string
  role: string
  display_name: string | null
  role_expires_at?: string | null
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  expertMode: boolean
  setAuth: (token: string, refreshToken: string, user: AuthUser | null) => void
  logout: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  toggleExpertMode: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      expertMode: false,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().token,
      isAdmin: () => {
        const role = get().user?.role
        return role === 'admin' || role === 'superadmin'
      },
      toggleExpertMode: () => set((s) => ({ expertMode: !s.expertMode })),
    }),
    { name: 'logsoc-auth' }
  )
)

// ── App Store ──

export type NavSection = 'governance' | 'dataProtection' | 'compliance' | 'ops' | 'audit' | 'crise' | 'admin'
export type TimeRange = '15min' | '1h' | '6h' | '24h' | '7d' | '30d'
export type Lang = 'fr' | 'en' | 'de' | 'es'

interface AppState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  timeRange: TimeRange
  navSection: NavSection
  lang: Lang
  expertMode: boolean
  toggleSidebar: () => void
  setMobileSidebar: (open: boolean) => void
  setTimeRange: (range: TimeRange) => void
  setNavSection: (section: NavSection) => void
  setLang: (lang: Lang) => void
  toggleExpertMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      timeRange: '24h',
      navSection: 'governance',
      lang: 'fr',
      expertMode: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebar: (open) => set({ mobileSidebarOpen: open }),
      setTimeRange: (range) => set({ timeRange: range }),
      setNavSection: (section) => set({ navSection: section }),
      setLang: (lang) => set({ lang }),
      toggleExpertMode: () => set((s) => ({ expertMode: !s.expertMode })),
    }),
    { name: 'logsoc-app' }
  )
)