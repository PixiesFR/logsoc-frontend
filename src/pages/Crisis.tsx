import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { crisisSessionsApi, assetsApi } from '../api'
import { Card, Badge, Tabs, Modal, Button, Input, Select, StatCard, EmptyState } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import {
  AlertTriangle, Shield, CheckCircle, SkipForward,
  Clock, Eye, Copy, Trash2, Edit3, Sparkles, ChevronUp, ChevronDown, X,
  Activity, BookOpen, TestTube, Flag, Plus
} from 'lucide-react'

function severityVariant(sev: string): 'danger' | 'warning' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'default'
  }
}

function statusVariant(status: string): 'danger' | 'warning' | 'success' | 'default' {
  switch (status) {
    case 'active': return 'danger'
    case 'contained': return 'warning'
    case 'resolved': return 'success'
    case 'archived': return 'default'
    case 'postmortem': return 'warning'
    default: return 'default'
  }
}

function stepStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
    case 'in_progress': return <Activity size={16} style={{ color: 'var(--color-warning)' }} />
    case 'skipped': return <SkipForward size={16} style={{ color: 'var(--color-text-secondary)' }} />
    default: return <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}

type Playbook = Record<string, unknown>
type Session = Record<string, unknown>
type SessionStep = Record<string, unknown>
type SessionAsset = Record<string, unknown>
type TimelineEntry = Record<string, unknown>

