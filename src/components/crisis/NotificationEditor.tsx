/**
 * NotificationEditor — the main editor form for crisis regulatory notifications.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Features:
 * - Pre-filled form fields from crisis context (via useNotificationPrefill hook)
 * - Real-time email preview (to/cc/subject/body) on the right side
 * - Validation: description ≥ 50 chars, measuresTaken ≥ 30 chars
 * - "Valider et envoyer" button disabled until validation passes
 * - "Annuler" returns to /crisis/:id
 * - "Export PDF" triggers print of the preview
 * - Fallback banner when API generate endpoint returns 404
 * - Accessible: proper labels, aria-describedby, form semantics
 */
import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, X, FileText, AlertCircle } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui/Toast'
import { Button, Input } from '../ui'
import { crisisNotificationApi, generateEmailBody, validateDraft } from '../../services/crisisNotificationService'
import { useNotificationPrefill } from '../../hooks/useNotificationPrefill'
import { NotificationAuthorityHeader } from './NotificationAuthorityHeader'
import type { NotificationDraft, SendNotificationPayload } from '../../types/notification'

interface NotificationEditorProps {
  crisisId: number
  template: string
}

export function NotificationEditor({ crisisId, template }: NotificationEditorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { draft: initialDraft, fallbackUsed, isLoading } = useNotificationPrefill(crisisId, template)

  const [draft, setDraft] = useState<NotificationDraft | undefined>(undefined)
  const [merged, setMerged] = useState(false)

  // Merge initial draft into local state once
  if (initialDraft && !merged) {
    setDraft(initialDraft)
    setMerged(true)
  }

  // Regenerate body whenever relevant fields change
  const currentDraft = useMemo(() => {
    if (!draft) return undefined
    const body = generateEmailBody(draft)
    return { ...draft, body }
  }, [draft])

  const errors = useMemo(() => {
    if (!currentDraft) return {}
    return validateDraft(currentDraft)
  }, [currentDraft])

  const isValid = useMemo(() => {
    if (!currentDraft) return false
    return Object.keys(errors).length === 0
  }, [currentDraft, errors])

  const sendMutation = useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      const res = await crisisNotificationApi.send(crisisId, payload)
      return res.data
    },
    onSuccess: () => {
      toast('success', t('notifications.editor.sendSuccess'))
      // Invalidate timeline so the audit entry shows up
      qc.invalidateQueries({ queryKey: ['crisis', 'timeline', crisisId] })
      qc.invalidateQueries({ queryKey: ['crisis', 'detail', crisisId] })
      navigate(`/crisis/${crisisId}`, { replace: true })
    },
    onError: () => {
      toast('error', t('notifications.editor.sendError'))
    },
  })

  const handleFieldChange = useCallback(
    (field: keyof NotificationDraft, value: string) => {
      setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
    },
    [],
  )

  const handleSend = useCallback(() => {
    if (!currentDraft || !isValid) return
    const payload: SendNotificationPayload = {
      template: currentDraft.template,
      to: currentDraft.to,
      cc: currentDraft.cc,
      subject: currentDraft.subject,
      body: currentDraft.body,
    }
    sendMutation.mutate(payload)
  }, [currentDraft, isValid, sendMutation])

  const handleCancel = useCallback(() => {
    navigate(`/crisis/${crisisId}`, { replace: true })
  }, [navigate, crisisId])

  const handleExportPdf = useCallback(() => {
    window.print()
  }, [])

  if (isLoading || !currentDraft) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
        }}
      >
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {fallbackUsed && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-crisis-warning)',
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} style={{ color: 'var(--color-crisis-warning)', flexShrink: 0 }} />
          <span>{t('notifications.editor.fallbackWarning')}</span>
        </div>
      )}

      <NotificationAuthorityHeader authority={currentDraft.authority} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* Left column — form fields */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          aria-label={t('notifications.editor.formAria')}
        >
          <Input
            id="notif-detection-time"
            label={t('notifications.editor.detectionTime')}
            value={currentDraft.detectionTime}
            onChange={(v) => handleFieldChange('detectionTime', v)}
            disabled
          />
          <Input
            id="notif-affected-assets"
            label={t('notifications.editor.affectedAssets')}
            value={currentDraft.affectedAssets}
            onChange={(v) => handleFieldChange('affectedAssets', v)}
          />
          <Input
            id="notif-organization"
            label={t('notifications.editor.organizationName')}
            value={currentDraft.organizationName}
            onChange={(v) => handleFieldChange('organizationName', v)}
          />
          <Input
            id="notif-country"
            label={t('notifications.editor.organizationCountry')}
            value={currentDraft.organizationCountry}
            onChange={(v) => handleFieldChange('organizationCountry', v)}
          />
          <Input
            id="notif-rssi"
            label={t('notifications.editor.rssiContact')}
            value={currentDraft.rssiContact}
            onChange={(v) => handleFieldChange('rssiContact', v)}
          />

          {/* Description — textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="notif-description"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('notifications.editor.description')}
              <span style={{ color: 'var(--color-danger)', marginLeft: '2px' }}>*</span>
            </label>
            <textarea
              id="notif-description"
              value={currentDraft.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              aria-describedby="notif-description-help"
              aria-invalid={!!errors.description}
              required
              rows={4}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: `1px solid ${errors.description ? 'var(--color-danger)' : 'var(--color-border)'}`,
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <span id="notif-description-help" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {errors.description
                ? t('notifications.editor.validationMin', { n: 50 })
                : t('notifications.editor.descriptionHint')}
            </span>
          </div>

          {/* Measures taken — textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="notif-measures"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('notifications.editor.measuresTaken')}
              <span style={{ color: 'var(--color-danger)', marginLeft: '2px' }}>*</span>
            </label>
            <textarea
              id="notif-measures"
              value={currentDraft.measuresTaken}
              onChange={(e) => handleFieldChange('measuresTaken', e.target.value)}
              aria-describedby="notif-measures-help"
              aria-invalid={!!errors.measuresTaken}
              required
              rows={3}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: `1px solid ${errors.measuresTaken ? 'var(--color-danger)' : 'var(--color-border)'}`,
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <span id="notif-measures-help" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {errors.measuresTaken
                ? t('notifications.editor.validationMin', { n: 30 })
                : t('notifications.editor.measuresHint')}
            </span>
          </div>

          {/* Timeline summary — textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="notif-timeline"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('notifications.editor.timelineSummary')}
            </label>
            <textarea
              id="notif-timeline"
              value={currentDraft.timelineSummary}
              onChange={(e) => handleFieldChange('timelineSummary', e.target.value)}
              rows={3}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </form>

        {/* Right column — email preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div
            style={{
              display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}
          >
            <FileText size={16} />
            {t('notifications.preview.title')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {t('notifications.preview.to')}:{' '}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{currentDraft.to}</span>
            </div>
            {currentDraft.cc && (
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {t('notifications.preview.cc')}:{' '}
                </span>
                <span style={{ color: 'var(--color-text-primary)' }}>{currentDraft.cc}</span>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {t('notifications.preview.subject')}:{' '}
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{currentDraft.subject}</span>
            </div>
          </div>
          <div
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: '6px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              maxHeight: '400px',
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
          >
            {currentDraft.body}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
        <Button variant="secondary" onClick={handleCancel} icon={<X size={16} />}>
          {t('notifications.actions.cancel')}
        </Button>
        <Button variant="secondary" onClick={handleExportPdf} icon={<FileText size={16} />}>
          {t('notifications.actions.exportPdf')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!isValid || sendMutation.isPending}
          icon={<Send size={16} />}
        >
          {sendMutation.isPending ? t('common.loading') : t('notifications.actions.validateSend')}
        </Button>
      </div>
    </div>
  )
}