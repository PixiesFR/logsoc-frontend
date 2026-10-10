import { useTranslation } from '../i18n/useTranslation'

interface PagePlaceholderProps {
  titleKey: string
}

export function PagePlaceholder({ titleKey }: PagePlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '12px',
      }}
    >
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {t(titleKey)}
      </h1>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--color-text-secondary)',
        }}
      >
        —
      </p>
    </div>
  )
}