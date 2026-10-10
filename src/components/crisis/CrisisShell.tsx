/**
 * CrisisShell — the 3-zone War Room layout shell.
 *
 * Ticket #51 — War Room shell mode crise (CDC Part6 §24.1+24.8).
 * Orchestrates the 3 zones described in §24.3-§24.5:
 *   - Zone gauche : Timeline (verrouillée — preuve légale)
 *   - Zone centre : Checklist réflexe (auto-sélection template)
 *   - Zone droite : Annuaire + Coffre-fort documentaire
 *
 * The header includes:
 *   - Incident title + severity
 *   - Sentinelles temporelles (24h ANSSI, 72h CNIL) — integration via #48
 *   - Fullscreen toggle (F11)
 *   - "Quitter le mode crise" button (always visible, with confirmation)
 *
 * The shell replaces the standard AppLayout (no sidebar, no standard header).
 */
import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { crisisApi } from '../../api'
import { useCrisisStore } from '../../stores/crisisStore'
import { Modal, Button, Input, useToast } from '../ui'
import { CrisisTimeline } from './CrisisTimeline'
import { CrisisChecklist } from './CrisisChecklist'
import { CrisisContacts } from './CrisisContacts'
import { CrisisVault } from './CrisisVault'
import { CrisisCountdownBar } from './CrisisCountdownBar'
import { CrisisZoneErrorBoundary } from './CrisisZoneErrorBoundary'
import { AlertTriangle, Maximize2, Minimize2, LogOut } from 'lucide-react'

export function CrisisShell() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { fullscreen, exitCrisis, toggleFullscreen } = useCrisisStore()
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitReason, setExitReason] = useState('')

  const incidentIdNum = Number(incidentId)

  const { data: crisisDetail } = useQuery({
    queryKey: ['crisis', 'detail', incidentIdNum],
    queryFn: () => crisisApi.get(incidentIdNum).then((r) => r.data),
    enabled: !!incidentIdNum,
  })

  const updateStatusMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisApi.updateStatus(incidentIdNum, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis'] })
    },
  })

  const detail = (crisisDetail ?? {}) as Record<string, unknown>
  const incidentTitle = String(detail.title ?? t('warRoom.defaultTitle'))
  const incidentSeverity = String(detail.severity ?? 'unknown')
  const isActive = String(detail.status ?? '') === 'active'
  const incidentStartedAt = String(detail.created_at ?? detail.started_at ?? '') || null

  const handleExitConfirm = useCallback(() => {
    if (!exitReason.trim()) {
      toast('error', t('warRoom.exitReasonRequired'))
      return
    }
    if (isActive) {
      updateStatusMutation.mutate({ status: 'resolved', exit_reason: exitReason })
    }
    // Trigger PDF export (window.print with crisis stylesheet)
    window.print()
    exitCrisis()
    setShowExitModal(false)
    setExitReason('')
    navigate('/crisis', { replace: true })
  }, [exitReason, isActive, updateStatusMutation, exitCrisis, toast, t, navigate])

  const sentinelActive = isActive

  return (
    <div className={`warroom-container ${fullscreen ? 'warroom-fullscreen' : ''}`}>
      {/* Header */}
      <div className="warroom-header">
        <div className="warroom-title">
          <AlertTriangle size={22} style={{ color: 'var(--color-crisis-danger)' }} />
          <span>{incidentTitle}</span>
          <span
            className={`warroom-sentinel ${sentinelActive ? '' : 'warroom-sentinel-ok'}`}
            data-testid="warroom-sentinel"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block' }} />
            {sentinelActive ? t('warRoom.sentinelActive') : t('warRoom.sentinelIdle')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-crisis-border)' }}>
            #{incidentId} · {t(`common.criticalityLabels.${incidentSeverity}`)}
          </span>
        </div>
        {/* Regulatory sentinel countdowns (ticket #48) */}
        <CrisisCountdownBar incidentId={incidentIdNum} incidentStartedAt={incidentStartedAt} />
        <div className="warroom-actions">
          <button className="warroom-btn" onClick={toggleFullscreen} aria-label="toggle-fullscreen">
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {fullscreen ? t('warRoom.exitFullscreen') : t('warRoom.fullscreen')}
          </button>
          <button
            className="warroom-btn warroom-btn-danger"
            onClick={() => setShowExitModal(true)}
            aria-label="exit-crisis"
          >
            <LogOut size={16} />
            {t('warRoom.exit')}
          </button>
        </div>
      </div>

      {/* 3 zones */}
      <div className="warroom-body">
        {/* Zone 1 — Timeline (verrouillée) */}
        <CrisisZoneErrorBoundary
          zoneLabel={t('warRoom.timeline')}
          fallbackMessage={t('warRoom.zoneErrorFallback')}
        >
          <CrisisTimeline incidentId={incidentIdNum} />
        </CrisisZoneErrorBoundary>

        {/* Zone 2 — Checklist réflexe */}
        <CrisisZoneErrorBoundary
          zoneLabel={t('warRoom.checklist')}
          fallbackMessage={t('warRoom.zoneErrorFallback')}
        >
          <CrisisChecklist crisisId={incidentIdNum} />
        </CrisisZoneErrorBoundary>

        {/* Zone 3 — Annuaire + Coffre-fort */}
        <CrisisZoneErrorBoundary
          zoneLabel={t('crisis.contacts.title')}
          fallbackMessage={t('warRoom.zoneErrorFallback')}
        >
          <CrisisContacts />
        </CrisisZoneErrorBoundary>

        {/* Zone 4 — Coffre-fort documentaire (ticket #47) */}
        <CrisisZoneErrorBoundary
          zoneLabel={t('vault.title')}
          fallbackMessage={t('warRoom.zoneErrorFallback')}
        >
          <CrisisVault />
        </CrisisZoneErrorBoundary>
      </div>

      {/* Exit confirmation modal */}
      <Modal
        open={showExitModal}
        onClose={() => setShowExitModal(false)}
        title={t('warRoom.exitTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowExitModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleExitConfirm} disabled={!exitReason.trim()}>
              {t('warRoom.exitConfirm')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('warRoom.exitMessage')}
          </p>
          <Input
            value={exitReason}
            onChange={setExitReason}
            label={t('warRoom.exitReasonLabel')}
            required
          />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('warRoom.exitPdfNote')}
          </p>
        </div>
      </Modal>
    </div>
  )
}