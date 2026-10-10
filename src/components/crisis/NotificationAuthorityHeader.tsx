/**
 * NotificationAuthorityHeader — authority recipient banner.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Displays:
 * - Authority name + code (ANSSI, CNIL, DORA)
 * - Legal reference (NIS2 Art.32, RGPD Art.33, DORA Art.19)
 * - Authority email
 */
import { Building2, Mail, Scale } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import type { NotificationAuthority } from '../../types/notification'

interface NotificationAuthorityHeaderProps {
  authority: NotificationAuthority
}

export function NotificationAuthorityHeader({ authority }: NotificationAuthorityHeaderProps) {
  const { t } = useTranslation()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          background: 'var(--color-accent)',
          color: '#ffffff',
          flexShrink: 0,
        }}
      >
        <Building2 size={24} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {authority.name}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {authority.code}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Scale size={12} />
          <span>{authority.legalReference}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Mail size={12} />
          <span>{authority.email}</span>
        </div>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          textAlign: 'right',
          maxWidth: '200px',
        }}
      >
        {t('notifications.editor.authorityRecipient')}
      </div>
    </div>
  )
}