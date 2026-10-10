/**
 * QualificationModal — War Room qualification step.
 *
 * Displays OUI/NON questions to determine if an incident is significant
 * enough to trigger the regulatory protocol (crisis mode).
 *
 * If both answers are OUI → "DÉCLENCHER LE PROTOCOLE RÉGLEMENTAIRE" button
 * If at least one is NON → "Marquer comme non significatif" button
 *
 * POST /api/v1/incidents/:id/qualify { significant: true } on trigger
 * PATCH status + modal close on non-significant
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { Modal, Button, useToast } from '../ui'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useCrisisStore } from '../../stores/crisisStore'
import { qualifyIncident, markNotSignificant } from '../../services/crisisService'

interface QualificationModalProps {
  open: boolean
  onClose: () => void
  incidentId: number
  incidentTitle: string
  /** Called after successful qualification + crisis mode activation */
  onQualified?: () => void
}

type Answer = 'yes' | 'no' | null

export function QualificationModal({
  open,
  onClose,
  incidentId,
  incidentTitle,
  onQualified,
}: QualificationModalProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const enterCrisis = useCrisisStore((s) => s.enterCrisis)

  const [q1, setQ1] = useState<Answer>(null)
  const [q2, setQ2] = useState<Answer>(null)

  const bothYes = q1 === 'yes' && q2 === 'yes'
  const atLeastOneNo = q1 === 'no' || q2 === 'no'

  const resetState = useCallback(() => {
    setQ1(null)
    setQ2(null)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  // Qualify as significant → POST qualify + enterCrisis
  const qualifyMutation = useMutation({
    mutationFn: () => qualifyIncident(incidentId, true),
    onSuccess: (data) => {
      toast('success', t('qualification.qualifySuccess'))
      qc.invalidateQueries({ queryKey: ['crisis'] })
      enterCrisis(incidentId, data.crisisToken ?? null)
      resetState()
      onQualified?.()
    },
    onError: () => {
      toast('error', t('qualification.qualifyError'))
    },
  })

  // Mark as not significant → PATCH status + close modal
  const notSignificantMutation = useMutation({
    mutationFn: () => markNotSignificant(incidentId),
    onSuccess: () => {
      toast('success', t('qualification.notSignificantSuccess'))
      qc.invalidateQueries({ queryKey: ['crisis'] })
      resetState()
      onClose()
    },
    onError: () => {
      toast('error', t('qualification.notSignificantError'))
    },
  })

  const renderYesNoButtons = (
    answer: Answer,
    onYes: () => void,
    onNo: () => void,
  ) => (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <button
        onClick={onYes}
        aria-pressed={answer === 'yes'}
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
    <Modal
      open={open}
      onClose={handleClose}
      title={t('qualification.alertPrefix', { alert: incidentTitle })}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          {atLeastOneNo && (
            <Button
              variant="secondary"
              onClick={() => notSignificantMutation.mutate()}
              disabled={notSignificantMutation.isPending}
            >
              {notSignificantMutation.isPending
                ? t('common.loading')
                : t('qualification.markNotSignificant')}
            </Button>
          )}
          {bothYes && (
            <Button
              variant="danger"
              icon={<ShieldAlert size={16} />}
              onClick={() => qualifyMutation.mutate()}
              disabled={qualifyMutation.isPending}
            >
              {qualifyMutation.isPending
                ? t('common.loading')
                : t('qualification.triggerProtocol')}
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          {renderYesNoButtons(q1, () => setQ1('yes'), () => setQ1('no'))}
        </div>

        {/* Q2 */}
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('qualification.q2')}
          </p>
          {renderYesNoButtons(q2, () => setQ2('yes'), () => setQ2('no'))}
        </div>
      </div>
    </Modal>
  )
}