import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Badge, StatCard, Select, Table, Button, Modal, Input } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { GraduationCap, Plus, Users, CheckCircle } from 'lucide-react'

function trainingTypeBadge(type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (type) {
    case 'mandatory': return 'danger'
    case 'awareness': return 'info'
    case 'technical': return 'success'
    case 'compliance': return 'warning'
    default: return 'default'
  }
}

function trainingStatusBadge(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'completed': return 'success'
    case 'scheduled': return 'info'
    case 'in_progress': return 'warning'
    case 'cancelled': return 'danger'
    default: return 'default'
  }
}

export function Trainings() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState('awareness')
  const [formAudience, setFormAudience] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formTrainer, setFormTrainer] = useState('')
  const [formDate, setFormDate] = useState('')

  const params: Record<string, string> = {}
  if (typeFilter) params.type = typeFilter
  if (statusFilter) params.status = statusFilter
  if (audienceFilter) params.audience = audienceFilter

  const { data: trainings, isLoading } = useQuery({
    queryKey: ['governance', 'trainings', params],
    queryFn: () => governanceApi.trainings(params).then((r) => r.data),
  })

  const { data: trainingDetail } = useQuery({
    queryKey: ['governance', 'training', selectedId],
    queryFn: () => governanceApi.getPolicy(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const { data: attendance } = useQuery({
    queryKey: ['governance', 'training', selectedId, 'attendance'],
    queryFn: () => governanceApi.trainingAttendance(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createTraining(data),
    onSuccess: () => {
      toast('success', t('governance.trainings.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'trainings'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.trainings.createError')),
  })

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormType('awareness')
    setFormAudience('')
    setFormDuration('')
    setFormTrainer('')
    setFormDate('')
  }

  const items = (Array.isArray(trainings) ? trainings : (trainings as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const total = items.length
  const attendanceRate = items.length > 0 ? Math.round(items.reduce((sum, i) => sum + Number(i.attendance_rate ?? 0), 0) / items.length) : 0
  const successRate = items.length > 0 ? Math.round(items.reduce((sum, i) => sum + Number(i.success_rate ?? 0), 0) / items.length) : 0

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.trainings.mandatory'), value: 'mandatory' },
    { label: t('governance.trainings.awareness'), value: 'awareness' },
    { label: t('governance.trainings.technical'), value: 'technical' },
    { label: t('governance.trainings.compliance'), value: 'compliance' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.trainings.scheduled'), value: 'scheduled' },
    { label: t('governance.trainings.inProgress'), value: 'in_progress' },
    { label: t('governance.trainings.completed'), value: 'completed' },
    { label: t('governance.trainings.cancelled'), value: 'cancelled' },
  ]

  const audienceOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.trainings.allEmployees'), value: 'all' },
    { label: t('governance.trainings.itStaff'), value: 'it' },
    { label: t('governance.trainings.management'), value: 'management' },
    { label: t('governance.trainings.newHires'), value: 'new_hires' },
  ]

  const columns = [
    { key: 'title', label: t('governance.trainings.title_field') },
    { key: 'type', label: t('common.type'), width: '120px' },
    { key: 'audience', label: t('governance.trainings.audience'), width: '120px' },
    { key: 'date', label: t('common.date'), width: '120px' },
    { key: 'status', label: t('common.status'), width: '120px' },
    { key: 'attendance_rate', label: t('governance.trainings.attendance'), width: '100px' },
  ]

  const detail = trainingDetail as Record<string, unknown> | null
  const attendanceList = (Array.isArray(attendance) ? attendance : []) as Record<string, unknown>[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.trainings.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.trainings.createTraining')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <StatCard label={t('common.total')} value={total} icon={<GraduationCap size={18} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label={t('governance.trainings.attendanceRate')} value={`${attendanceRate}%`} icon={<Users size={18} />} color="var(--color-info)" loading={isLoading} />
        <StatCard label={t('governance.trainings.successRate')} value={`${successRate}%`} icon={<CheckCircle size={18} />} color="var(--color-success)" loading={isLoading} />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} label={t('common.type')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('common.status')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={audienceFilter} onChange={setAudienceFilter} options={audienceOptions} label={t('governance.trainings.audience')} />
        </div>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.trainings.noTrainings')}
        renderCell={(col, row) => {
          if (col.key === 'type') {
            return <Badge variant={trainingTypeBadge(String(row.type))}>{String(row.type)}</Badge>
          }
          if (col.key === 'status') {
            return <Badge variant={trainingStatusBadge(String(row.status))}>{String(row.status)}</Badge>
          }
          if (col.key === 'attendance_rate') {
            const rate = Number(row.attendance_rate ?? 0)
            return `${rate}%`
          }
          if (col.key === 'title') {
            return (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: 0, font: 'inherit', textAlign: 'left' }}
                onClick={() => setSelectedId(Number(row.id))}
              >
                {String(row.title)}
              </button>
            )
          }
          return String(row[col.key] ?? "")
        }}
      />

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.trainings.createTraining')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('governance.trainings.title_field')} value={formTitle} onChange={setFormTitle} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('common.description')}</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Select label={t('common.type')} value={formType} onChange={setFormType} options={typeOptions.slice(1)} />
            <Select label={t('governance.trainings.audience')} value={formAudience} onChange={setFormAudience} options={audienceOptions.slice(1)} />
            <Input label={t('governance.trainings.duration')} value={formDuration} onChange={setFormDuration} />
            <Input label={t('governance.trainings.trainer')} value={formTrainer} onChange={setFormTrainer} />
            <Input label={t('common.date')} value={formDate} onChange={setFormDate} type="date" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ title: formTitle, description: formDescription, type: formType, audience: formAudience, duration: formDuration, trainer: formTrainer, date: formDate })} disabled={!formTitle}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={String(detail.title ?? "")} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Badge variant={trainingTypeBadge(String(detail.type))}>{String(detail.type)}</Badge>
              <Badge variant={trainingStatusBadge(String(detail.status))}>{String(detail.status)}</Badge>
            </div>
            {String(detail.description ?? "") && <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.description)}</p>}
            {attendanceList.length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.trainings.attendanceList')}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{t('common.name')}</th>
                      <th style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{t('governance.trainings.quizResult')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceList.map((att, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(att.name ?? "")}</td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(att.quiz_score ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}