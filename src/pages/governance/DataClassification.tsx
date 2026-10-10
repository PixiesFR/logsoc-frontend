import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Badge, Select, Table, Button, Modal, Input, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { Lock, Plus } from 'lucide-react'

function levelBadge(level: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (level) {
    case 'public': return 'success'
    case 'internal': return 'info'
    case 'confidential': return 'warning'
    case 'secret': return 'danger'
    default: return 'default'
  }
}

export function DataClassification() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [levelFilter, setLevelFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formLevel, setFormLevel] = useState('internal')
  const [formDescription, setFormDescription] = useState('')
  const [formOwner, setFormOwner] = useState('')
  const [formRetention, setFormRetention] = useState('')

  const params: Record<string, string> = {}
  if (levelFilter) params.level = levelFilter

  const { data: classifications, isLoading } = useQuery({
    queryKey: ['governance', 'data-classification', params],
    queryFn: () => governanceApi.dataClassification(params).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createDataClassification(data),
    onSuccess: () => {
      toast('success', t('governance.dataClassification.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'data-classification'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.dataClassification.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deleteDataClassification(id),
    onSuccess: () => {
      toast('success', t('governance.dataClassification.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'data-classification'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.dataClassification.deleteError')),
  })

  function resetForm() {
    setFormName('')
    setFormLevel('internal')
    setFormDescription('')
    setFormOwner('')
    setFormRetention('')
  }

  const items = (Array.isArray(classifications) ? classifications : (classifications as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const levelOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.dataClassification.public'), value: 'public' },
    { label: t('governance.dataClassification.internal'), value: 'internal' },
    { label: t('governance.dataClassification.confidential'), value: 'confidential' },
    { label: t('governance.dataClassification.secret'), value: 'secret' },
  ]

  const columns = [
    { key: 'name', label: t('common.name') },
    { key: 'level', label: t('governance.dataClassification.level'), width: '130px' },
    { key: 'description', label: t('common.description') },
    { key: 'owner', label: t('common.owner'), width: '120px' },
    { key: 'retention', label: t('governance.dataClassification.retention'), width: '120px' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.dataClassification.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.dataClassification.createClassification')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={levelFilter} onChange={setLevelFilter} options={levelOptions} label={t('governance.dataClassification.level')} />
        </div>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.dataClassification.noClassifications')}
        renderCell={(col, row) => {
          if (col.key === 'level') {
            return <Badge variant={levelBadge(String(row.level))}>{String(row.level)}</Badge>
          }
          return String(row[col.key] ?? '')
        }}
      />

      {/* Matrix View */}
      {items.length > 0 && (
        <div style={{ borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              <Lock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {t('governance.dataClassification.matrix')}
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                    {t('governance.dataClassification.dataType')}
                  </th>
                  {['public', 'internal', 'confidential', 'secret'].map((lvl) => (
                    <th key={lvl} style={{ padding: '10px 16px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                      <Badge variant={levelBadge(lvl)} size="sm">{lvl}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(item.name)}</td>
                    {['public', 'internal', 'confidential', 'secret'].map((lvl) => {
                      const measures = (item.measures as Record<string, string> | undefined)
                      const val = measures?.[lvl]
                      return (
                        <td key={lvl} style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                          {val ? '✓' : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.dataClassification.createClassification')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('common.name')} value={formName} onChange={setFormName} required />
            <Select label={t('governance.dataClassification.level')} value={formLevel} onChange={setFormLevel} options={levelOptions.slice(1)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('common.description')}</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Input label={t('common.owner')} value={formOwner} onChange={setFormOwner} />
            <Input label={t('governance.dataClassification.retention')} value={formRetention} onChange={setFormRetention} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ name: formName, level: formLevel, description: formDescription, owner: formOwner, retention: formRetention })} disabled={!formName}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={t('governance.dataClassification.deleteConfirmTitle')}
        message={t('governance.dataClassification.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}