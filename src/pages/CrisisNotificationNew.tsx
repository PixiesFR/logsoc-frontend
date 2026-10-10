/**
 * CrisisNotificationNew — route page for the notification pre-fill editor.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Route: /crisis/:incidentId/notifications/new?template=<nis2|rgpd|dora|nis2_1m>&deadline=...
 *
 * This page is outside AppLayout (like War Room), protected, and renders
 * the NotificationEditor with a back link to the crisis War Room.
 */
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { NotificationEditor } from '../components/crisis/NotificationEditor'

export function CrisisNotificationNewPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const crisisId = Number(incidentId)
  const template = searchParams.get('template') ?? 'nis2'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate(`/crisis/${crisisId}`, { replace: true })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
            marginBottom: '16px',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          {t('notifications.editor.backToWarRoom')}
        </button>

        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '0 0 16px 0',
          }}
        >
          {t('notifications.editor.title')}
        </h1>

        {crisisId ? (
          <NotificationEditor crisisId={crisisId} template={template} />
        ) : (
          <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
            {t('notifications.editor.invalidCrisisId')}
          </p>
        )}
      </div>
    </div>
  )
}