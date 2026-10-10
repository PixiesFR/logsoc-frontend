import { useState, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'

interface GlossaryTooltipProps {
  term: string
  children: ReactNode
}

export function GlossaryTooltip({ term, children }: GlossaryTooltipProps) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        style={{
          borderBottom: '1px dotted var(--color-text-secondary)',
          cursor: 'help',
        }}
      >
        {children}
      </span>
      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '8px 12px',
            maxWidth: '250px',
            fontSize: '12px',
            color: 'var(--color-text-primary)',
            zIndex: 250,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            marginBottom: '4px',
            whiteSpace: 'normal',
          }}
        >
          {t(term)}
        </div>
      )}
    </span>
  )
}