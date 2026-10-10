import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TopNav } from './TopNav'
import { ContextualSidebar } from './ContextualSidebar'
import { Header } from './Header'
import { useAppStore } from '../../stores'
import { useAuthStore } from '../../stores'
import { usePermissions } from '../../hooks/usePermissions'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { useEffect, useState, useMemo } from 'react'
import navConfig from './navConfig'
import { ErrorBoundary } from '../ui'
import { OnboardingWizard } from '../onboarding/OnboardingWizard'
import { onboardingApi } from '../../api'

// Routes where the global search bar should appear (ticket #58)
const SEARCH_ROUTES = ['/', '/alerts', '/agents']

// Routes where time filters should appear (ticket #59)
const TIME_FILTER_ROUTES = ['/', '/events', '/alerts', '/agents']

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const setNavSection = useAppStore((s) => s.setNavSection)
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useAuthStore((s) => s.isAdmin)()
  const { isAuditor } = usePermissions()
  const onboardingCompleted = useOnboardingStore((s) => s.completed)
  const [showWizard, setShowWizard] = useState(false)

  // Determine contextual header visibility based on current route (#58, #59)
  const { showSearch, showTimeFilter } = useMemo(() => {
    const path = location.pathname
    const exactMatch = (route: string) =>
      route === '/' ? path === '/' : path === route || path.startsWith(route + '/')
    return {
      showSearch: SEARCH_ROUTES.some(exactMatch),
      showTimeFilter: TIME_FILTER_ROUTES.some(exactMatch),
    }
  }, [location.pathname])

  // Auditor: default to compliance section, redirect away from non-allowed routes
  // Allowed: /audit/cross-mapping, /cross-mapping, /compliance, /governance/policies, /reporting
  useEffect(() => {
    if (isAuditor) {
      const allowedPaths = ['/audit/cross-mapping', '/cross-mapping', '/compliance', '/governance/policies', '/reporting']
      const isAllowed = allowedPaths.some((p) =>
        location.pathname === p || location.pathname.startsWith(p + '/')
      )
      if (!isAllowed) {
        navigate('/audit/cross-mapping', { replace: true })
      }
      setNavSection('compliance')
    }
  }, [isAuditor, location.pathname, navigate, setNavSection])

  // Sync navSection with current route
  useEffect(() => {
    if (isAuditor) return // Auditor section is set above
    const path = location.pathname
    for (const section of navConfig) {
      if (section.items.some((item) => path === item.path || (item.path !== '/' && path.startsWith(item.path)))) {
        setNavSection(section.key)
        break
      }
    }
  }, [location.pathname, setNavSection, isAuditor])

  // Show onboarding wizard on first admin login (not yet completed)
  useEffect(() => {
    if (isAdmin && !onboardingCompleted && !isAuditor) {
      // Check backend for existing onboarding config
      onboardingApi.getStatus()
        .then((res) => {
          if (res.data) {
            // Already configured on backend — mark completed locally
            useOnboardingStore.getState().setCompleted(true)
          } else {
            setShowWizard(true)
          }
        })
        .catch(() => {
          // Backend error — show wizard as fallback
          setShowWizard(true)
        })
    }
  }, [isAdmin, onboardingCompleted, isAuditor])

  const handleCloseWizard = () => {
    setShowWizard(false)
    // If admin closes without completing, mark as completed to avoid re-prompting every render
    if (!onboardingCompleted) {
      useOnboardingStore.getState().setCompleted(true)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ContextualSidebar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginLeft: sidebarCollapsed ? '60px' : '240px',
            transition: 'margin-left 0.2s ease',
          }}
          className="app-main-content"
        >
          <Header showSearch={showSearch} showTimeFilter={showTimeFilter} />
          <main
            role="main"
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '24px',
              backgroundColor: 'var(--color-bg-primary)',
            }}
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      {showWizard && <OnboardingWizard onClose={handleCloseWizard} />}
    </div>
  )
}