import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useToast } from '../ui/Toast'
import { Badge } from '../ui/Badge'

interface PolicyReaderProps {
  policy: Record<string, unknown>
  onClose: () => void
}

function policyStatusBadge(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'default'
    case 'review': return 'warning'
    case 'deprecated': return 'danger'
    default: return 'default'
  }
}

/**
 * Scroll-forced policy reader.
 *
 * The "J'ai pris connaissance" (acknowledge) button is disabled until
 * the user has scrolled to the bottom of the policy content. A progress
 * bar at the top shows how far through the document the user is.
 *
 * On click, POST /api/v1/governance/policies/:id/acknowledge is called,
 * a success toast is shown, and the notifications query is invalidated
 * so the originating notification disappears.
 */
export function PolicyReader({ policy, onClose }: PolicyReaderProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { containerRef, progress, reachedBottom, handleScroll } = useScrollProgress()

  const title = String(policy.title ?? '')
  const version = String(policy.version ?? '1.0')
  const content = String(policy.content ?? '')
  const status = String(policy.status ?? '')
  const policyId = Number(policy.id)

  const ackMutation = useMutation({
    mutationFn: (id: number) => governanceApi.acknowledgePolicy(id, version),
    onSuccess: () => {
      toast('success', t('governance.policies.acknowledgeSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'policies'] })
      qc.invalidateQueries({ queryKey: ['governance', 'policy'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      onClose()
    },
    onError: (error: unknown) => {
      const errData = (error as { response?: { status?: number; data?: { error?: string } } }).response?.data
      const errCode = errData?.error
      const status = (error as { response?: { status?: number } }).response?.status
      let msg: string
      if (status === 404 || errCode === 'not_found') {
        msg = t('governance.policies.ackErrNotFound')
      } else if (errCode === 'policy_not_active') {
        msg = t('governance.policies.ackErrPolicyNotActive')
      } else if (errCode === 'not_in_recipients') {
        msg = t('governance.policies.ackErrNotInRecipients')
      } else if (errCode === 'already_acknowledged') {
        msg = t('governance.policies.ackErrAlreadyAcknowledged')
      } else {
        msg = t('governance.policies.acknowledgeError')
      }
      toast('error', msg)
    },
  })

  const ackLabel = t('governance.policies.acknowledgeAria', { title, version })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('governance.policies.readProgress')}
        style={{
          height: '4px',
          background: 'var(--color-border)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--color-accent)',
            transition: 'width 0.15s ease-out',
          }}
        />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Badge variant={policyStatusBadge(status)}>{status}</Badge>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {t('governance.policies.version')}: {version}
        </span>
        {!reachedBottom && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <AlertCircle size={14} />
            {t('governance.policies.scrollToAck')}
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          maxHeight: '50vh',
          overflowY: 'auto',
          padding: '20px',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          background: 'var(--color-bg-secondary)',
          fontSize: '14px',
          lineHeight: 1.6,
          color: 'var(--color-text-primary)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content || t('governance.policies.noContent')}
      </div>

      {/* Acknowledge button — fixed at bottom */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => ackMutation.mutate(policyId)}
          disabled={!reachedBottom || ackMutation.isPending}
          aria-label={ackLabel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: reachedBottom && !ackMutation.isPending ? 'pointer' : 'not-allowed',
            background: reachedBottom ? 'var(--color-success)' : 'var(--color-bg-hover)',
            color: reachedBottom ? '#ffffff' : 'var(--color-text-secondary)',
            opacity: reachedBottom ? 1 : 0.7,
            transition: 'background 0.2s, opacity 0.2s',
          }}
        >
          <CheckCircle size={18} />
          {ackMutation.isPending
            ? t('governance.policies.acknowledging')
            : t('governance.policies.acknowledgeButton')}
        </button>
      </div>
    </div>
  )
}