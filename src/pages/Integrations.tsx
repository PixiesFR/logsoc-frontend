import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, Badge, Button, Input, Select, Modal, Table, Tabs, EmptyState } from '../components/ui'
import { integrationsApi } from '../api'
import { Zap } from 'lucide-react'

type IntegrationItem = Record<string, unknown>

export function IntegrationsPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('webhooks')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<IntegrationItem | null>(null)

  // Webhook form
  const [formUrl, setFormUrl] = useState('')
  const [formEvents, setFormEvents] = useState('')
  const [formFormat, setFormFormat] = useState('json')

  const tabKeys = ['webhooks', 'siem', 'itsm', 'notifications']
  const tabLabels: Record<string, string> = {
    webhooks: t('integrations.webhooks'),
    siem: t('integrations.siem'),
    itsm: t('integrations.itsm'),
    notifications: t('integrations.notifications'),
  }

  const apiCall = activeTab === 'webhooks' ? integrationsApi.webhooks
    : activeTab === 'siem' ? integrationsApi.siem
    : activeTab === 'itsm' ? integrationsApi.itsm
    : integrationsApi.notifications

  const { data: items, isLoading } = useQuery({
    queryKey: ['integrations', activeTab],
    queryFn: () => apiCall.list().then((r) => r.data as IntegrationItem[]),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiCall.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations', activeTab] }); setShowCreate(false); resetForm(); toast('success', t('integrations.createSuccess')) },
    onError: () => toast('error', t('integrations.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiCall.update(Number(editItem!.id), data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations', activeTab] }); setEditItem(null); toast('success', t('integrations.updateSuccess')) },
    onError: () => toast('error', t('integrations.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiCall.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations', activeTab] }); toast('success', t('integrations.deleteSuccess')) },
    onError: () => toast('error', t('integrations.deleteError')),
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => (apiCall as typeof integrationsApi.webhooks).test(id),
    onSuccess: () => toast('success', t('integrations.testSuccess')),
    onError: () => toast('error', t('integrations.testError')),
  })

  function resetForm() {
    setFormUrl(''); setFormEvents(''); setFormFormat('json')
  }

  const healthVariant = (h: string): 'success' | 'danger' | 'default' => {
    if (h === 'ok' || h === 'healthy') return 'success'
    if (h === 'error' || h === 'unhealthy') return 'danger'
    return 'default'
  }

  const columns = activeTab === 'webhooks'
    ? [
        { key: 'url', label: 'URL' },
        { key: 'events', label: t('integrations.events') },
        { key: 'format', label: t('integrations.format') },
        { key: 'status', label: t('common.status') },
      ]
    : activeTab === 'siem'
    ? [
        { key: 'name', label: t('common.name') },
        { key: 'type', label: t('common.type') },
        { key: 'url', label: 'URL' },
        { key: 'status', label: t('common.status') },
      ]
    : activeTab === 'itsm'
    ? [
        { key: 'name', label: t('common.name') },
        { key: 'type', label: t('common.type') },
        { key: 'url', label: 'URL' },
        { key: 'status', label: t('common.status') },
      ]
    : [
        { key: 'name', label: t('common.name') },
        { key: 'type', label: t('common.type') },
        { key: 'status', label: t('common.status') },
      ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('integrations.title')}</h1>
        {canEdit('admin') && <Button onClick={() => setShowCreate(true)}>{t('common.create')}</Button>}
      </div>

      <Tabs tabs={tabKeys.map((k) => ({ key: k, label: tabLabels[k] }))} active={activeTab} onChange={setActiveTab} />

      <Card>
        {(items ?? []).length === 0 && !isLoading ? (
          <EmptyState title={t('integrations.noIntegrations')} />
        ) : (
          <Table
            columns={columns}
            data={(items ?? []) as IntegrationItem[]}
            loading={isLoading}
            renderCell={(col, row) => {
              if (col.key === 'status' || col.key === 'health') return <Badge variant={healthVariant(String(row[col.key] ?? row.health ?? ''))}>{String(row[col.key] ?? row.health ?? '')}</Badge>
              if (col.key === 'events') return String(row[col.key] ?? '')
              return String(row[col.key] ?? '')
            }}
          />
        )}

        {(items ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {(items ?? []).map((item) => (
              <div key={String(item.id)} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {(activeTab === 'webhooks' || activeTab === 'notifications') && (
                  <Button size="sm" variant="secondary" icon={<Zap size={12} />} onClick={() => testMutation.mutate(Number(item.id))}>{t('integrations.test')}</Button>
                )}
                {canEdit('admin') && <Button size="sm" variant="secondary" onClick={() => setEditItem(item)}>{t('common.edit')}</Button>}
                {canEdit('admin') && <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(Number(item.id))}>{t('common.delete')}</Button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCreate && canEdit('admin') && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('integrations.createIntegration')} footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ url: formUrl, events: formEvents, format: formFormat })}>{t('common.create')}</Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label="URL" value={formUrl} onChange={setFormUrl} required />
            <Input label={t('integrations.events')} value={formEvents} onChange={setFormEvents} />
            <Select label={t('integrations.format')} value={formFormat} onChange={setFormFormat} options={[{ label: 'JSON', value: 'json' }, { label: 'XML', value: 'xml' }]} />
          </div>
        </Modal>
      )}

      {editItem && canEdit('admin') && (
        <Modal open={!!editItem} onClose={() => setEditItem(null)} title={t('integrations.editIntegration')} footer={
          <>
            <Button variant="secondary" onClick={() => setEditItem(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate({ url: formUrl || String(editItem.url ?? ''), events: formEvents || String(editItem.events ?? ''), format: formFormat || String(editItem.format ?? 'json') })}>{t('common.save')}</Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label="URL" value={formUrl || String(editItem.url ?? '')} onChange={setFormUrl} />
            <Input label={t('integrations.events')} value={formEvents || String(editItem.events ?? '')} onChange={setFormEvents} />
          </div>
        </Modal>
      )}
    </div>
  )
}