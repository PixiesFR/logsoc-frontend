import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { correlationApi } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Card, Badge, StatCard, Button, Modal, Input, Select, EmptyState, Table, ConfirmDialog, useToast } from '../components/ui'
import { FileCode, Play, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

interface CustomRule {
  id: string
  name: string
  description: string
  severity: string
  conditions: string
  active: boolean
  dry_run?: boolean
}

const severityVariant = (sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'default'
    default: return 'default'
  }
}

export function CustomRulesPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [dryRunTarget, setDryRunTarget] = useState<string | null>(null)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSeverity, setNewSeverity] = useState('medium')
  const [newConditions, setNewConditions] = useState('')
  const [newDryRun, setNewDryRun] = useState(false)

  // Queries — ensure data is always an array even if API returns object/null
  const { data: rawCustomRules, isLoading: rulesLoading } = useQuery<CustomRule[]>({
    queryKey: ['correlation', 'customRules'],
    queryFn: () => correlationApi.listCustomRules().then((r) => r.data),
  })
  const customRules = Array.isArray(rawCustomRules) ? rawCustomRules : []

  const activeCount = customRules.filter((r) => r.active).length
  const inactiveCount = customRules.length - activeCount

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => correlationApi.createCustomRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('customRules.createSuccess'))
      setShowCreateModal(false)
      setNewName('')
      setNewDescription('')
      setNewSeverity('medium')
      setNewConditions('')
      setNewDryRun(false)
    },
    onError: () => {
      toast('error', t('customRules.createError'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => correlationApi.updateCustomRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('customRules.updateSuccess'))
      setDryRunTarget(null)
    },
    onError: () => {
      toast('error', t('customRules.updateError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => correlationApi.deleteCustomRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('customRules.deleteSuccess'))
      setDeleteTarget(null)
    },
    onError: () => {
      toast('error', t('customRules.deleteError'))
    },
  })

  const handleCreate = useCallback(() => {
    if (!newName.trim() || !newConditions.trim()) return
    createMutation.mutate({
      name: newName,
      description: newDescription,
      severity: newSeverity,
      conditions: newConditions,
      active: true,
      dry_run: newDryRun,
    })
  }, [newName, newDescription, newSeverity, newConditions, newDryRun, createMutation])

  const handleToggle = useCallback((rule: CustomRule) => {
    updateMutation.mutate({ id: rule.id, data: { active: !rule.active } })
  }, [updateMutation])

  const handleDryRun = useCallback(() => {
    if (!dryRunTarget) return
    updateMutation.mutate({ id: dryRunTarget, data: { dry_run: true } })
  }, [dryRunTarget, updateMutation])

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget)
  }, [deleteTarget, deleteMutation])

  const severityOptions = [
    { label: t('customRules.severityLabels.critical'), value: 'critical' },
    { label: t('customRules.severityLabels.high'), value: 'high' },
    { label: t('customRules.severityLabels.medium'), value: 'medium' },
    { label: t('customRules.severityLabels.low'), value: 'low' },
  ]

  const columns = [
    { key: 'name', label: t('common.name') },
    { key: 'description', label: t('common.description') },
    { key: 'severity', label: t('common.severity') },
    { key: 'active', label: t('common.status') },
    { key: 'actions', label: t('common.actions') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('customRules.title')}
        </h1>
        {canEdit('analyst') && (
          <Button variant="primary" size="sm" icon={<FileCode size={16} />} onClick={() => setShowCreateModal(true)}>
            {t('customRules.createRule')}
          </Button>
        )}
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <StatCard
          label={t('customRules.totalRules')}
          value={customRules.length}
          icon={<FileCode size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={rulesLoading}
        />
        <StatCard
          label={t('common.active')}
          value={activeCount}
          icon={<ToggleRight size={20} style={{ color: 'var(--color-success)' }} />}
          loading={rulesLoading}
        />
        <StatCard
          label={t('common.inactive')}
          value={inactiveCount}
          icon={<ToggleLeft size={20} style={{ color: 'var(--color-text-secondary)' }} />}
          loading={rulesLoading}
        />
      </div>

      {/* Rules table */}
      <Card>
        {rulesLoading ? (
          <Table columns={columns} data={[]} loading />
        ) : customRules.length > 0 ? (
          <Table
            columns={columns}
            data={customRules as unknown as Record<string, unknown>[]}
            renderCell={(col, row) => {
              const rule = row as unknown as CustomRule
              if (col.key === 'severity') {
                return <Badge variant={severityVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
              }
              if (col.key === 'active') {
                const isActive = row[col.key] === true || row[col.key] === 'true'
                return <Badge variant={isActive ? 'success' : 'default'}>{isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
              if (col.key === 'actions') {
                return (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {canEdit('analyst') && (
                      <>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '4px', display: 'flex' }}
                          onClick={() => handleToggle(rule)}
                          title={rule.active ? t('customRules.deactivate') : t('customRules.activate')}
                        >
                          {rule.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', padding: '4px', display: 'flex' }}
                          onClick={() => setDryRunTarget(rule.id)}
                          title={t('customRules.dryRun')}
                        >
                          <Play size={16} />
                        </button>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px', display: 'flex' }}
                          onClick={() => setDeleteTarget(rule.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                )
              }
              return String(row[col.key] ?? '')
            }}
          />
        ) : (
          <EmptyState icon={<FileCode size={32} />} title={t('customRules.noRules')} />
        )}
      </Card>

      {/* Create rule modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('customRules.createRule')}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim() || !newConditions.trim() || createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label={t('common.name')} value={newName} onChange={setNewName} required />
          <Input label={t('common.description')} value={newDescription} onChange={setNewDescription} />
          <Select label={t('common.severity')} value={newSeverity} onChange={setNewSeverity} options={severityOptions} />
          <Input label={t('customRules.conditionsYaml')} value={newConditions} onChange={setNewConditions} required />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newDryRun}
              onChange={(e) => setNewDryRun(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            {t('customRules.dryRun')}
          </label>
        </div>
      </Modal>

      {/* Dry-run confirm */}
      <ConfirmDialog
        open={dryRunTarget !== null}
        title={t('customRules.dryRun')}
        message={t('customRules.dryRunConfirm')}
        confirmLabel={t('customRules.dryRun')}
        onConfirm={handleDryRun}
        onCancel={() => setDryRunTarget(null)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('customRules.deleteRule')}
        message={t('customRules.deleteRuleConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}