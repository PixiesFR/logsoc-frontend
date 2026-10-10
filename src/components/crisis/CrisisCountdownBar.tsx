/**
 * CrisisCountdownBar — header bar showing 4 regulatory countdowns.
 * Ticket #48 — Sentinelles temporelles (War Room header).
 *
 * Features:
 * - Fetches deadlines via GET /api/v1/crisis/:id/regulatory-deadlines (optional, 404 fallback)
 * - Displays 4 CrisisCountdown chips: NIS2 24h, RGPD 72h, DORA 4h, NIS2 1 month
 * - Single shared setInterval via useSharedTick (all 4 countdowns tick together)
 * - Toasts fire at threshold crossings (50% warning, 25% critical, expired)
 * - Deadlines computed from incident start time + rule delay
 * - Mobile (≤1366×768): hides authority labels via CSS class
 */
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crisisApi } from '../../api'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui/Toast'
import { useSharedTick, computeCountdown } from '../../hooks/useCountdown'
import { useThresholdToasts } from '../../hooks/useThresholdToasts'
import { REGULATORY_RULES } from '../../constants/regulatory'
import { CrisisCountdown } from './CrisisCountdown'

interface CrisisCountdownBarProps {
  incidentId: number
  /** ISO 8601 timestamp when the incident was created/activated. */
  incidentStartedAt: string | null
}

/** API response shape for regulatory deadlines endpoint. */
interface RegulatoryDeadlinesResponse {
  deadlines?: Record<string, string> // key → ISO timestamp
}

/**
 * Compute the deadline timestamp for a rule, given the incident start.
 * Uses the backend-provided deadline if available, otherwise falls back
 * to incidentStartedAt + delayHours.
 */
function getDeadline(
  ruleKey: string,
  apiDeadlines: RegulatoryDeadlinesResponse | undefined,
  incidentStartedAt: string | null,
  delayHours: number,
): number | null {
  // Check API-provided deadlines first
  if (apiDeadlines?.deadlines?.[ruleKey]) {
    const ts = Date.parse(apiDeadlines.deadlines[ruleKey])
    if (!isNaN(ts)) return ts
  }

  // Fallback: incident start + delay
  if (!incidentStartedAt) return null
  const start = Date.parse(incidentStartedAt)
  if (isNaN(start)) return null
  return start + delayHours * 3600_000
}

export function CrisisCountdownBar({ incidentId, incidentStartedAt }: CrisisCountdownBarProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const now = useSharedTick()

  // Fetch regulatory deadlines (optional endpoint — 404 is OK)
  const { data: apiDeadlines, isError } = useQuery({
    queryKey: ['crisis', 'regulatory-deadlines', incidentId],
    queryFn: () =>
      crisisApi.regulatoryDeadlines(incidentId).then((r) => r.data as RegulatoryDeadlinesResponse),
    enabled: !!incidentId,
    retry: false,
    staleTime: 60_000,
  })

  // If API returns 404, we fall back to computed deadlines (silently)
  const deadlines = apiDeadlines ?? (isError ? {} : undefined)

  return (
    <div
      className="countdown-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      {REGULATORY_RULES.map((rule) => {
        const totalMs = rule.delayHours * 3600_000
        const deadlineMs = getDeadline(
          rule.key,
          deadlines,
          incidentStartedAt,
          rule.delayHours,
        )
        const result = computeCountdown(deadlineMs, totalMs, now)

        return (
          <CountdownWithToasts
            key={rule.key}
            rule={rule}
            result={result}
            incidentId={incidentId}
            toast={toast}
            t={t}
          />
        )
      })}
    </div>
  )
}

/** Inner component to hook up threshold toasts per countdown. */
function CountdownWithToasts({
  rule,
  result,
  incidentId,
  toast,
  t,
}: {
  rule: typeof REGULATORY_RULES[number]
  result: ReturnType<typeof computeCountdown>
  incidentId: number
  toast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const fireToasts = useThresholdToasts(toast, t, {
    label: t(rule.labelKey),
    authority: rule.authority,
  })

  // Fire toasts on every tick — useThresholdToasts internally deduplicates
  // via refs so each threshold (50%, 25%, expired) fires only once per mount.
  useEffect(() => {
    fireToasts(result)
  }, [result, fireToasts])

  return <CrisisCountdown rule={rule} result={result} incidentId={incidentId} />
}