// ── Create Crisis Session Modal ──
function CreateSessionModal({ open, onClose, playbooks, assets }: {
  open: boolean
  onClose: () => void
  playbooks: Playbook[]
  assets: { id: number; hostname: string }[]
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    title: '', description: '', crisis_type: 'security', severity: 'high',
    playbook_id: '', is_test: false,
  })
  const [selectedAssets, setSelectedAssets] = useState<number[]>([])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisSessionsApi.createSession(data),
    onSuccess: () => {
      toast('success', t('crisis.createSuccess'))
      qc.invalidateQueries({ queryKey: ['crisis-sessions'] })
      onClose()
      setForm({ title: '', description: '', crisis_type: 'security', severity: 'high', playbook_id: '', is_test: false })
      setSelectedAssets([])
    },
    onError: () => toast('error', t('crisis.createError')),
  })

  const handleSubmit = () => {
    if (!form.title.trim()) return
    createMutation.mutate({
      title: form.title,
      description: form.description,
      crisis_type: form.crisis_type,
      severity: form.severity,
      playbook_id: form.playbook_id ? Number(form.playbook_id) : null,
      is_test: form.is_test,
      asset_ids: selectedAssets,
    } as Record<string, unknown>)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('crisis.newCrisis')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || createMutation.isPending}>
            {createMutation.isPending ? t('common.loading') : t('common.create')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Input value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} label={t('crisis.title_field')} required />
        <Input value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} label={t('common.description')} />
        <Select
          value={form.crisis_type}
          onChange={(v) => setForm(f => ({ ...f, crisis_type: v }))}
          options={[
            { label: t('crisis.security'), value: 'security' },
            { label: t('crisis.incident'), value: 'incident' },
            { label: t('crisis.operational'), value: 'operational' },
            { label: t('crisis.compliance'), value: 'compliance' },
          ]}
          label={t('crisis.crisisType')}
        />
        <Select
          value={form.severity}
          onChange={(v) => setForm(f => ({ ...f, severity: v }))}
          options={[
            { label: t('crisis.severityCritical'), value: 'critical' },
            { label: t('crisis.severityHigh'), value: 'high' },
            { label: t('crisis.severityMedium'), value: 'medium' },
            { label: t('crisis.severityLow'), value: 'low' },
          ]}
          label={t('common.severity')}
        />
        <Select
          value={form.playbook_id}
          onChange={(v) => setForm(f => ({ ...f, playbook_id: v }))}
          options={[
            { label: t('crisis.noPlaybook'), value: '' },
            ...playbooks.map((pb: Playbook) => ({ label: String(pb.name ?? ''), value: String(pb.id ?? '') })),
          ]}
          label={t('crisis.playbookUsed')}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.is_test}
            onChange={(e) => setForm(f => ({ ...f, is_test: e.target.checked }))}
          />
          <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{t('crisis.testMode')}</span>
        </label>
        {assets.length > 0 && (
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>
              {t('crisis.affectedAssets')}
            </label>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px' }}>
              {assets.map((a) => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(a.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedAssets(s => [...s, a.id])
                      else setSelectedAssets(s => s.filter(id => id !== a.id))
                    }}
                  />
                  <span style={{ fontSize: '13px' }}>{a.hostname}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Create/Edit Playbook Modal ──
function PlaybookModal({ open, onClose, playbook, mode }: {
  open: boolean
  onClose: () => void
  playbook: Playbook | null
  mode: 'create' | 'edit'
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    name: '', description: '', crisis_type: 'security', severity: 'high', is_template: false,
  })
  const [steps, setSteps] = useState<Array<{ step_number: number; title: string; description: string; action: string; responsible_role: string; validation_criteria: string; escalation: string }>>([
    { step_number: 1, title: '', description: '', action: '', responsible_role: 'admin', validation_criteria: '', escalation: '' },
  ])
  const [showAI, setShowAI] = useState(false)

  // Populate from playbook when editing
  useState(() => {
    if (mode === 'edit' && playbook) {
      setForm({
        name: String(playbook.name ?? ''),
        description: String(playbook.description ?? ''),
        crisis_type: String(playbook.crisis_type ?? 'security'),
        severity: String(playbook.severity ?? 'high'),
        is_template: Boolean(playbook.is_template ?? false),
      })
      const pbSteps = (playbook.playbook_steps ?? []) as Array<Record<string, unknown>>
      if (pbSteps.length > 0) {
        setSteps(pbSteps.map((s, i) => ({
          step_number: i + 1,
          title: String(s.title ?? ''),
          description: String(s.description ?? ''),
          action: String(s.action ?? ''),
          responsible_role: String(s.responsible_role ?? 'admin'),
          validation_criteria: String(s.validation_criteria ?? ''),
          escalation: String(s.escalation ?? ''),
        })))
      }
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mode === 'create' ? crisisSessionsApi.createPlaybook(data) : crisisSessionsApi.updatePlaybook(Number(playbook?.id), data),
    onSuccess: () => {
      toast('success', mode === 'create' ? t('crisis.createSuccess') : t('common.save'))
      qc.invalidateQueries({ queryKey: ['crisis-playbooks'] })
      onClose()
    },
    onError: () => toast('error', t('crisis.createError')),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) return
    createMutation.mutate({ ...form, steps: steps.filter(s => s.title.trim()) } as Record<string, unknown>)
  }

  const addStep = () => {
    setSteps(s => [...s, { step_number: s.length + 1, title: '', description: '', action: '', responsible_role: 'admin', validation_criteria: '', escalation: '' }])
  }

  const removeStep = (idx: number) => {
    setSteps(s => s.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })))
  }

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= steps.length) return
    setSteps(s => {
      const arr = [...s]
      const tmp = arr[idx]
      arr[idx] = arr[newIdx]
      arr[newIdx] = tmp
      return arr.map((s, i) => ({ ...s, step_number: i + 1 }))
    })
  }

  const updateStep = (idx: number, field: string, value: string) => {
    setSteps(s => s.map((step, i) => i === idx ? { ...step, [field]: value } : step))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('crisis.createPlaybook') : t('crisis.editPlaybook')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || createMutation.isPending}>
            {createMutation.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Input value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} label={t('common.name')} required />
        <Input value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} label={t('common.description')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <Select
            value={form.crisis_type}
            onChange={(v) => setForm(f => ({ ...f, crisis_type: v }))}
            options={[
              { label: t('crisis.security'), value: 'security' },
              { label: t('crisis.incident'), value: 'incident' },
              { label: t('crisis.operational'), value: 'operational' },
              { label: t('crisis.compliance'), value: 'compliance' },
            ]}
            label={t('crisis.crisisType')}
          />
          <Select
            value={form.severity}
            onChange={(v) => setForm(f => ({ ...f, severity: v }))}
            options={[
              { label: t('crisis.severityCritical'), value: 'critical' },
              { label: t('crisis.severityHigh'), value: 'high' },
              { label: t('crisis.severityMedium'), value: 'medium' },
              { label: t('crisis.severityLow'), value: 'low' },
            ]}
            label={t('common.severity')}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_template} onChange={(e) => setForm(f => ({ ...f, is_template: e.target.checked }))} />
            <span style={{ fontSize: '14px' }}>{t('crisis.template')}</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('crisis.steps_label')} ({steps.length})
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={() => setShowAI(true)}>
              {t('crisis.generateWithAI')}
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={addStep}>
              {t('crisis.addAction')}
            </Button>
          </div>
        </div>

        {steps.map((step, idx) => (
          <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {t('crisis.stepNumber')} {idx + 1}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)', padding: '2px' }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} style={{ background: 'none', border: 'none', cursor: idx === steps.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)', padding: '2px' }}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Input value={String(step.title ?? "")} onChange={(v) => updateStep(idx, 'title', v)} label={t('common.name')} required />
              <Input value={step.responsible_role} onChange={(v) => updateStep(idx, 'responsible_role', v)} label={t('crisis.responsibleRole')} />
              <Input value={String(step.description ?? "")} onChange={(v) => updateStep(idx, 'description', v)} label={t('common.description')} />
              <Input value={String(step.action ?? "")} onChange={(v) => updateStep(idx, 'action', v)} label={t('crisis.stepStart')} />
              <Input value={step.validation_criteria} onChange={(v) => updateStep(idx, 'validation_criteria', v)} label={t('crisis.validationCriteria')} />
              <Input value={step.escalation} onChange={(v) => updateStep(idx, 'escalation', v)} label={t('crisis.escalation')} />
            </div>
          </div>
        ))}
      </div>

      {/* AI Placeholder Modal */}
      <Modal
        open={showAI}
        onClose={() => setShowAI(false)}
        title={t('crisis.generateWithAI')}
        footer={<Button variant="secondary" onClick={() => setShowAI(false)}>{t('common.close')}</Button>}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Sparkles size={48} style={{ color: 'var(--color-accent)', marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            {t('crisis.aiComingSoon')}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            AI-powered playbook generation will analyze your assets, alerts, and crisis type to suggest optimal response procedures.
          </p>
        </div>
      </Modal>
    </Modal>
  )
}

