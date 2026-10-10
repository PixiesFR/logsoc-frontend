import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores'
import { usePermissions } from '../../hooks/usePermissions'
import { useTranslation } from '../../i18n/useTranslation'
import { GlossaryTooltip } from '../../components/ui/GlossaryTooltip'
import navConfig from './navConfig'
import { useDisabledModules, NAV_KEY_TO_MODULE } from '../../hooks/useDisabledModules'
import { useMyPermissions } from '../../hooks/useMyPermissions'

// Map nav keys to glossary terms for technical labels
const glossaryMap: Record<string, string> = {
  yara: 'glossary.yara',
  yaraMatches: 'glossary.yara',
  sigma: 'glossary.sigma',
  mitre: 'glossary.mitre',
  correlation: 'glossary.correlation',
  threatHunting: 'glossary.siem',
  customRules: 'glossary.siem',
}

// Auditor role: only these sections are visible (read-only)
const AUDITOR_ALLOWED_SECTIONS = new Set(['compliance', 'governance'])
const AUDITOR_ALLOWED_ITEMS = new Set([
  'crossMapping',
  'compliance',
  'policies',
  'reporting',
])

export function ContextualSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const navSection = useAppStore((s) => s.navSection)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebar = useAppStore((s) => s.setMobileSidebar)
  const { canView, isAuditor } = usePermissions()
  const disabledModules = useDisabledModules()
  const { allowedModules } = useMyPermissions()

  const navAllowed = (itemKey: string): boolean => {
    const mod = NAV_KEY_TO_MODULE[itemKey] ?? itemKey
    if (disabledModules.has(mod)) return false
    if (!allowedModules.has('*') && !allowedModules.has(mod)) return false
    return true
  }

  const section = navConfig.find((s) => s.key === navSection)
  if (!section) return null

  // Auditor: restrict to allowed sections only
  if (isAuditor && !AUDITOR_ALLOWED_SECTIONS.has(navSection)) {
    // Redirect to compliance section which contains cross-mapping
    return null
  }

  let filteredItems = section.items.filter(
    (item) => canView(item.minRole) && !item.hidden && navAllowed(item.key)
  )

  // Auditor: further filter to only allowed items
  if (isAuditor) {
    filteredItems = filteredItems.filter((item) => AUDITOR_ALLOWED_ITEMS.has(item.key))
  }

  const sidebarWidth = sidebarCollapsed ? '60px' : '240px'

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: sidebarCollapsed ? '0' : '10px',
    padding: sidebarCollapsed ? '10px 0' : '10px 16px',
    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
    color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    backgroundColor: isActive ? 'var(--color-bg-hover)' : 'transparent',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 400,
    borderRadius: '6px',
    margin: '2px 8px',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  })

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebar(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}
      <aside
        style={{
          position: 'fixed',
          top: 52,
          left: 0,
          bottom: 0,
          width: sidebarWidth,
          backgroundColor: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
          zIndex: 50,
        }}
        className={`scrollbar-none mobile-sidebar${mobileSidebarOpen ? ' is-open' : ''}`}
        data-top-offset="52"
      >
        <div style={{ padding: '12px 0' }}>
          <div
            style={{
              padding: sidebarCollapsed ? '4px 0' : '4px 16px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-secondary)',
              textAlign: sidebarCollapsed ? 'center' : 'left',
              marginBottom: '4px',
            }}
          >
            {sidebarCollapsed ? '' : t(section.label)}
          </div>
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path + '/') &&
               !filteredItems.some(other => other !== item && other.path.startsWith(item.path) && location.pathname.startsWith(other.path)))
            const glossaryKey = glossaryMap[item.key]
            const labelContent = t(item.label)

            return (
              <div
                key={item.key}
                onClick={() => {
                  navigate(item.path)
                  setMobileSidebar(false)
                }}
                style={linkStyle(isActive)}
                title={sidebarCollapsed ? t(item.label) : undefined}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && (
                  glossaryKey ? (
                    <GlossaryTooltip term={glossaryKey}>{labelContent}</GlossaryTooltip>
                  ) : (
                    <span>{labelContent}</span>
                  )
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}