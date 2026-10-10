import { Sparkles } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

interface PolicySummaryCardProps {
  summary: string | null | undefined
}

/**
 * Displays the AI-generated summary of policy changes in bullet points.
 * The summary is produced by the backend (policy_summaries table) when
 * a policy is submitted for review. The text is already formatted with
 * "- " prefixed bullets by the LLM; we split on newlines and render each
 * line as a bullet point for clean display.
 */
export function PolicySummaryCard({ summary }: PolicySummaryCardProps) {
  const { t } = useTranslation()

  if (!summary) {
    return (
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '20px',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {t('governance.policies.aiSummary')}
          </h3>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('governance.policies.aiSummaryUnavailable')}
        </p>
      </div>
    )
  }

  // Split summary into bullet points (lines starting with "- " or "• ")
  const lines = summary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const bullets = lines.map((line) =>
    line.replace(/^[-•*]\s*/, '').trim(),
  )

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '20px',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {t('governance.policies.aiSummary')}
        </h3>
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {bullets.map((bullet, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '14px',
              color: 'var(--color-text-primary)',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
                marginTop: '7px',
              }}
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}