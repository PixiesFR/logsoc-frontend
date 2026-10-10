import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { useAuditorProfile, getDaysUntilExpiration } from '../../hooks/useAuditorProfile'
import { useAuthStore } from '../../stores'
import { ShieldCheck, AlertTriangle } from 'lucide-react'

/**
 * Badge displayed in the header for auditor role users.
 * Shows "Mode Auditeur" with the role expiration date.
 * Turns orange at J-7, redirects to /login at J+0.
 */
export function AuditorBadge() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { data: profile } = useAuditorProfile()
  const redirectedRef = useRef(false)

  const expiresAt = profile?.role_expires_at ?? null
  const daysLeft = getDaysUntilExpiration(expiresAt)

  // J+0 expiration → redirect to /login with message
  useEffect(() => {
    if (daysLeft !== null && daysLeft <= 0 && !redirectedRef.current) {
      redirectedRef.current = true
      logout()
      navigate('/login', {
        replace: true,
        state: { message: t('audit.roleExpired') },
      })
    }
  }, [daysLeft, logout, navigate, t])

  if (daysLeft === null) {
    // No expiration date — show standard badge
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid var(--color-info)',
          backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, transparent)',
          color: 'var(--color-info)',
          fontSize: '11px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <ShieldCheck size={14} />
        {t('audit.mode')}
      </div>
    )
  }

  const isWarning = daysLeft <= 7

  const badgeColor = isWarning ? 'var(--color-warning)' : 'var(--color-info)'
  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : ''

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        border: `1px solid ${badgeColor}`,
        backgroundColor: `color-mix(in srgb, ${badgeColor} 10%, transparent)`,
        color: badgeColor,
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
      title={isWarning ? t('audit.expirationImminent') : undefined}
    >
      {isWarning ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
      {t('audit.modeExpires', { date: formattedDate })}
    </div>
  )
}