import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Select, Table, Button, Modal, Input, Card, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { Plus, AlertTriangle } from 'lucide-react'

const RACI_COLORS: Record<string, string> = {
  R: 'var(--color-danger)',
  A: 'var(--color-warning)',
  C: '#eab308',
  I: 'var(--color-text-secondary)',
}

const RACI_BG: Record<string, string> = {
  R: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
  A: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
  C: 'color-mix(in srgb, #eab308 15%, transparent)',
  I: 'color-mix(in srgb, var(--color-text-secondary) 10%, transparent)',
}

export function Raci() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [processFilter, setProcessFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formProcess, setFormProcess] = useState('')
  const [formActivities, setFormActivities] = useState('')
  const [formRoles, setFormRoles] = useState('')

  const params: Record<string, string> = {}
  if (processFilter) params.process = processFilter
  if (departmentFilter) params.department = departmentFilter

  const { data: raciData, isLoading } = useQuery({
    queryKey: ['governance', 'raci', params],
    queryFn: () => governanceApi.raci(params).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createRaci(data),
    onSuccess: () => {
      toast('success', t('governance.raci.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'raci'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.raci.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deleteRaci(id),
    onSuccess: () => {
      toast('success', t('governance.raci.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'raci'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.raci.deleteError')),
  })

  function resetForm() {
    setFormProcess('')
    setFormActivities('')
    setFormRoles('')
  }

  const items = (Array.isArray(raciData) ? raciData : (raciData as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const processes = useMemo(() => [...new Set(items.map((i) => String(i.process)))], [items])
  const departments = useMemo(() => [...new Set(items.map((i) => String(i.department)))], [items])

  const processOptions = [
    { label: t('common.all'), value: '' },
    ...processes.map((p) => ({ label: p, value: p })),
  ]
  const departmentOptions = [
    { label: t('common.all'), value: '' },
    ...departments.map((d) => ({ label: d, value: d })),
  ]

  // Anomaly detection
  const anomalies = useMemo(() => {
    const warnings: string[] = []
    const activityMap = new Map<string, Map<string, string>>()
    for (const item of items) {
      const proc = String(item.process)
      if (!activityMap.has(proc)) activityMap.set(proc, new Map())
      // Build per-activity role map
    }
    // Check for activities without R and multiple A
    const activityRaciMap = new Map<string, { r: number; a: number }>()
    for (const item of items) {
      const key = `${item.process}::${item.activity}`
      const val = String(item.raci_value ?? item.value ?? '').toUpperCase()
      if (!activityRaciMap.has(key)) activityRaciMap.set(key, { r: 0, a: 0 })
      const counts = activityRaciMap.get(key)!
      if (val === 'R') counts.r++
      if (val === 'A') counts.a++
    }
    for (const [key, counts] of activityRaciMap) {
      if (counts.r === 0) warnings.push(`${t('governance.raci.noR')}: ${key.split('::')[1]}`)
      if (counts.a > 1) warnings.push(`${t('governance.raci.multipleA')}: ${key.split('::')[1]}`)
    }
    return warnings
  }, [items, t])

  const columns = [
    { key: 'process', label: t('governance.raci.process') },
    { key: 'activity', label: t('governance.raci.activity') },
    { key: 'role', label: t('governance.raci.role'), width: '140px' },
    { key: 'raci_value', label: 'RACI', width: '80px' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.raci.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.raci.createRaci')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={processFilter} onChange={setProcessFilter} options={processOptions} label={t('governance.raci.process')} />
        </div>
        <div style={{ minWidth: '180px' }}>
          <Select value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} label={t('governance.raci.department')} />
        </div>
      </div>

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('governance.raci.anomalies')}</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {anomalies.map((a, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--color-warning)', marginBottom: '4px' }}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.raci.noRaci')}
        renderCell={(col, row) => {
          if (col.key === 'raci_value') {
            const val = String(row.raci_value ?? row.value ?? '').toUpperCase()
            return (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '24px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 700,
                color: RACI_COLORS[val] ?? 'var(--color-text-secondary)',
                background: RACI_BG[val] ?? 'transparent',
              }}>
                {val}
              </span>
            )
          }
          return String(row[col.key] ?? '')
        }}
      />

      {/* Color Legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {['R', 'A', 'C', 'I'].map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '20px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              color: RACI_COLORS[key],
              background: RACI_BG[key],
            }}>
              {key}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {t(`governance.raci.${key === 'R' ? 'responsible' : key === 'A' ? 'accountable' : key === 'C' ? 'consulted' : 'informed'}`)}
            </span>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.raci.createRaci')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('governance.raci.process')} value={formProcess} onChange={setFormProcess} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.raci.activities')}</label>
              <textarea
                value={formActivities}
                onChange={(e) => setFormActivities(e.target.value)}
                rows={4}
                placeholder={t('governance.raci.activitiesPlaceholder')}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Input label={t('governance.raci.role')} value={formRoles} onChange={setFormRoles} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ process: formProcess, activities: formActivities, roles: formRoles })} disabled={!formProcess}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={t('governance.raci.deleteConfirmTitle')}
        message={t('governance.raci.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}