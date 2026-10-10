/**
 * QualificationStep — the pre-crisis qualification interface.
 *
 * Ticket #51 — War Room shell mode crise (CDC Part6 §24.1+24.8).
 * Wraps the QualificationModal with a standalone step component so it can be
 * rendered inline in the crisis workflow (route /crisis/:incidentId before
 * activation, or as a modal gate from the crisis list).
 *
 * Flow:
 * 1. Display OUI/NON questions (impact données perso ? impact business ?)
 * 2. If both OUI → enable "DÉCLENCHER LE PROTOCOLE RÉGLEMENTAIRE" (red, pulsing)
 * 3. If at least one NON → button greyed + message "Incident non significatif"
 * 4. On trigger → enterCrisis(incidentId) + redirect to /crisis/:incidentId
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui'
import { useCrisisStore } from '../../stores/crisisStore'
import { qualifyIncident, markNotSignificant } from '../../services/crisisService'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

type Answer = 'yes' | 'no' | null

interface QualificationStepProps {
  incidentId: number
  incidentTitle: string
}

export function QualificationStep({ incidentId, incidentTitle }: QualificationStepProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const enterCrisis = useCrisisStore((s) => s.enterCrisis)

  const [q1, setQ1] = useState<Answer>(null)
  const [q2, setQ2] = useState<Answer>(null)

  const bothYes = q1 === 'yes' && q2 === 'yes'
  const atLeastOneNo = q1 === 'no' || q2 === 'no'

  const qualifyMutation = useMutation({
    mutationFn: () => qualifyIncident(incidentId, true),
    onSuccess: (data) => {
      toast('success', t('qualification.qualifySuccess'))
      qc.invalidateQueries({ queryKey: ['crisis'] })
      enterCrisis(incidentId, data.crisisToken ?? null)
      navigate(`/crisis/${incidentId}`, { replace: true })
    },
    onError: () => {
      toast('error', t('qualification.qualifyError'))
    },
  })

  const notSignificantMutation = useMutation({
    mutationFn: () => markNotSignificant(incidentId),
    onSuccess: () => {
      toast('success', t('qualification.notSignificantSuccess'))
      qc.invalidateQueries({ queryKey: ['crisis'] })
      navigate(`/incidents`, { replace: true })
    },
    onError: () => {
      toast('error', t('qualification.notSignificantError'))
    },
  })

  const renderYesNoButtons = (
    answer: Answer,
    onYes: () => void,
    onNo: () => void,
    labelPrefix: string,
  ) => (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <button
        onClick={onYes}
        aria-pressed={answer === 'yes'}
        aria-label={`${labelPrefix}-yes`}
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          border: answer === 'yes'
            ? '1px solid var(--color-danger)'
            : '1px solid var(--color-border)',
          background: answer === 'yes'
            ? 'var(--color-danger)'
            : 'transparent',
          color: answer === 'yes' ? '#ffffff' : 'var(--color-text-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        {t('common.yes')}
      </button>
      <button
        onClick={onNo}
        aria-pressed={answer === 'no'}
        aria-label={`${labelPrefix}-no`}
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          border: '1px solid var(--color-border)',
          background: answer === 'no'
            ? 'var(--color-bg-secondary)'
            : 'transparent',
          color: 'var(--color-text-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        {t('common.no')}
      </button>
    </div>
  )

  return (
    <div
      className="crisis-qualification-step"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        maxWidth: '640px',
        margin: '0 auto',
      }}
      role="dialog"
      aria-label={t('qualification.alertPrefix', { alert: incidentTitle })}
    >
      {/* Alert banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: '8px',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-warning)',
        }}
      >
        <AlertTriangle
          size={18}
          style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '1px' }}
        />
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {t('qualification.intro')}
        </span>
      </div>

      {/* Q1 */}
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('qualification.q1')}
        </p>
        {renderYesNoButtons(q1, () => setQ1('yes'), () => setQ1('no'), 'q1')}
      </div>

      {/* Q2 */}
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('qualification.q2')}
        </p>
        {renderYesNoButtons(q2, () => setQ2('yes'), () => setQ2('no'), 'q2')}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        {atLeastOneNo && !bothYes && (
          <>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                margin: 0,
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {t('qualification.notSignificantMessage')}
            </p>
            <button
              onClick={() => notSignificantMutation.mutate()}
              disabled={notSignificantMutation.isPending}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
              }}
            >
              {notSignificantMutation.isPending
                ? t('common.loading')
                : t('qualification.markNotSignificant')}
            </button>
          </>
        )}

        {bothYes && (
          <button
            className="crisis-trigger-pulse"
            onClick={() => qualifyMutation.mutate()}
            disabled={qualifyMutation.isPending}
            aria-label="trigger-protocol"
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid var(--color-crisis-danger)',
              background: 'var(--color-crisis-danger)',
              color: '#ffffff',
            }}
          >
            <ShieldAlert size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {qualifyMutation.isPending
              ? t('common.loading')
              : t('qualification.triggerProtocol')}
          </button>
        )}

        {!bothYes && !atLeastOneNo && (
          <button
            disabled
            aria-label="trigger-protocol"
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'not-allowed',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              opacity: 0.6,
            }}
          >
            <ShieldAlert size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {t('qualification.triggerProtocol')}
          </button>
        )}
      </div>
    </div>
  )
}