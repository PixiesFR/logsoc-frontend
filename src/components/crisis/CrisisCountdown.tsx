/**
 * CrisisCountdown — a single regulatory countdown chip.
 * Ticket #48 — Sentinelles temporelles.
 *
 * Displays: ⏳ {remaining} + {authority label}
 * Color changes: green >50%, orange 25-50%, red <25% or expired
 * Click → opens notification template pre-filled (route /crisis/:id/notifications/new?template=...)
 * Tooltip: legal reference text
 * Accessibility: role="timer", aria-live="polite"
 * Mobile (≤1366×768): hides label, shows icon + time only
 */
import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { GlossaryTooltip } from '../ui/GlossaryTooltip'
import { formatRemaining, type CountdownResult } from '../../hooks/useCountdown'
import type { RegulatoryRule } from '../../types/crisis'

interface CrisisCountdownProps {
  rule: RegulatoryRule
  result: CountdownResult
  incidentId: number
}

/** Map status → CSS variable color. */
function statusColor(status: CountdownResult['status']): string {
  switch (status) {
    case 'green':
      return 'var(--color-crisis-success)'
    case 'orange':
      return 'var(--color-crisis-warning)'
    case 'red':
      return 'var(--color-crisis-danger)'
  }
}

export function CrisisCountdown({ rule, result, incidentId }: CrisisCountdownProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const color = statusColor(result.status)
  const label = t(rule.labelKey)
  const authority = rule.authority
  const remainingStr = result.expired
    ? t('countdown.expired')
    : formatRemaining(result.remainingMs)

  const handleClick = () => {
    navigate(
      `/crisis/${incidentId}/notifications/new?template=${rule.regulation}&deadline=${rule.deadlineType}`,
    )
  }

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${color}`,
    backgroundColor: `rgba(255,255,255,0.05)`,
    color: 'var(--color-crisis-text)',
    transition: 'background-color 0.2s',
  }

  return (
    <GlossaryTooltip term={rule.legalKey}>
      <button
        type="button"
        onClick={handleClick}
        style={chipStyle}
        role="timer"
        aria-live="polite"
        aria-label={`${label} — ${authority} — ${remainingStr}`}
        title={t(rule.legalKey)}
        className="countdown-chip"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
        }}
      >
        <Hourglass size={14} style={{ color }} />
        <span style={{ color }}>
          {remainingStr}
        </span>
        <span
          className="countdown-authority"
          style={{ fontSize: '11px', color: 'var(--color-crisis-text)', opacity: 0.7 }}
        >
          {authority}
        </span>
      </button>
    </GlossaryTooltip>
  )
}