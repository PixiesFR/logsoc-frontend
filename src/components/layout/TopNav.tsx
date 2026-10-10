import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores'
import { useAuthStore } from '../../stores'
import { useTranslation } from '../../i18n/useTranslation'
import { initI18n } from '../../i18n/index'
import type { Lang } from '../../i18n/types'
import { usePermissions } from '../../hooks/usePermissions'
import { AuditorBadge } from '../audit/AuditorBadge'
import navConfig from './navConfig'
import { useDisabledModules, NAV_KEY_TO_MODULE } from '../../hooks/useDisabledModules'
import { useMyPermissions } from '../../hooks/useMyPermissions'
import type { NavSection } from '../../stores'
import {
  Menu,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  LogOut,
  User,
  FlaskConical,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { wizardApi } from '../../api'

// Auditor role: only compliance and governance sections visible
const AUDITOR_ALLOWED_SECTIONS = new Set(['compliance', 'governance'])

export function TopNav() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useTranslation()
  const navSection = useAppStore((s) => s.navSection)
  const setNavSection = useAppStore((s) => s.setNavSection)
  const setMobileSidebar = useAppStore((s) => s.setMobileSidebar)
  const { canView, isAuditor } = usePermissions()
  const disabledModules = useDisabledModules()
  const { allowedModules } = useMyPermissions()

  const navAllowed = (itemKey: string): boolean => {
    const mod = NAV_KEY_TO_MODULE[itemKey] ?? itemKey
    // module désactivé par l'admin -> masqué
    if (disabledModules.has(mod)) return false
    // matrice RBAC: pas can_read pour le rôle -> masqué (superadmin: allowedModules={'*'})
    if (!allowedModules.has('*') && !allowedModules.has(mod)) return false
    return true
  }
  const expertMode = useAuthStore((s) => s.expertMode)
  const toggleExpertMode = useAuthStore((s) => s.toggleExpertMode)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [wizardValidated, setWizardValidated] = useState<boolean | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('logsoc-theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('logsoc-theme', next)
  }

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Fetch wizard status for badge
  useEffect(() => {
    if (!isAuditor) {
      const fetchStatus = () => {
        wizardApi.status().then(res => {
          setWizardValidated(res.data.status === 'validated')
        }).catch(() => {})
      }
      fetchStatus()
      // Listen for wizard status changes (e.g. after profile validation)
      window.addEventListener('wizardStatusChanged', fetchStatus)
      return () => window.removeEventListener('wizardStatusChanged', fetchStatus)
    }
  }, [isAuditor])

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang)
    initI18n(newLang)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
        setLangOpen(false)
      }
    }
    if (userMenuOpen || langOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [userMenuOpen, langOpen])

  let sections = navConfig.filter((s) =>
    s.items.some((item) => canView(item.minRole) && !item.hidden && navAllowed(item.key)),
  )

  // Auditor: restrict to allowed sections
  if (isAuditor) {
    sections = sections.filter((s) => AUDITOR_ALLOWED_SECTIONS.has(s.key))
  }

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    backgroundColor: isActive ? 'var(--color-bg-hover)' : 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  })

  const navButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '52px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px',
        gap: '4px',
        position: 'relative',
        zIndex: 60,
      }}
      className="top-nav"
    >
      <button
        onClick={() => setMobileSidebar(true)}
        style={{
          display: 'none',
          padding: '6px',
          background: 'none',
          border: 'none',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          marginRight: '8px',
        }}
        className="mobile-menu-btn"
        aria-label={t('common.menu')}
      >
        <Menu size={20} />
      </button>
      <div
        style={{
          fontWeight: 700,
          fontSize: '16px',
          color: 'var(--color-accent)',
          marginRight: '24px',
          letterSpacing: '-0.02em',
          flexShrink: 0,
        }}
        className="hide-mobile"
      >
        LogSOC
      </div>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          flex: 1,
          minWidth: 0,
        }}
        className="scrollbar-none nav-sections"
      >
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = navSection === section.key
          return (
            <button
              key={section.key}
              onClick={() => setNavSection(section.key as NavSection)}
              style={buttonStyle(isActive)}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <Icon size={16} />
                <span style={{ fontSize: '9px', lineHeight: 1 }}>{t(section.label)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Dashboard button ── */}
      <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          ...navButtonStyle,
          marginLeft: '8px',
        }}
        title="Dashboard"
      >
        <LayoutDashboard size={14} />
        <span className="hide-mobile">Dashboard</span>
      </button>

      {/* ── Wizard button with badge ── */}
      {!isAuditor && (
        <button
          onClick={() => navigate('/wizard')}
          style={{
            ...navButtonStyle,
            marginLeft: '8px',
            position: 'relative' as const,
            borderColor: wizardValidated === false ? 'var(--color-danger)' : 'var(--color-border)',
            color: wizardValidated === false ? 'var(--color-danger)' : 'var(--color-text-secondary)',
          }}
          title={wizardValidated === false ? 'Cadrage à compléter' : wizardValidated === true ? 'Profil validé' : 'Wizard de cadrage'}
        >
          <Sparkles size={14} />
          {wizardValidated === false && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-danger)',
              border: '1px solid var(--color-bg-secondary)',
            }} />
          )}
          <span className="hide-mobile">Wizard</span>
        </button>
      )}

      {/* ── Right-side controls (moved from Header per #60) ── */}
      <div
        ref={menuRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginLeft: '12px',
          flexShrink: 0,
        }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={navButtonStyle}
          title={t('common.theme')}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Language selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            style={navButtonStyle}
          >
            <Globe size={14} />
            {lang.toUpperCase()}
            <ChevronDown size={12} />
          </button>
          {langOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                minWidth: '100px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {(['fr', 'en', 'de', 'es'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    handleLangChange(l)
                    setLangOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 14px',
                    background: lang === l ? 'var(--color-accent)' : 'none',
                    border: 'none',
                    color: lang === l ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: '8px',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expert mode toggle */}
        {!isAuditor && (
          <button
            onClick={toggleExpertMode}
            style={{
              ...navButtonStyle,
              backgroundColor: expertMode ? 'var(--color-accent)' : 'transparent',
              borderColor: expertMode ? 'var(--color-accent)' : 'var(--color-border)',
              color: expertMode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <FlaskConical size={14} />
            <span className="hide-mobile">{t('common.expertMode')}</span>
          </button>
        )}

        {/* Auditor badge — visible only for auditor role */}
        {isAuditor && <AuditorBadge />}

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              ...navButtonStyle,
              color: 'var(--color-text-primary)',
            }}
          >
            <User size={14} />
            <span
              className="hide-mobile"
              style={{
                maxWidth: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.display_name || user?.username || '—'}
            </span>
            <ChevronDown size={12} />
          </button>
          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                minWidth: '160px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <button
                onClick={() => {
                  setUserMenuOpen(false)
                  logout()
                  navigate('/login', { replace: true })
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-danger)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                }}
              >
                <LogOut size={16} />
                {t('common.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </nav>
  )
}