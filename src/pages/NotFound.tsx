import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { Button } from '../components/ui'
import { Compass } from 'lucide-react'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      textAlign: 'center',
    }}>
      <Compass size={64} style={{ color: 'var(--color-text-secondary)' }} />
      <h1 style={{ fontSize: '48px', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('notFound.title')}
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('notFound.message')}
      </p>
      <Button
        variant="primary"
        onClick={() => navigate('/')}
      >
        {t('notFound.backToDashboard')}
      </Button>
    </div>
  )
}