// ── Session Detail Modal ──
function SessionDetailModal({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { canEdit } = usePermissions()
  const canModify = canEdit('compliance_officer')

  const { data: session, isLoading } = useQuery({
    queryKey: ['crisis-session', sessionId],
    queryFn: () => crisisSessionsApi.getSession(sessionId).then(r => r.data),
    enabled: !!sessionId,
  })

  const stepMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: number; data: Record<string, unknown> }) =>
      crisisSessionsApi.updateSessionStep(sessionId, stepId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] }),
    onError: () => toast('error', t('common.error')),
  })

  const resolveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisSessionsApi.resolveSession(sessionId, data),
    onSuccess: () => {
      toast('success', t('crisis.resolve'))
      qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] })
      qc.invalidateQueries({ queryKey: ['crisis-sessions'] })
    },
    onError: () => toast('error', t('common.error')),
  })

  const addAssetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisSessionsApi.addSessionAsset(sessionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] }),
    onError: () => toast('error', t('common.error')),
  })

  const removeAssetMutation = useMutation({
    mutationFn: (assetId: number) => crisisSessionsApi.removeSessionAsset(sessionId, assetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] }),
    onError: () => toast('error', t('common.error')),
  })

  const addNoteMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisSessionsApi.addTimelineEntry(sessionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] }),
    onError: () => toast('error', t('common.error')),
  })

  // ── Manual step management ──
  const addStepMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => crisisSessionsApi.addSessionStep(sessionId, data),
    onSuccess: () => {
      toast('success', t('crisis.stepAdded'))
      qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] })
      setShowAddStep(false)
      setNewStepForm({ title: '', description: '', action: '' })
    },
    onError: () => toast('error', t('common.error')),
  })

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: number) => crisisSessionsApi.removeSessionStep(sessionId, stepId),
    onSuccess: () => {
      toast('success', t('crisis.stepDeleted'))
      qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] })
    },
    onError: () => toast('error', t('common.error')),
  })

  const reorderStepMutation = useMutation({
    mutationFn: ({ stepId, newStepNumber }: { stepId: number; newStepNumber: number }) =>
      crisisSessionsApi.reorderSessionStep(sessionId, stepId, newStepNumber),
    onSuccess: () => {
      toast('success', t('crisis.stepReordered'))
      qc.invalidateQueries({ queryKey: ['crisis-session', sessionId] })
    },
    onError: () => toast('error', t('common.error')),
  })

  // ── AI Chat ──
  const chatMutation = useMutation({
    mutationFn: (message: string) => crisisSessionsApi.chatWithAI(sessionId, message),
    onSuccess: (response) => {
      const data = response.data as Record<string, unknown>
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: String(data.response ?? ''), model: String(data.model ?? '') }])
      setChatInput('')
    },
    onError: () => {
      setChatMessages(prev => [...prev, { role: 'assistant' as const, content: 'Error: unable to reach AI assistant.', model: '' }])
    },
  })

  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepForm, setNewStepForm] = useState({ title: '', description: '', action: '' })
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; model?: string }>>([])
  const [chatInput, setChatInput] = useState('')

  const { data: report } = useQuery({
    queryKey: ['crisis-session-report', sessionId],
    queryFn: () => crisisSessionsApi.getSessionReport(sessionId).then(r => r.data),
    enabled: showReport && !!sessionId,
  })

  const { data: assetsList } = useQuery({
    queryKey: ['assets-for-crisis'],
    queryFn: () => assetsApi.list().then(r => {
      const d = r.data as Record<string, unknown>
      const items = (Array.isArray(d) ? d : (d?.items ?? [])) as Array<Record<string, unknown>>
      return items.map((a) => ({ id: Number(a.id), hostname: String(a.hostname ?? `Agent #${a.id}`) }))
    }),
    enabled: showAddAsset,
  })

  if (isLoading || !session) return <Modal open={true} onClose={onClose} title={t('common.loading')}><div>{t('common.loading')}</div></Modal>

  const s = session as Record<string, unknown>
  const steps = (s.steps ?? []) as SessionStep[]
  const assets = (s.assets ?? []) as SessionAsset[]
  const timeline = (s.timeline ?? []) as TimelineEntry[]
  const completed = (s.completed_steps as number) || steps.filter(st => st.status === 'completed').length
  const total = (s.total_steps as number) || steps.length

  return (
    <Modal open={true} onClose={onClose} title={String(s.title ?? s.summary ?? s.scenario ?? t('crisis.sessionDetail'))} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '80vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
              <Badge variant={statusVariant(String(s.status ?? ''))} size="sm">{String(s.status ?? '')}</Badge>
              <Badge variant={severityVariant(String(s.severity ?? ''))} size="sm">{t(`common.criticalityLabels.${s.severity ?? 'low'}`)}</Badge>
              {!!s.is_test && <Badge variant="warning" size="sm"><TestTube size={12} style={{ marginRight: '4px' }} />{t('crisis.isTest')}</Badge>}
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {t('crisis.crisisType')}: {t(`crisis.${s.crisis_type ?? 'security'}`)}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {t('crisis.duration')}: {formatDuration(!!s.resolved_at && !!s.activated_at ?
                Math.floor((new Date(String(s.resolved_at)).getTime() - new Date(String(s.activated_at)).getTime()) / 1000) :
                !!s.activated_at ? Math.floor((Date.now() - new Date(String(s.activated_at)).getTime()) / 1000) : 0)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {canModify && String(s.status) === 'active' && (
              <Button size="sm" variant="danger" icon={<Flag size={14} />} onClick={() => setShowResolveConfirm(true)}>
                {t('crisis.resolve')}
              </Button>
            )}
            {String(s.status) === 'resolved' && (
              <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => setShowReport(true)}>
                {t('crisis.viewReport')}
              </Button>
            )}
          </div>
        </div>

        {/* Playbook used */}
        {!!s.playbook && (
          <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('crisis.playbookUsed')}:</span>{' '}
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {String((s.playbook as Record<string, unknown>)?.name ?? t('crisis.noPlaybook'))}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {steps.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('crisis.progress')}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{completed}/{total} {t('crisis.steps_label')}</span>
            </div>
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                background: 'var(--color-success)', height: '100%', width: `${total > 0 ? (completed / total * 100) : 0}%`,
                borderRadius: '4px', transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Assets */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('crisis.affectedAssets')} ({assets.length})</h4>
            {canModify && s.status === 'active' && (
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddAsset(true)}>
                {t('crisis.addAsset')}
              </Button>
            )}
          </div>
          {assets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
              {assets.map((a: SessionAsset, i: number) => (
                <div key={String(a.id ?? i)} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{String(a.hostname ?? `Agent #${a.agent_id}`)}</span>
                    {!!a.ip && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{String(a.ip)}</span>}
                    <Badge variant={severityVariant(String(a.impact_level ?? 'affected'))} size="sm">
                      {t(`crisis.impact_${a.impact_level ?? 'affected'}`)}
                    </Badge>
                  </div>
                  {canModify && s.status === 'active' && (
                    <button onClick={() => removeAssetMutation.mutate(Number(a.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t('crisis.noCrises')}</p>
          )}
        </div>

        {/* Steps */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('crisis.steps_label')} ({steps.length})</h4>
            {canModify && String(s.status) === 'active' && (
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddStep(true)}>
                {t('crisis.addStep')}
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {steps.map((step: SessionStep, i: number) => (
              <div key={String(step.id ?? i)} style={{
                padding: '12px', borderRadius: '8px',
                border: `1px solid var(--color-border)`,
                background: step.status === 'completed' ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
                opacity: step.status === 'skipped' ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stepStatusIcon(String(step.status ?? 'pending'))}
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{String(step.step_number ?? i + 1)}. {String(step.title ?? '')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {canModify && String(s.status) === 'active' && (
                      <>
                        <button
                          onClick={() => reorderStepMutation.mutate({ stepId: Number(step.id), newStepNumber: Number(step.step_number) - 1 })}
                          disabled={Number(step.step_number) <= 1 || reorderStepMutation.isPending}
                          style={{ background: 'none', border: 'none', cursor: Number(step.step_number) <= 1 ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)', padding: '2px', opacity: Number(step.step_number) <= 1 ? 0.3 : 1 }}
                          title={t('crisis.moveUp')}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => reorderStepMutation.mutate({ stepId: Number(step.id), newStepNumber: Number(step.step_number) + 1 })}
                          disabled={Number(step.step_number) >= steps.length || reorderStepMutation.isPending}
                          style={{ background: 'none', border: 'none', cursor: Number(step.step_number) >= steps.length ? 'not-allowed' : 'pointer', color: 'var(--color-text-secondary)', padding: '2px', opacity: Number(step.step_number) >= steps.length ? 0.3 : 1 }}
                          title={t('crisis.moveDown')}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm(t('crisis.deleteStep'))) deleteStepMutation.mutate(Number(step.id)) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}
                          title={t('crisis.deleteStep')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {canModify && s.status === 'active' && step.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => stepMutation.mutate({ stepId: Number(step.id), data: { status: 'in_progress' } })}>
                        {t('crisis.stepStart')}
                      </Button>
                    )}
                    {canModify && s.status === 'active' && step.status === 'in_progress' && (
                      <>
                        <Button size="sm" onClick={() => stepMutation.mutate({ stepId: Number(step.id), data: { status: 'completed' } })}>
                          {t('crisis.stepCompleted')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => stepMutation.mutate({ stepId: Number(step.id), data: { status: 'skipped' } })}>
                          {t('crisis.stepSkip')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {(!!step.description || !!step.action) && (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    {!!step.description && <span>{String(step.description)}</span>}
                    {!!step.action && <span style={{ marginLeft: '8px' }}>→ {String(step.action)}</span>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {!!step.responsible_role && <span>👤 {String(step.responsible_role)}</span>}
                  {!!step.completed_by && <span>✓ {t('crisis.completedBy')}: #{String(step.completed_by ?? "")}</span>}
                  {!!step.completed_at && <span>🕐 {String(step.completed_at).slice(0, 16)}</span>}
                </div>
                {!!step.notes && (
                  <div style={{ marginTop: '4px', fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                    📝 {String(step.notes)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Assistant */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', background: 'var(--color-bg-secondary)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
            {t('crisis.aiAssistant')}
          </h4>
          <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            {chatMessages.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '16px' }}>
                {t('crisis.aiMessage')}
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={10} /> {msg.model || 'IA'}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: 'var(--color-bg-primary)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('crisis.aiThinking')}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim() && !chatMutation.isPending) {
                  setChatMessages(prev => [...prev, { role: 'user', content: chatInput.trim() }])
                  chatMutation.mutate(chatInput.trim())
                }
              }}
              placeholder={t('crisis.aiMessage')}
              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none' }}
              disabled={chatMutation.isPending}
            />
            <Button
              size="sm"
              onClick={() => {
                if (chatInput.trim() && !chatMutation.isPending) {
                  setChatMessages(prev => [...prev, { role: 'user', content: chatInput.trim() }])
                  chatMutation.mutate(chatInput.trim())
                }
              }}
              disabled={!chatInput.trim() || chatMutation.isPending}
            >
              {t('crisis.sendMessage')}
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('crisis.timeline_label')}</h4>
            {canModify && s.status === 'active' && (
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddNote(true)}>
                {t('crisis.addNote')}
              </Button>
            )}
          </div>
          {timeline.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {timeline.map((entry: TimelineEntry, i: number) => {
                const evtColors: Record<string, string> = {
                  created: 'var(--color-success)', step_started: 'var(--color-warning)',
                  step_completed: 'var(--color-success)', step_skipped: 'var(--color-text-secondary)',
                  step_added: 'var(--color-accent)', step_deleted: 'var(--color-danger)',
                  asset_added: 'var(--color-accent)', note: 'var(--color-text-primary)',
                  ai_chat: 'var(--color-accent)', resolved: 'var(--color-success)',
                }
                return (
                  <div key={String(entry.id ?? i)} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                      background: evtColors[String(entry.event_type ?? '')] ?? 'var(--color-text-secondary)',
                    }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{String(entry.title ?? '')}</div>
                      {!!entry.description && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{String(entry.description)}</div>}
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{formatTimeAgo(String(entry.created_at))}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>—</p>
          )}
        </div>
      </div>

      {/* Resolve confirmation */}
      <Modal
        open={showResolveConfirm}
        onClose={() => setShowResolveConfirm(false)}
        title={t('crisis.resolveConfirm')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResolveConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { resolveMutation.mutate({ summary: '' }); setShowResolveConfirm(false) }}>
              {t('crisis.resolve')}
            </Button>
          </>
        }
      >
        <p>{t('crisis.resolveMessage')}</p>
      </Modal>

      {/* Add Asset */}
      <Modal
        open={showAddAsset}
        onClose={() => setShowAddAsset(false)}
        title={t('crisis.addAsset')}
        footer={<Button variant="secondary" onClick={() => setShowAddAsset(false)}>{t('common.close')}</Button>}
      >
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {(assetsList ?? []).filter((a: { id: number; hostname: string }) => !assets.some((as: SessionAsset) => Number(as.agent_id) === a.id)).map((a: { id: number; hostname: string }) => (
            <div key={a.id} style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
              onClick={() => { addAssetMutation.mutate({ agent_id: a.id, impact_level: 'affected' }); setShowAddAsset(false) }}>
              {a.hostname}
            </div>
          ))}
        </div>
      </Modal>

      {/* Add Note */}
      <Modal
        open={showAddNote}
        onClose={() => { setShowAddNote(false); setNoteText('') }}
        title={t('crisis.addNote')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowAddNote(false); setNoteText('') }}>{t('common.cancel')}</Button>
            <Button onClick={() => { addNoteMutation.mutate({ event_type: 'note', title: noteText.slice(0, 100) }); setShowAddNote(false); setNoteText('') }}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Input value={noteText} onChange={setNoteText} label={t('crisis.addNote')} />
      </Modal>

      {/* Add Step Modal */}
      <Modal
        open={showAddStep}
        onClose={() => { setShowAddStep(false); setNewStepForm({ title: '', description: '', action: '' }) }}
        title={t('crisis.addStep')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowAddStep(false); setNewStepForm({ title: '', description: '', action: '' }) }}>{t('common.cancel')}</Button>
            <Button onClick={() => addStepMutation.mutate(newStepForm as Record<string, unknown>)} disabled={!newStepForm.title.trim() || addStepMutation.isPending}>
              {addStepMutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input value={newStepForm.title} onChange={(v) => setNewStepForm(f => ({ ...f, title: v }))} label={t('crisis.stepTitle')} required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('crisis.stepAction')}</label>
            <textarea
              value={newStepForm.action}
              onChange={(e) => setNewStepForm(f => ({ ...f, action: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* Report */}
      <Modal
        open={showReport}
        onClose={() => setShowReport(false)}
        title={t('crisis.report')}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setShowReport(false)}>{t('common.close')}</Button>}
      >
        {report ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><strong>{t('crisis.crisisType')}:</strong> {t(`crisis.${(report as Record<string, unknown>).crisis_type ?? 'security'}`)}</div>
              <div><strong>{t('common.severity')}:</strong> {String((report as Record<string, unknown>).severity ?? '')}</div>
              <div><strong>{t('crisis.duration')}:</strong> {formatDuration((report as Record<string, unknown>).duration_seconds as number)}</div>
              <div><strong>{t('crisis.isTest')}:</strong> {(report as Record<string, unknown>).is_test ? '✓' : '—'}</div>
            </div>
            {!!(report as Record<string, unknown>).summary && <div><strong>{t('crisis.summary')}:</strong> {String((report as Record<string, unknown>).summary)}</div>}
            <h4 style={{ fontSize: '14px' }}>{t('crisis.steps_label')}</h4>
            {((report as Record<string, unknown>).steps as Array<Record<string, unknown>> ?? []).map((step, i) => (
              <div key={i} style={{ padding: '8px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                <strong>{String(step.step_number ?? i + 1)}. {String(step.title ?? '')}</strong>
                <Badge variant={step.status === 'completed' ? 'success' : step.status === 'skipped' ? 'default' : 'warning'} size="sm">
                  {String(step.status ?? 'pending')}
                </Badge>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{String(((report as Record<string, unknown>).statistics as Record<string, unknown>)?.total ?? 0)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('crisis.totalSteps')}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)' }}>{String(((report as Record<string, unknown>).statistics as Record<string, unknown>)?.completed ?? 0)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('crisis.completedSteps')}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{String(((report as Record<string, unknown>).statistics as Record<string, unknown>)?.skipped ?? 0)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('crisis.skippedSteps')}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{String(((report as Record<string, unknown>).statistics as Record<string, unknown>)?.in_progress ?? 0)}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('crisis.inProgressSteps')}</div>
              </div>
            </div>
          </div>
        ) : <div>{t('common.loading')}</div>}
      </Modal>
    </Modal>
  )
}

// ── Main Crisis Page ──
export function CrisisPage({ initialTab = 'crises' }: { initialTab?: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { canEdit, role } = usePermissions()
  const canModify = canEdit('compliance_officer')
  const canManagePlaybooks = role === 'admin' || role === 'rssi' || role === 'superadmin'

  const [activeTab, setActiveTab] = useState(initialTab)

  // Update tab when initialTab prop changes (e.g. navigating from sidebar)
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [showCreatePlaybook, setShowCreatePlaybook] = useState(false)
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)
  const [playbookEditMode, setPlaybookEditMode] = useState<'create' | 'edit'>('create')
  const [selectedPlaybookDetail, setSelectedPlaybookDetail] = useState<Playbook | null>(null)

  // Queries
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['crisis-sessions'],
    queryFn: () => crisisSessionsApi.listSessions().then(r => r.data),
  })

  const { data: archivedSessions, isLoading: archivedLoading } = useQuery({
    queryKey: ['crisis-sessions-archived'],
    queryFn: () => crisisSessionsApi.listSessions({ status: 'archived' }).then(r => r.data),
  })

  const { data: playbooks, isLoading: playbooksLoading } = useQuery({
    queryKey: ['crisis-playbooks'],
    queryFn: () => crisisSessionsApi.listPlaybooks().then(r => r.data),
  })

  const { data: assets } = useQuery({
    queryKey: ['assets-for-crisis-page'],
    queryFn: () => assetsApi.list().then(r => {
      const d = r.data as Record<string, unknown>
      const items = (Array.isArray(d) ? d : (d?.items ?? [])) as Array<Record<string, unknown>>
      return items.map((a) => ({ id: Number(a.id), hostname: String(a.hostname ?? `Agent #${a.id}`) }))
    }),
  })

  const deletePlaybookMutation = useMutation({
    mutationFn: (id: number) => crisisSessionsApi.deletePlaybook(id),
    onSuccess: (_data, id) => {
      toast('success', t('common.delete'))
      qc.invalidateQueries({ queryKey: ['crisis-playbooks'] })
      if (selectedPlaybookDetail && Number(selectedPlaybookDetail.id) === id) setSelectedPlaybookDetail(null)
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 403) {
        toast('error', t('crisis.permissionDenied'))
      } else {
        toast('error', t('common.error'))
      }
    },
  })

  const duplicatePlaybookMutation = useMutation({
    mutationFn: (id: number) => crisisSessionsApi.duplicatePlaybook(id),
    onSuccess: () => {
      toast('success', t('crisis.duplicate'))
      qc.invalidateQueries({ queryKey: ['crisis-playbooks'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 403) {
        toast('error', t('crisis.permissionDenied'))
      } else {
        toast('error', t('common.error'))
      }
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (sessionId: number) => crisisSessionsApi.restoreSession(sessionId),
    onSuccess: () => {
      toast('success', t('crisis.restoreSuccess'))
      qc.invalidateQueries({ queryKey: ['crisis-sessions'] })
      qc.invalidateQueries({ queryKey: ['crisis-sessions-archived'] })
    },
    onError: () => toast('error', t('crisis.restoreError')),
  })

  const allSessionList = (Array.isArray(sessions) ? sessions : ((sessions as Record<string, unknown>)?.items ?? [])) as Session[]
  const sessionList = allSessionList.filter((s) => s.status !== 'archived' && s.status !== 'resolved' && s.status !== 'closed')

  const archivedList = (Array.isArray(archivedSessions) ? archivedSessions : ((archivedSessions as Record<string, unknown>)?.items ?? [])) as Session[]
  const playbookList = (Array.isArray(playbooks) ? playbooks : ((playbooks as Record<string, unknown>)?.items ?? [])) as Playbook[]

  const activeCount = sessionList.filter((s) => s.status === 'active').length
  const resolvedCount = allSessionList.filter((s) => s.status === 'resolved' || s.status === 'closed').length
  const testCount = sessionList.filter((s) => s.is_test).length
  const archivedCount = archivedList.length

  // Auto-select first playbook for detail view
  useEffect(() => {
    if (!selectedPlaybookDetail && playbookList.length > 0) {
      setSelectedPlaybookDetail(playbookList[0])
    }
  }, [playbookList])

  const tabs = [
    { key: 'crises', label: `${t('crisis.activeCrises')} (${sessionList.length})` },
    { key: 'archives', label: `${t('crisis.archives')} (${archivedCount})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {activeTab === 'playbooks' ? t('crisis.playbooks') : t('crisis.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canModify && activeTab === 'crises' && (
            <Button icon={<Plus size={16} />} onClick={() => setShowCreateSession(true)}>
              {t('crisis.newCrisis')}
            </Button>
          )}
          {canManagePlaybooks && activeTab === 'playbooks' && (
            <Button icon={<Plus size={16} />} onClick={() => { setPlaybookEditMode('create'); setSelectedPlaybook(null); setShowCreatePlaybook(true) }}>
              {t('crisis.newPlaybook')}
            </Button>
          )}
        </div>
      </div>

      {activeTab !== 'playbooks' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <StatCard label={t('crisis.activeCrises')} value={activeCount} icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />} loading={sessionsLoading} />
            <StatCard label={t('crisis.resolved')} value={resolvedCount} icon={<Shield size={20} style={{ color: 'var(--color-success)' }} />} loading={sessionsLoading} />
            <StatCard label={t('crisis.archives')} value={archivedCount} icon={<BookOpen size={20} style={{ color: 'var(--color-text-secondary)' }} />} loading={archivedLoading} />
            <StatCard label={t('crisis.isTest')} value={testCount} icon={<TestTube size={20} style={{ color: 'var(--color-warning)' }} />} loading={sessionsLoading} />
          </div>

          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </>
      )}

      {/* ── Crises Tab ── */}
      {activeTab === 'crises' && (
        sessionList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessionList.map((session: Session, i: number) => (
              <Card key={String(session.id ?? i)} onClick={() => setSelectedSessionId(Number(session.id))} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{String(session.title ?? session.summary ?? session.scenario ?? '—')}</span>
                      <Badge variant={statusVariant(String(session.status ?? ''))} size="sm">{String(session.status ?? '')}</Badge>
                      <Badge variant={severityVariant(String(session.severity ?? ''))} size="sm">{t(`common.criticalityLabels.${session.severity ?? 'low'}`)}</Badge>
                      {!!session.is_test && <Badge variant="warning" size="sm"><TestTube size={12} /> {t('crisis.isTest')}</Badge>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {t(`crisis.${session.crisis_type ?? 'security'}`)} · {formatTimeAgo(String(session.activated_at ?? session.created_at))}
                      {String(session.step_progress ?? "") && ` · ${String(session.step_progress ?? "")} ${t('crisis.steps_label')}`}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !sessionsLoading && <EmptyState icon={<AlertTriangle size={32} />} title={t('crisis.noCrises')} />
      )}

      {/* ── Archives Tab ── */}
      {activeTab === 'archives' && (
        archivedList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {archivedList.map((session: Session, i: number) => (
              <Card key={String(session.id ?? i)} style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{String(session.title ?? session.summary ?? session.scenario ?? '—')}</span>
                      <Badge variant="default" size="sm">{t('crisis.archives')}</Badge>
                      <Badge variant={severityVariant(String(session.severity ?? ''))} size="sm">{t(`common.criticalityLabels.${session.severity ?? 'low'}`)}</Badge>
                      {!!session.is_test && <Badge variant="warning" size="sm"><TestTube size={12} /> {t('crisis.isTest')}</Badge>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {t(`crisis.${session.crisis_type ?? 'security'}`)} · {t('crisis.resolved')}: {session.resolved_at ? new Date(String(session.resolved_at)).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedSessionId(Number(session.id))}>
                      <Eye size={14} style={{ marginRight: '4px' }} /> {t('crisis.viewReport')}
                    </Button>
                    <Button size="sm" onClick={() => restoreMutation.mutate(Number(session.id))} disabled={restoreMutation.isPending}>
                      {t('crisis.restoreCrisis')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !archivedLoading && <EmptyState icon={<BookOpen size={32} />} title={t('crisis.archives')} description={t('crisis.noCrises')} />
      )}

      {/* ── Playbooks Tab ── */}
      {activeTab === 'playbooks' && (
        playbookList.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px', minHeight: '400px' }}>
            {/* Sidebar: playbook list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
              {playbookList.map((pb: Playbook, i: number) => (
                <div
                  key={String(pb.id ?? i)}
                  onClick={() => setSelectedPlaybookDetail(pb)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: selectedPlaybookDetail?.id === pb.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: selectedPlaybookDetail?.id === pb.id ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {String(pb.name ?? '')}
                    </span>
                    {!!pb.is_template && (
                      <span style={{ fontSize: '11px', background: 'var(--color-accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                        {t('crisis.template')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span>{t(`crisis.${pb.crisis_type ?? 'security'}`)}</span>
                    <span>·</span>
                    <span>{String(pb.step_count ?? (pb.playbook_steps as Array<unknown>)?.length ?? 0)} {t('crisis.steps')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', background: 'var(--color-bg-primary)' }}>
              {selectedPlaybookDetail ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                        {String(selectedPlaybookDetail.name ?? '')}
                        {!!selectedPlaybookDetail.is_template && (
                          <span style={{ fontSize: '12px', background: 'var(--color-accent)', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>
                            {t('crisis.template')}
                          </span>
                        )}
                      </h3>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {String(selectedPlaybookDetail.description ?? '')}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <Badge variant={severityVariant(String(selectedPlaybookDetail.severity ?? 'high'))} size="sm">
                          {t(`common.criticalityLabels.${selectedPlaybookDetail.severity ?? 'high'}`)}
                        </Badge>
                        <Badge variant="default" size="sm">{t(`crisis.${selectedPlaybookDetail.crisis_type ?? 'security'}`)}</Badge>
                      </div>
                    </div>
                    {canManagePlaybooks && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { setPlaybookEditMode('edit'); setSelectedPlaybook(selectedPlaybookDetail); setShowCreatePlaybook(true) }}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          <Edit3 size={14} /> {t('common.edit')}
                        </button>
                        <button onClick={() => duplicatePlaybookMutation.mutate(Number(selectedPlaybookDetail.id))}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          <Copy size={14} /> {t('crisis.duplicate')}
                        </button>
                        <button onClick={() => { if (confirm(t('common.delete'))) deletePlaybookMutation.mutate(Number(selectedPlaybookDetail.id)) }}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-danger)' }}>
                          <Trash2 size={14} /> {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>

                  {!canManagePlaybooks && (
                    <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {t('crisis.permissionDenied')}
                    </div>
                  )}

                  {/* Steps */}
                  <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                    {t('crisis.playbookContent')} ({String(selectedPlaybookDetail.step_count ?? (selectedPlaybookDetail.playbook_steps as Array<unknown>)?.length ?? 0)} {t('crisis.steps')})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {((selectedPlaybookDetail.playbook_steps as Array<Record<string, unknown>>) ?? []).map((step, i) => (
                      <div key={String(step.id ?? i)} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {String(step.step_number ?? i + 1)}. {String(step.title ?? '')}
                          </span>
                          {String(step.responsible_role ?? '') && (
                            <Badge variant="default" size="sm">👤 {String(step.responsible_role)}</Badge>
                          )}
                        </div>
                        {!!step.description && <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{String(step.description)}</div>}
                        {!!step.action && <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>→ {String(step.action)}</div>}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {!!step.validation_criteria && <span>✓ {String(step.validation_criteria)}</span>}
                          {!!step.escalation && <span>⚠ {String(step.escalation)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                  {t('crisis.selectPlaybook')}
                </div>
              )}
            </div>
          </div>
        ) : !playbooksLoading && (
          <div>
            <EmptyState icon={<BookOpen size={32} />} title={t('crisis.noPlaybooks')} />
            {!canManagePlaybooks && (
              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('crisis.permissionDenied')}
              </div>
            )}
          </div>
        )
      )}

      {/* Modals */}
      <CreateSessionModal
        open={showCreateSession}
        onClose={() => setShowCreateSession(false)}
        playbooks={playbookList}
        assets={assets ?? []}
      />

      <PlaybookModal
        open={showCreatePlaybook}
        onClose={() => setShowCreatePlaybook(false)}
        playbook={selectedPlaybook}
        mode={playbookEditMode}
      />

      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  )
}