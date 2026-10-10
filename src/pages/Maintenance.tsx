import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Input, Modal, Tabs, Table, EmptyState } from '../components/ui'
import { infrastructureApi } from '../api'
import { HardDrive, Activity, Cpu } from 'lucide-react'

interface RetentionPolicy {
  id: number
  name: string
  data_domain: string
  hot_days: number
  anonymize_after_days: number | null
  erase_after_days: number | null
  auto_purge: boolean
  is_active: boolean
  [key: string]: unknown
}

interface DockerContainer {
  name: string
  status: string
  [key: string]: unknown
}

interface MariaDBTable {
  table_name: string
  row_count: number
  [key: string]: unknown
}

interface DiskInfo {
  total: number
  used: number
  free: number
  percent: number
  [key: string]: unknown
}

interface HealthData {
  docker_containers?: DockerContainer[]
  disk_usage?: DiskInfo
  mariadb_tables?: MariaDBTable[]
  [key: string]: unknown
}

function normalizeList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'items' in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>).items as unknown[]
  }
  if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
    const inner = (data as Record<string, unknown>).data
    if (Array.isArray(inner)) return inner
  }
  return []
}

export function MaintenancePage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('retention')
  const [editRetention, setEditRetention] = useState<RetentionPolicy | null>(null)
  const [editHotDays, setEditHotDays] = useState('')
  const [editAnonymizeDays, setEditAnonymizeDays] = useState('')
  const [editEraseDays, setEditEraseDays] = useState('')
  const [editAutoPurge, setEditAutoPurge] = useState(false)
  const [showCreateBackup, setShowCreateBackup] = useState(false)

  const { data: retentionPolicies, isLoading: retentionLoading } = useQuery({
    queryKey: ['infrastructure', 'retention'],
    queryFn: () => infrastructureApi.retention.list().then((r) => normalizeList(r.data)),
  })

  const { data: backups, isLoading: backupsLoading } = useQuery({
    queryKey: ['infrastructure', 'backups'],
    queryFn: () => infrastructureApi.backups.list().then((r) => normalizeList(r.data)),
  })

  const { data: health } = useQuery({
    queryKey: ['infrastructure', 'health'],
    queryFn: () => infrastructureApi.health().then((r) => r.data as HealthData),
  })

  const updateRetentionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => infrastructureApi.retention.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['infrastructure', 'retention'] }); setEditRetention(null); toast('success', t('maintenance.retentionUpdateSuccess')) },
    onError: () => toast('error', t('maintenance.retentionUpdateError')),
  })

  const createBackupMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.backups.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['infrastructure', 'backups'] }); setShowCreateBackup(false); toast('success', t('maintenance.backupCreateSuccess')) },
    onError: () => toast('error', t('maintenance.backupCreateError')),
  })

  const openEditRetention = (policy: RetentionPolicy) => {
    setEditRetention(policy)
    setEditHotDays(String(policy.hot_days ?? ''))
    setEditAnonymizeDays(String(policy.anonymize_after_days ?? ''))
    setEditEraseDays(String(policy.erase_after_days ?? ''))
    setEditAutoPurge(!!policy.auto_purge)
  }

  const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
    if (s === 'ok' || s === 'healthy' || s === 'completed' || s === 'running') return 'success'
    if (s === 'warning') return 'warning'
    if (s === 'error' || s === 'failed') return 'danger'
    return 'default'
  }

  const retentionColumns = [
    { key: 'name', label: t('maintenance.name') },
    { key: 'data_domain', label: t('maintenance.domain') },
    { key: 'hot_days', label: t('maintenance.hotDays') },
    { key: 'anonymize_after_days', label: t('maintenance.anonymizeAfterDays') },
    { key: 'erase_after_days', label: t('maintenance.eraseAfterDays') },
    { key: 'auto_purge', label: t('maintenance.autoPurge') },
    { key: 'is_active', label: t('maintenance.active') },
  ]

  const backupColumns = [
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
    { key: 'created_at', label: t('maintenance.createdAt') },
    { key: 'size_mb', label: t('maintenance.sizeMb') },
  ]

  const dockerContainers = (health?.docker_containers ?? []) as DockerContainer[]
  const diskUsage = health?.disk_usage as DiskInfo | undefined
  const mariadbTables = (health?.mariadb_tables ?? []) as MariaDBTable[]

  const diskPercent = diskUsage?.percent ?? (diskUsage?.total ? Math.round(((diskUsage.used ?? 0) / diskUsage.total) * 100) : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('maintenance.title')}</h1>

      <Tabs
        tabs={[
          { key: 'retention', label: t('maintenance.retention') },
          { key: 'backups', label: t('maintenance.backups') },
          { key: 'health', label: t('maintenance.health') },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'retention' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('maintenance.retentionPolicies')}</h2>
          </div>
          {(retentionPolicies ?? []).length === 0 && !retentionLoading ? (
            <EmptyState title={t('maintenance.noRetentionPolicies')} />
          ) : (
            <Table
              columns={retentionColumns}
              data={(retentionPolicies as Record<string, unknown>[]) ?? []}
              loading={retentionLoading}
              renderCell={(col, row) => {
                const val = row[col.key]
                if (col.key === 'auto_purge' || col.key === 'is_active') {
                  return <Badge variant={val ? 'success' : 'default'}>{val ? t('common.yes') : t('common.no')}</Badge>
                }
                return String(val ?? '—')
              }}
              onRowClick={canEdit('admin') ? (row) => openEditRetention(row as RetentionPolicy) : undefined}
            />
          )}
          {canEdit('admin') && editRetention && (
            <Modal open={!!editRetention} onClose={() => setEditRetention(null)} title={t('maintenance.editRetention')} footer={
              <>
                <Button variant="secondary" onClick={() => setEditRetention(null)}>{t('common.cancel')}</Button>
                <Button onClick={() => updateRetentionMutation.mutate({
                  id: editRetention.id,
                  data: {
                    hot_days: Number(editHotDays) || editRetention.hot_days,
                    anonymize_after_days: editAnonymizeDays ? Number(editAnonymizeDays) : null,
                    erase_after_days: editEraseDays ? Number(editEraseDays) : null,
                    auto_purge: editAutoPurge,
                  }
                })}>{t('common.save')}</Button>
              </>
            }>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input label={t('maintenance.hotDays')} value={editHotDays} onChange={setEditHotDays} type="number" />
                <Input label={t('maintenance.anonymizeAfterDays')} value={editAnonymizeDays} onChange={setEditAnonymizeDays} type="number" />
                <Input label={t('maintenance.eraseAfterDays')} value={editEraseDays} onChange={setEditEraseDays} type="number" />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  <input type="checkbox" checked={editAutoPurge} onChange={(e) => setEditAutoPurge(e.target.checked)} />
                  {t('maintenance.autoPurge')}
                </label>
              </div>
            </Modal>
          )}
        </Card>
      )}

      {activeTab === 'backups' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('maintenance.backups')}</h2>
            {canEdit('admin') && <Button size="sm" onClick={() => setShowCreateBackup(true)}>{t('maintenance.createBackup')}</Button>}
          </div>
          {(backups ?? []).length === 0 && !backupsLoading ? (
            <EmptyState title={t('maintenance.noBackups')} />
          ) : (
            <Table
              columns={backupColumns}
              data={(backups as Record<string, unknown>[]) ?? []}
              loading={backupsLoading}
              renderCell={(col, row) => {
                if (col.key === 'status') return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
                if (col.key === 'created_at') return String(row[col.key] ?? '').replace('T', ' ').slice(0, 19)
                return String(row[col.key] ?? '—')
              }}
            />
          )}
          {canEdit('admin') && showCreateBackup && (
            <Modal open={showCreateBackup} onClose={() => setShowCreateBackup(false)} title={t('maintenance.createBackup')} footer={
              <>
                <Button variant="secondary" onClick={() => setShowCreateBackup(false)}>{t('common.cancel')}</Button>
                <Button onClick={() => createBackupMutation.mutate({})}>{t('common.create')}</Button>
              </>
            }>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('maintenance.backupCreateConfirm')}</p>
            </Modal>
          )}
        </Card>
      )}

      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Disk usage */}
          <Card>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px' }}>{t('maintenance.diskUsage')}</h2>
            {diskUsage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <StatCard label={t('maintenance.diskTotal')} value={`${Math.round((diskUsage.total ?? 0) / 1024)} GB`} icon={<HardDrive size={20} />} color="var(--color-accent)" />
                  <StatCard label={t('maintenance.diskUsed')} value={`${Math.round((diskUsage.used ?? 0) / 1024)} GB`} icon={<Activity size={20} />} color="var(--color-warning)" />
                  <StatCard label={t('maintenance.diskFree')} value={`${Math.round((diskUsage.free ?? 0) / 1024)} GB`} icon={<Cpu size={20} />} color="var(--color-success)" />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{t('maintenance.diskUsed')} {diskPercent ?? 0}%</span>
                  </div>
                  <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(diskPercent ?? 0, 100)}%`,
                      height: '100%',
                      borderRadius: '4px',
                      background: (diskPercent ?? 0) > 90 ? 'var(--color-danger)' : (diskPercent ?? 0) > 70 ? 'var(--color-warning)' : 'var(--color-success)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('common.noData')}</p>
            )}
          </Card>

          {/* MariaDB tables */}
          <Card>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px' }}>{t('maintenance.mariadbTables')}</h2>
            {mariadbTables.length > 0 ? (
              <Table
                columns={[
                  { key: 'table_name', label: t('maintenance.tableName') },
                  { key: 'row_count', label: t('maintenance.rowCount') },
                ]}
                data={mariadbTables.slice(0, 10)}
                renderCell={(col, row) => {
                  if (col.key === 'row_count') return Number(row[col.key] ?? 0).toLocaleString()
                  return String(row[col.key] ?? '—')
                }}
              />
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('common.noData')}</p>
            )}
          </Card>

          {/* Docker containers */}
          <Card>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px' }}>{t('maintenance.dockerContainers')}</h2>
            {dockerContainers.length > 0 ? (
              <Table
                columns={[
                  { key: 'name', label: t('common.name') },
                  { key: 'status', label: t('common.status') },
                ]}
                data={dockerContainers}
                renderCell={(col, row) => {
                  if (col.key === 'status') return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
                  return String(row[col.key] ?? '—')
                }}
              />
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('common.noData')}</p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}