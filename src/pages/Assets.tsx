import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Select, Modal, Table, EmptyState, Input, ConfirmDialog } from '../components/ui'
import { assetsApi } from '../api'
import { Monitor, CheckCircle, XCircle, FolderOpen, Download, Plus, Pencil, Trash2, Radar, Loader2, Search, Tag, Server, Cpu, HardDrive, MemoryStick, X } from 'lucide-react'
import { formatLocalTime } from '../utils/eventFormatter'
import type { AssetItem } from '../api/types'

interface AssetGroup {
  id: number
  name: string
  description?: string
  created_at?: string
  asset_count?: number
}

interface ScanHost {
  ip: string
  mac: string
  hostname: string
  device_type: string
  status: string
}

type ScanStep = 'config' | 'scanning' | 'results'

// ── Inventory status config ──
const INVENTORY_STATUS_OPTIONS = [
  { value: 'inService', color: 'var(--color-success)' },
  { value: 'migrating', color: 'var(--color-info)' },
  { value: 'toMigrate', color: 'var(--color-warning, #eab308)' },
  { value: 'toReplace', color: 'var(--color-warning, #f97316)' },
  { value: 'maintenance', color: 'var(--color-purple, #8b5cf6)' },
  { value: 'outOfService', color: 'var(--color-danger)' },
  { value: 'retired', color: 'var(--color-text-secondary)' },
] as const

// ── Device types for CMDB fusion ──
const DEVICE_TYPE_OPTIONS = [
  { value: 'server', label: 'server' },
  { value: 'vm', label: 'vm' },
  { value: 'router', label: 'router' },
  { value: 'switch', label: 'switch' },
  { value: 'firewall', label: 'firewall' },
  { value: 'firewall_cluster', label: 'firewall_cluster' },
  { value: 'printer', label: 'printer' },
  { value: 'phone', label: 'phone' },
  { value: 'wifi_ap', label: 'wifi_ap' },
  { value: 'network', label: 'network' },
  { value: 'application', label: 'application' },
  { value: 'database', label: 'database' },
  { value: 'website', label: 'website' },
  { value: 'container', label: 'container' },
  { value: 'load_balancer', label: 'load_balancer' },
  { value: 'storage_cluster', label: 'storage_cluster' },
  { value: 'cloud_vm', label: 'cloud_vm' },
  { value: 'cloud_account', label: 'cloud_account' },
  { value: 'other', label: 'other' },
] as const

const CRITICALITY_OPTIONS = [
  { value: 'critical', label: 'critical' },
  { value: 'high', label: 'high' },
  { value: 'medium', label: 'medium' },
  { value: 'low', label: 'low' },
] as const

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'production' },
  { value: 'staging', label: 'staging' },
  { value: 'development', label: 'development' },
  { value: 'test', label: 'test' },
] as const

const sourceBadge = (source: string | null, version: string | null, t: (k: string) => string) => {
  const src = source || 'agent'
  if (src === 'manual') return <Badge variant="default">{t('assets.sourceManual')}</Badge>
  if (src === 'scan') return <Badge variant="info">{t('assets.sourceScan')}</Badge>
  // agent — show version if available
  const label = version ? `${t('assets.sourceAgent')} v${version}` : t('assets.sourceAgent')
  return <Badge variant="success">{label}</Badge>
}

const inventoryStatusLabel = (value: string | null, t: (k: string) => string): string => {
  switch (value) {
    case 'inService': return t('assets.inService')
    case 'migrating': return t('assets.migrating')
    case 'toMigrate': return t('assets.toMigrate')
    case 'toReplace': return t('assets.toReplace')
    case 'maintenance': return t('assets.maintenance')
    case 'outOfService': return t('assets.outOfService')
    case 'retired': return t('assets.retired')
    default: return t('assets.inService')
  }
}

const inventoryStatusColor = (value: string | null): string => {
  const opt = INVENTORY_STATUS_OPTIONS.find(o => o.value === value)
  return opt ? opt.color : 'var(--color-success)'
}

// ── Tag Input Component ──
function TagInput({ tags, onChange, suggestions }: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filteredSuggestions = suggestions.filter(
    s => s.toUpperCase().includes(inputValue.toUpperCase()) && !tags.includes(s)
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const normalized = tag.trim().toUpperCase()
    if (normalized && !tags.includes(normalized)) {
      onChange([...tags, normalized])
    }
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '6px', minHeight: '38px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', alignItems: 'center' }}>
        {tags.map((tag, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--color-accent-bg, rgba(99,102,241,0.1))', borderRadius: '12px', fontSize: '12px', color: 'var(--color-accent)', fontWeight: 500 }}>
            {tag}
            <button type="button" onClick={() => removeTag(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-secondary)' }}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (inputValue.trim()) addTag(inputValue)
            }
            if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
              removeTag(tags.length - 1)
            }
          }}
          placeholder={t('assets.addTag')}
          style={{ flex: 1, minWidth: '80px', border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-text-primary)', fontSize: '14px', padding: '2px' }}
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', marginTop: '2px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.tagSuggestions')}</div>
          {filteredSuggestions.slice(0, 10).map((suggestion) => (
            <div key={suggestion} onClick={() => addTag(suggestion)} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── IP List Editor Component ──
function IpListEditor({ ips, onChange }: { ips: string[]; onChange: (ips: string[]) => void }) {
  const { t } = useTranslation()
  const [newIp, setNewIp] = useState('')

  const addIp = () => {
    const trimmed = newIp.trim()
    if (trimmed && !ips.includes(trimmed)) {
      onChange([...ips, trimmed])
      setNewIp('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {ips.map((ip, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ flex: 1, padding: '4px 8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>{ip}</span>
          <button type="button" onClick={() => onChange(ips.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input value={newIp} onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIp() } }}
          placeholder="192.168.1.10" style={{ flex: 1, padding: '6px 8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-text-primary)', outline: 'none' }} />
        <Button size="sm" variant="secondary" onClick={addIp} icon={<Plus size={12} />}>{t('assets.addIp')}</Button>
      </div>
    </div>
  )
}

export function AssetsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [osFilter, setOsFilter] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<Record<string, unknown> | null>(null)
  const [editAssetOpen, setEditAssetOpen] = useState(false)
  const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState<Record<string, unknown>>({})

  // Group management state
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false)
  const [editGroupModal, setEditGroupModal] = useState<{ mode: 'create' | 'edit'; group?: AssetGroup } | null>(null)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<AssetGroup | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')

  // Assign group state
  const [assignGroupAsset, setAssignGroupAsset] = useState<Record<string, unknown> | null>(null)
  const [assignGroupId, setAssignGroupId] = useState('')

  // Create asset state
  const [createAssetOpen, setCreateAssetOpen] = useState(false)
  const [newHostname, setNewHostname] = useState('')
  const [newIps, setNewIps] = useState<string[]>([])
  const [newMac, setNewMac] = useState('')
  const [newOsName, setNewOsName] = useState('')
  const [newOsVersion, setNewOsVersion] = useState('')
  const [newArch, setNewArch] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [newStatus, setNewStatus] = useState('active')
  const [newGroupId, setNewGroupId] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [newLocation, setNewLocation] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [newInventoryStatus, setNewInventoryStatus] = useState('inService')

  // CMDB fusion fields for create
  const [newDeviceType, setNewDeviceType] = useState('server')
  const [newIsVirtualizationHost, setNewIsVirtualizationHost] = useState(false)
  const [newCmdbCriticality, setNewCmdbCriticality] = useState('')
  const [newCmdbEnvironment, setNewCmdbEnvironment] = useState('')

  // Network scan state
  const [scanOpen, setScanOpen] = useState(false)
  const [scanStep, setScanStep] = useState<ScanStep>('config')
  const [ipRange, setIpRange] = useState('')
  const [scanJobId, setScanJobId] = useState('')
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError, setScanError] = useState('')
  const [scanHosts, setScanHosts] = useState<ScanHost[]>([])
  const [selectedHosts, setSelectedHosts] = useState<Set<number>>(new Set())
  const [importOsName, setImportOsName] = useState('')
  const [importOsVersion, setImportOsVersion] = useState('')
  const [networkInfo, setNetworkInfo] = useState<{ interface?: string; network?: string; gateway?: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tags suggestions
  const { data: existingTags } = useQuery<string[]>({
    queryKey: ['assets', 'tags'],
    queryFn: () => assetsApi.tags().then((r) => r.data as string[]),
  })

  // Edit IP list state
  const [editIps, setEditIps] = useState<string[]>([])
  // Edit tags list state
  const [editTags, setEditTags] = useState<string[]>([])

  const { data: assets, isLoading: assetsLoading } = useQuery<AssetItem[]>({
    queryKey: ['assets', statusFilter, groupFilter],
    queryFn: () => assetsApi.list({ status: statusFilter === 'all' ? undefined : statusFilter, group: groupFilter || undefined } as Record<string, string>).then((r) => r.data as AssetItem[]),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['assets', 'stats'],
    queryFn: () => assetsApi.stats().then((r) => r.data),
  })

  const { data: groups } = useQuery<AssetGroup[]>({
    queryKey: ['assets', 'groups'],
    queryFn: () => assetsApi.groups().then((r) => r.data as AssetGroup[]),
  })

  const exportMutation = useMutation({
    mutationFn: () => assetsApi.list({ page_size: '1000' } as Record<string, string>),
    onSuccess: (response) => {
      const data = response.data as AssetItem[]
      const csv = 'hostname,status,os,source,tags,location,owner\n' + data.map((a: AssetItem) => `${a.hostname},${a.status},${a.os_name ?? ''} ${a.os_version ?? ''},${a.source ?? 'agent'},${a.tags ?? ''},${a.location ?? ''},${a.owner ?? ''}`).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'assets.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast('success', t('assets.exportSuccess'))
    },
    onError: () => toast('error', t('assets.exportError')),
  })

  // Group CRUD mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => assetsApi.createGroup(data),
    onSuccess: () => {
      toast('success', t('assets.createGroupSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      setEditGroupModal(null)
      setGroupName('')
      setGroupDescription('')
    },
    onError: () => toast('error', t('assets.createGroupError')),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => assetsApi.updateGroup(id, data),
    onSuccess: () => {
      toast('success', t('assets.editGroupSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      setEditGroupModal(null)
      setGroupName('')
      setGroupDescription('')
    },
    onError: () => toast('error', t('assets.editGroupError')),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => assetsApi.deleteGroup(id),
    onSuccess: () => {
      toast('success', t('assets.deleteGroupSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      setDeleteGroupConfirm(null)
    },
    onError: () => toast('error', t('assets.deleteGroupError')),
  })

  const assignGroupMutation = useMutation({
    mutationFn: ({ assetId, groupId }: { assetId: number; groupId: number | null }) =>
      assetsApi.update(assetId, { group_id: groupId }),
    onSuccess: () => {
      toast('success', t('assets.assignGroupSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setAssignGroupAsset(null)
      setAssignGroupId('')
    },
    onError: () => toast('error', t('assets.assignGroupError')),
  })

  const createAssetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => assetsApi.create(data),
    onSuccess: () => {
      toast('success', t('assets.createAssetSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'tags'] })
      setCreateAssetOpen(false)
      setNewHostname('')
      setNewIps([])
      setNewMac('')
      setNewOsName('')
      setNewOsVersion('')
      setNewArch('')
      setNewPlatform('')
      setNewStatus('active')
      setNewGroupId('')
      setNewTags([])
      setNewLocation('')
      setNewOwner('')
      setNewInventoryStatus('inService')
      setNewDeviceType('server')
      setNewIsVirtualizationHost(false)
      setNewCmdbCriticality('')
      setNewCmdbEnvironment('')
    },
    onError: () => toast('error', t('assets.createAssetError')),
  })

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => assetsApi.update(id, data),
    onSuccess: () => {
      toast('success', t('assets.editAssetSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'tags'] })
      setEditAssetOpen(false)
    },
    onError: () => toast('error', t('assets.editAssetError')),
  })

  const deleteAssetMutation = useMutation({
    mutationFn: (id: number) => assetsApi.delete(id),
    onSuccess: () => {
      toast('success', t('assets.deleteAssetSuccess'))
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      setDeleteAssetId(null)
      setSelectedAsset(null)
    },
    onError: () => toast('error', t('assets.deleteAssetError')),
  })

  // ── Network scan logic ──

  const detectNetwork = useCallback(async () => {
    try {
      const res = await assetsApi.getNetworkInfo()
      const info = res.data as { interface?: string; network?: string; gateway?: string }
      setNetworkInfo(info)
      if (info.network) {
        setIpRange(info.network)
      }
    } catch {
      toast('error', t('assets.scanError'))
    }
  }, [toast, t])

  const startScan = useCallback(async () => {
    if (!ipRange.trim()) {
      toast('error', t('assets.scanError'))
      return
    }
    try {
      setScanStep('scanning')
      setScanProgress(0)
      setScanHosts([])
      setSelectedHosts(new Set())
      setScanError('')
      const res = await assetsApi.startScan(ipRange.trim())
      const data = res.data as { job_id: string; status: string }
      setScanJobId(data.job_id)
    } catch (err: unknown) {
      setScanError(String(err))
      setScanStep('config')
      toast('error', t('assets.scanError'))
    }
  }, [ipRange, toast, t])

  // Poll scan status
  useEffect(() => {
    if (scanStep !== 'scanning' || !scanJobId) return

    pollRef.current = setInterval(async () => {
      try {
        const res = await assetsApi.getScanStatus(scanJobId)
        const data = res.data as { status: string; progress: number; hosts_found: ScanHost[]; hosts_count: number; error: string | null; step: string }
        setScanProgress(data.progress ?? 0)

        if (data.status === 'completed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setScanHosts(data.hosts_found || [])
          setSelectedHosts(new Set(data.hosts_found?.map((_: ScanHost, i: number) => i) || []))
          setScanStep('results')
          if (data.hosts_found?.length === 0) {
            toast('info', t('assets.noNewHosts'))
          }
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setScanError(data.error || 'Unknown error')
          setScanStep('config')
          toast('error', t('assets.scanError'))
        }
      } catch {
        // Continue polling on transient errors
      }
    }, 2000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [scanStep, scanJobId, toast, t])

  const importHosts = useCallback(async (hosts: ScanHost[]) => {
    if (!scanJobId || hosts.length === 0) return
    try {
      const res = await assetsApi.importScanResults(scanJobId, hosts as unknown as Record<string, unknown>[])
      const data = res.data as { imported: number; errors: string[] }
      toast('success', `${t('assets.importSuccess')} (${data.imported})`)
      if (data.errors?.length > 0) {
        toast('warning', data.errors.join('; '))
      }
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets', 'stats'] })
      setScanOpen(false)
      setScanStep('config')
    } catch {
      toast('error', t('assets.importError'))
    }
  }, [scanJobId, queryClient, toast, t])

  const closeScanModal = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setScanOpen(false)
    setScanStep('config')
    setScanJobId('')
    setScanProgress(0)
    setScanHosts([])
    setSelectedHosts(new Set())
    setScanError('')
  }, [])

  const toggleHostSelection = useCallback((index: number) => {
    setSelectedHosts(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const selectAllHosts = useCallback(() => {
    setSelectedHosts(new Set(scanHosts.map((_, i) => i)))
  }, [scanHosts])

  const deselectAllHosts = useCallback(() => {
    setSelectedHosts(new Set())
  }, [])

  // Auto-detect network when scan modal opens
  useEffect(() => {
    if (scanOpen && scanStep === 'config' && !ipRange) {
      detectNetwork()
    }
  }, [scanOpen, scanStep, ipRange, detectNetwork])

  // API may return objects [{name: "...", id: 1}, ...] or strings ["group1", ...]
  const groupsList: AssetGroup[] = Array.isArray(groups) ? groups : []
  const groupFilterOptions = groupsList.map((g) => {
    if (typeof g === 'string') return { label: g, value: g }
    const obj = g as unknown as Record<string, unknown>
    return { label: String(obj.name ?? obj.group_name ?? obj.label ?? obj.id ?? ''), value: String(obj.name ?? obj.group_name ?? obj.label ?? obj.id ?? '') }
  })

  const statsData = stats as Record<string, unknown> | undefined
  const totalAssets = Number(statsData?.total ?? 0)
  const byStatus = (statsData?.by_status ?? {}) as Record<string, number>
  const byOs = (statsData?.by_os ?? {}) as Record<string, number>
  const groupsCount = Number(statsData?.groups_count ?? 0)
  const activeCount = byStatus['active'] ?? 0
  const inactiveCount = byStatus['inactive'] ?? 0


  const filteredAssets = (assets ?? []).filter((a) => {
    if (statusFilter && statusFilter !== 'all' && a.status !== statusFilter) return false
    if (groupFilter && a.group_name !== groupFilter) return false
    if (osFilter) {
      const osKey = a.os_name ? `${a.os_name} ${a.os_version ?? ''}`.trim() : 'unknown'
      if (osKey !== osFilter) return false
    }
    return true
  })

  const columns = [
    { key: 'hostname', label: t('assets.hostname') },
    { key: 'device_type', label: t('assets.deviceType') },
    { key: 'inventory_status', label: t('assets.inventoryStatus') },
    { key: 'os_name', label: t('assets.os') },
    { key: 'cmdb_criticality', label: t('assets.criticality') },
    { key: 'cmdb_environment', label: t('assets.environment') },
    { key: 'group_name', label: t('assets.group') },
    { key: 'tags', label: t('assets.tags') },
    { key: 'location', label: t('assets.location') },
    { key: 'created_at', label: t('assets.dateAdded') },
  ]

  const openEditGroup = (mode: 'create' | 'edit', group?: AssetGroup) => {
    if (mode === 'edit' && group) {
      setGroupName(group.name)
      setGroupDescription(group.description ?? '')
    } else {
      setGroupName('')
      setGroupDescription('')
    }
    setEditGroupModal({ mode, group })
  }

  const handleSaveGroup = () => {
    if (!groupName.trim()) return
    const data: Record<string, unknown> = { name: groupName.trim(), description: groupDescription.trim() }
    if (editGroupModal?.mode === 'create') {
      createGroupMutation.mutate(data)
    } else if (editGroupModal?.mode === 'edit' && editGroupModal.group) {
      updateGroupMutation.mutate({ id: editGroupModal.group.id, data })
    }
  }

  const handleAssignGroup = () => {
    if (!assignGroupAsset) return
    const assetId = Number(assignGroupAsset.id)
    const groupId = assignGroupId ? Number(assignGroupId) : null
    assignGroupMutation.mutate({ assetId, groupId })
  }

  // Helper: render inventory status badge
  const renderInventoryBadge = (asset: Record<string, unknown>) => {
    const source = String(asset.source ?? '')
    const status = String(asset.status ?? '')
    const invStatus = String(asset.inventory_status ?? 'inService')
    const isAgent = source === 'agent'
    const effectiveStatus = isAgent ? (status === 'active' ? 'inService' : 'outOfService') : invStatus
    const label = inventoryStatusLabel(effectiveStatus, t)
    const color = inventoryStatusColor(effectiveStatus)
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
        padding: '4px 10px', borderRadius: '9999px', color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        lineHeight: 1.4, whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('assets.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={<Radar size={16} />} variant="secondary" onClick={() => { setScanOpen(true); setScanStep('config'); }}>
            {t('assets.scanNetwork')}
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setCreateAssetOpen(true)}>
            {t('assets.addAsset')}
          </Button>
          <Button icon={<FolderOpen size={16} />} variant="secondary" onClick={() => setManageGroupsOpen(true)}>
            {t('assets.manageGroups')}
          </Button>
          <Button icon={<Download size={16} />} onClick={() => exportMutation.mutate()}>
            {t('common.export')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label={t('assets.totalAssets')} value={totalAssets} icon={<Monitor size={20} />} color="var(--color-accent)" loading={statsLoading} />
        <StatCard label={t('assets.activeAssets')} value={activeCount} icon={<CheckCircle size={20} />} color="var(--color-success)" loading={statsLoading} />
        <StatCard label={t('assets.inactiveAssets')} value={inactiveCount} icon={<XCircle size={20} />} color="var(--color-danger)" loading={statsLoading} />
        <StatCard label={t('assets.groups')} value={groupsCount} icon={<FolderOpen size={20} />} color="var(--color-info)" loading={statsLoading} />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '140px' }}>
            <Select
              label={t('common.status')}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: t('common.all'), value: 'all' },
                { label: t('common.active'), value: 'active' },
                { label: t('common.inactive'), value: 'inactive' },
                { label: t('common.pending'), value: 'pending' },
              ]}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select
              label={t('assets.group')}
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { label: t('common.all'), value: '' },
                ...groupFilterOptions,
              ]}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select
              label={t('assets.os')}
              value={osFilter}
              onChange={setOsFilter}
              options={[
                { label: t('common.all'), value: '' },
                ...Object.keys(byOs).map((k) => ({ label: k, value: k })),
              ]}
            />
          </div>
        </div>

        {filteredAssets.length === 0 && !assetsLoading ? (
          <EmptyState title={t('assets.noAssets')} />
        ) : (
          <Table
            columns={columns}
            data={filteredAssets as unknown as Record<string, unknown>[]}
            loading={assetsLoading}
            onRowClick={(row) => setSelectedAsset(row)}
            renderCell={(col, row) => {
              if (col.key === 'hostname') {
                const isAgent = String(row.source ?? '') === 'agent'
                const dt = String(row.device_type ?? 'server')
                const deviceIconMap: Record<string, string> = {
                  server: '🖥️', vm: '💻', router: '🌐', switch: '🔀', firewall: '🛡️',
                  printer: '🖨️', phone: '📱', wifi_ap: '📶', application: '📦',
                  database: '🗄️', website: '🌍', container: '📦', other: '❓',
                  firewall_cluster: '🛡️', network: '🌐', load_balancer: '⚖️',
                  storage_cluster: '💾', cloud_vm: '☁️', cloud_account: '☁️',
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span title={t('assets.deviceType') + ': ' + dt}>{deviceIconMap[dt] || '❓'}</span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{String(row[col.key] ?? '')}</span>
                    {isAgent && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} title="Agent actif" />}
                  </div>
                )
              }
              if (col.key === 'device_type') {
                const dt = String(row.device_type ?? 'server')
                const dtLabel = t(`assets.deviceTypeLabels.${dt}`) === `assets.deviceTypeLabels.${dt}` ? dt : t(`assets.deviceTypeLabels.${dt}`)
                return <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{dtLabel}</span>
              }
              if (col.key === 'cmdb_criticality') {
                const crit = String(row.cmdb_criticality ?? '')
                if (!crit) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                const critColors: Record<string, { bg: string; text: string }> = {
                  critical: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
                  high: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
                  medium: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
                  low: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
                }
                const c = critColors[crit] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
                const critLabel = t(`assets.criticalityLabels.${crit}`) === `assets.criticalityLabels.${crit}` ? crit : t(`assets.criticalityLabels.${crit}`)
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', color: c.text, background: c.bg, whiteSpace: 'nowrap' }}>
                    {critLabel}
                  </span>
                )
              }
              if (col.key === 'cmdb_environment') {
                const env = String(row.cmdb_environment ?? '')
                if (!env) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                const envColors: Record<string, { bg: string; text: string }> = {
                  production: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
                  staging: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
                  development: { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
                  test: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
                }
                const c = envColors[env] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
                const envLabel = t(`assets.environmentLabels.${env}`) === `assets.environmentLabels.${env}` ? env : t(`assets.environmentLabels.${env}`)
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', color: c.text, background: c.bg, whiteSpace: 'nowrap' }}>
                    {envLabel}
                  </span>
                )
              }
              if (col.key === 'inventory_status') {
                return renderInventoryBadge(row)
              }
              if (col.key === 'os_name') {
                const osName = String(row.os_name ?? '')
                const osVer = String(row.os_version ?? '')
                return osName ? `${osName} ${osVer}`.trim() : '—'
              }
              if (col.key === 'group_name') return String(row[col.key] ?? '—')
              if (col.key === 'tags') {
                const tagsStr = String(row.tags ?? '')
                if (!tagsStr) return '—'
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    {tagsStr.split(',').map((tag, i) => (
                      <span key={i} style={{ display: 'inline-block', padding: '1px 6px', background: 'var(--color-accent-bg, rgba(99,102,241,0.1))', borderRadius: '10px', fontSize: '11px', color: 'var(--color-accent)', fontWeight: 500 }}>{tag.trim()}</span>
                    ))}
                  </div>
                )
              }
              if (col.key === 'location') return String(row[col.key] ?? '—')
              if (col.key === 'created_at') return formatLocalTime(String(row[col.key] ?? ''))
              return String(row[col.key] ?? '—')
            }}
          />
        )}
      </Card>

      {/* Asset detail modal — reorganisé en sections */}
      {selectedAsset && (
        <Modal open={!!selectedAsset} onClose={() => setSelectedAsset(null)} title={t('assets.assetDetail')} size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteAssetId(Number(selectedAsset.id))}>{t('common.delete')}</Button>
              <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => {
                const ipsStr = String(selectedAsset.host_ips ?? '')
                const ipsArr = ipsStr ? ipsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : []
                const tagsStr = String(selectedAsset.tags ?? '')
                const tagsArr = tagsStr ? tagsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : []
                setEditFields({
                  hostname: selectedAsset.hostname ?? '',
                  host_ips: selectedAsset.host_ips ?? '',
                  mac: selectedAsset.mac ?? '',
                  os_name: selectedAsset.os_name ?? '',
                  os_version: selectedAsset.os_version ?? '',
                  arch: selectedAsset.arch ?? '',
                  platform: selectedAsset.platform ?? '',
                  cpu_model: selectedAsset.cpu_model ?? '',
                  memory_mb: selectedAsset.memory_mb ?? null,
                  disk_gb: selectedAsset.disk_gb ?? null,
                  group_id: selectedAsset.group_id ?? null,
                  tags: selectedAsset.tags ?? '',
                  location: selectedAsset.location ?? '',
                  owner: selectedAsset.owner ?? '',
                  inventory_status: selectedAsset.inventory_status ?? 'inService',
                  device_type: selectedAsset.device_type ?? 'server',
                  parent_id: selectedAsset.parent_id ?? null,
                  is_virtualization_host: selectedAsset.is_virtualization_host ?? false,
                  cmdb_criticality: selectedAsset.cmdb_criticality ?? '',
                  cmdb_environment: selectedAsset.cmdb_environment ?? '',
                })
                setEditIps(ipsArr)
                setEditTags(tagsArr)
                setEditAssetOpen(true)
              }}>{t('common.edit')}</Button>
              <Button variant="secondary" onClick={() => setSelectedAsset(null)}>{t('common.close')}</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* SECTION 1 — Informations générales */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                {t('assets.assetDetail')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.hostname')}</span>
                  <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{String(selectedAsset.hostname ?? '')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.inventoryStatus')}</span>
                  <div>{renderInventoryBadge(selectedAsset)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.source')}</span>
                  <div>{sourceBadge(String(selectedAsset.source ?? null), String(selectedAsset.version ?? null), t)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.dateAdded')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{formatLocalTime(String(selectedAsset.created_at ?? ''))}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.group')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.group_name ?? '—')}</div>
                </div>
              </div>
            </div>

            {/* SECTION 2 — Système */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                <Server size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />{t('assets.systemInfo')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.os')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{[selectedAsset.os_name, selectedAsset.os_version].filter(Boolean).join(' ') || String(selectedAsset.platform ?? '—')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.arch')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.arch ?? '—')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.platform')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.platform ?? '—')}</div>
                </div>
              </div>
            </div>

            {/* SECTION 3 — Réseau */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                {t('assets.networkInfo')}
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.ipAddress')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.macAddress')}</th>
                  </tr>
                </thead>
                <tbody>
                  {String(selectedAsset.host_ips ?? '').split(',').filter(Boolean).length > 0 ? (
                    String(selectedAsset.host_ips ?? '').split(',').map((ip, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{ip.trim()}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{i === 0 ? String(selectedAsset.mac ?? '—') : '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>—</td>
                      <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{String(selectedAsset.mac ?? '—')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* SECTION 4 — Hardware */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                {t('assets.systemInfo')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '11px', marginBottom: '4px' }}><Cpu size={14} />{t('assets.cpuModel')}</div>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.cpu_model ?? '—')}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '11px', marginBottom: '4px' }}><MemoryStick size={14} />{t('assets.memory')}</div>
                  <div style={{ color: 'var(--color-text-primary)' }}>{selectedAsset.memory_mb ? `${selectedAsset.memory_mb} MB` : '—'}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '11px', marginBottom: '4px' }}><HardDrive size={14} />{t('assets.disk')}</div>
                  <div style={{ color: 'var(--color-text-primary)' }}>{selectedAsset.disk_gb ? `${selectedAsset.disk_gb} GB` : '—'}</div>
                </div>
              </div>
            </div>

            {/* SECTION 5 — Inventaire */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                <Tag size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />{t('assets.inventoryInfo')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.tags')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>
                    {String(selectedAsset.tags ?? '')
                      ? String(selectedAsset.tags ?? '').split(',').map((tag, i) => (
                        <span key={i} style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--color-accent-bg, rgba(99,102,241,0.1))', borderRadius: '12px', fontSize: '12px', color: 'var(--color-accent)', marginRight: '4px', marginBottom: '4px' }}>{tag.trim()}</span>
                      ))
                      : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.location')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.location ?? '—')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.owner')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.owner ?? '—')}</div>
                </div>
              </div>
            </div>

            {/* SECTION 6 — CMDB */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                CMDB
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.deviceType')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.device_type ?? 'server')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.virtualizationHost')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{selectedAsset.is_virtualization_host ? '✓' : '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.criticality')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.cmdb_criticality ?? '—')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('assets.environment')}</span>
                  <div style={{ color: 'var(--color-text-primary)' }}>{String(selectedAsset.cmdb_environment ?? '—')}</div>
                </div>
              </div>
            </div>

            {/* SECTION 6 — Assignation au groupe */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                <FolderOpen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />{t('assets.assignGroup')}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Select
                    label={t('assets.group')}
                    value={String(selectedAsset.group_id ?? '')}
                    onChange={(val) => {
                      const groupId = val ? Number(val) : null
                      if (selectedAsset) {
                        assignGroupMutation.mutate({ assetId: Number(selectedAsset.id), groupId })
                      }
                    }}
                    options={[
                      { label: t('assets.noGroup'), value: '' },
                      ...groupsList.map((g) => ({ label: g.name, value: String(g.id) })),
                    ]}
                  />
                </div>
              </div>
            </div>

          </div>
        </Modal>
      )}

      {/* Edit asset modal */}
      {editAssetOpen && selectedAsset && (
        <Modal open={editAssetOpen} onClose={() => setEditAssetOpen(false)} title={t('assets.editAsset')} size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setEditAssetOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" disabled={updateAssetMutation.isPending} onClick={() => {
                const isAgent = String(editFields.source ?? '') === 'agent'
                const data: Record<string, unknown> = {
                  ...editFields,
                  host_ips: editIps.join(','),
                  tags: editTags.join(','),
                }
                // For agent assets, don't send inventory_status
                if (isAgent) {
                  delete data.inventory_status
                }
                updateAssetMutation.mutate({ id: Number(selectedAsset.id), data })
              }}>
                {updateAssetMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label={t('assets.hostname')} value={String(editFields.hostname ?? '')} onChange={(v) => setEditFields({ ...editFields, hostname: v })} required />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.ipAddress')}</label>
              <IpListEditor ips={editIps} onChange={setEditIps} />
            </div>
            <Input label={t('assets.macAddress')} value={String(editFields.mac ?? '')} onChange={(v) => setEditFields({ ...editFields, mac: v })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label={t('assets.osName')} value={String(editFields.os_name ?? '')} onChange={(v) => setEditFields({ ...editFields, os_name: v })} />
              <Input label={t('assets.osVersion')} value={String(editFields.os_version ?? '')} onChange={(v) => setEditFields({ ...editFields, os_version: v })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label={t('assets.architecture')} value={String(editFields.arch ?? '')} onChange={(v) => setEditFields({ ...editFields, arch: v })} />
              <Input label={t('assets.platform')} value={String(editFields.platform ?? '')} onChange={(v) => setEditFields({ ...editFields, platform: v })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Input label={t('assets.cpuModel')} value={String(editFields.cpu_model ?? '')} onChange={(v) => setEditFields({ ...editFields, cpu_model: v })} />
              <Input label={t('assets.memory')} value={String(editFields.memory_mb ?? '')} onChange={(v) => setEditFields({ ...editFields, memory_mb: v ? Number(v) : null })} type="number" />
              <Input label={t('assets.disk')} value={String(editFields.disk_gb ?? '')} onChange={(v) => setEditFields({ ...editFields, disk_gb: v ? Number(v) : null })} type="number" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.tags')}</label>
              <TagInput tags={editTags} onChange={setEditTags} suggestions={(existingTags as string[]) ?? []} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label={t('assets.location')} value={String(editFields.location ?? '')} onChange={(v) => setEditFields({ ...editFields, location: v })} />
              <Input label={t('assets.owner')} value={String(editFields.owner ?? '')} onChange={(v) => setEditFields({ ...editFields, owner: v })} />
            </div>
            <Select label={t('assets.group')} value={String(editFields.group_id ?? '')} onChange={(v) => setEditFields({ ...editFields, group_id: v ? Number(v) : null })}
              options={[{ label: t('assets.noGroup'), value: '' }, ...groupsList.map((g) => ({ label: g.name, value: String(g.id) }))]
            }
            />
            {/* Inventory status: only editable for non-agent assets */}
            {String(editFields.source ?? '') !== 'agent' && (
              <Select label={t('assets.inventoryStatus')} value={String(editFields.inventory_status ?? 'inService')} onChange={(v) => setEditFields({ ...editFields, inventory_status: v })}
                options={INVENTORY_STATUS_OPTIONS.map(o => ({ label: inventoryStatusLabel(o.value, t), value: o.value }))}
              />
            )}
            {String(editFields.source ?? '') === 'agent' && (
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.inventoryStatus')}</label>
                <div style={{ padding: '6px 0' }}>{renderInventoryBadge(editFields)}</div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Automatiquement déterminé par le statut de l'agent</span>
              </div>
            )}
            {/* CMDB Fusion Fields */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
              CMDB
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label={t('assets.deviceType')}
                value={String(editFields.device_type ?? 'server')}
                onChange={(v) => setEditFields({ ...editFields, device_type: v })}
                options={DEVICE_TYPE_OPTIONS.map(o => ({ label: t(`assets.deviceTypeLabels.${o.value}`) === `assets.deviceTypeLabels.${o.value}` ? o.value : t(`assets.deviceTypeLabels.${o.value}`), value: o.value }))}
              />
              <Select
                label={t('assets.criticality')}
                value={String(editFields.cmdb_criticality ?? '')}
                onChange={(v) => setEditFields({ ...editFields, cmdb_criticality: v })}
                options={[{ label: '—', value: '' }, ...CRITICALITY_OPTIONS.map(o => ({ label: t(`assets.criticalityLabels.${o.value}`), value: o.value }))]}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label={t('assets.environment')}
                value={String(editFields.cmdb_environment ?? '')}
                onChange={(v) => setEditFields({ ...editFields, cmdb_environment: v })}
                options={[{ label: '—', value: '' }, ...ENVIRONMENT_OPTIONS.map(o => ({ label: t(`assets.environmentLabels.${o.value}`), value: o.value }))]}
              />
              {String(editFields.device_type ?? 'server') === 'server' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                  <input
                    type="checkbox"
                    checked={!!editFields.is_virtualization_host}
                    onChange={(e) => setEditFields({ ...editFields, is_virtualization_host: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }} onClick={() => setEditFields({ ...editFields, is_virtualization_host: !editFields.is_virtualization_host })}>
                    {t('assets.virtualizationHost')}
                  </label>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete asset confirm */}
      <ConfirmDialog
        open={deleteAssetId !== null}
        title={t('assets.deleteAsset')}
        message={t('assets.deleteAssetConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={() => { if (deleteAssetId) deleteAssetMutation.mutate(deleteAssetId) }}
        onCancel={() => setDeleteAssetId(null)}
      />

      {/* Manage Groups modal */}
      <Modal
        open={manageGroupsOpen}
        onClose={() => setManageGroupsOpen(false)}
        title={t('assets.manageGroups')}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button icon={<Plus size={16} />} onClick={() => openEditGroup('create')}>
              {t('assets.createGroup')}
            </Button>
          </div>

          {groupsList.length === 0 ? (
            <EmptyState title={t('assets.noGroups')} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t('assets.groupName')}</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t('assets.groupDescription')}</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t('assets.assetCount')}</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {groupsList.map((group) => (
                  <tr key={group.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{group.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{group.description ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-primary)', textAlign: 'center' }}>
                      {group.asset_count ?? (assets as AssetItem[] | undefined)?.filter((a) => a.group_name === group.name).length ?? 0}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEditGroup('edit', group)}>
                          {t('common.edit')}
                        </Button>
                        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteGroupConfirm(group)}>
                          {t('common.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* Create/Edit Group modal */}
      {editGroupModal && (
        <Modal
          open={!!editGroupModal}
          onClose={() => { setEditGroupModal(null); setGroupName(''); setGroupDescription('') }}
          title={editGroupModal.mode === 'create' ? t('assets.createGroup') : t('assets.editGroup')}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setEditGroupModal(null); setGroupName(''); setGroupDescription('') }}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveGroup} disabled={!groupName.trim()}>{t('common.save')}</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              label={t('assets.groupName')}
              value={groupName}
              onChange={setGroupName}
              required
            />
            <Input
              label={t('assets.groupDescription')}
              value={groupDescription}
              onChange={setGroupDescription}
            />
          </div>
        </Modal>
      )}

      {/* Delete Group confirmation */}
      <ConfirmDialog
        open={!!deleteGroupConfirm}
        title={t('assets.deleteGroup')}
        message={t('assets.deleteGroupConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (deleteGroupConfirm) {
            deleteGroupMutation.mutate(deleteGroupConfirm.id)
          }
        }}
        onCancel={() => setDeleteGroupConfirm(null)}
        variant="danger"
      />

      {/* Assign Group modal */}
      <Modal
        open={!!assignGroupAsset}
        onClose={() => { setAssignGroupAsset(null); setAssignGroupId('') }}
        title={t('assets.assignGroup')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAssignGroupAsset(null); setAssignGroupId('') }}>{t('common.cancel')}</Button>
            <Button onClick={handleAssignGroup}>{t('common.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            {String(assignGroupAsset?.hostname ?? '')}
          </div>
          <Select
            label={t('assets.group')}
            value={assignGroupId}
            onChange={setAssignGroupId}
            options={[
              { label: t('assets.noGroup'), value: '' },
              ...groupsList.map((g) => ({ label: g.name, value: String(g.id) })),
            ]}
          />
        </div>
      </Modal>

      {/* Create Asset modal */}
      <Modal
        open={createAssetOpen}
        onClose={() => setCreateAssetOpen(false)}
        title={t('assets.addAsset')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateAssetOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!newHostname.trim()) return
              createAssetMutation.mutate({
                hostname: newHostname.trim(),
                mac: newMac.trim() || undefined,
                host_ips: newIps.join(',') || undefined,
                os_name: newOsName || undefined,
                os_version: newOsVersion.trim() || undefined,
                arch: newArch || undefined,
                platform: newPlatform.trim() || undefined,
                status: newStatus,
                group_id: newGroupId ? Number(newGroupId) : undefined,
                tags: newTags.join(',') || undefined,
                location: newLocation.trim() || undefined,
                owner: newOwner.trim() || undefined,
                inventory_status: newInventoryStatus,
                source: 'manual',
                device_type: newDeviceType || undefined,
                is_virtualization_host: newIsVirtualizationHost || undefined,
                cmdb_criticality: newCmdbCriticality || undefined,
                cmdb_environment: newCmdbEnvironment || undefined,
              })
            }} disabled={!newHostname.trim() || createAssetMutation.isPending}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label={t('assets.hostname')}
              value={newHostname}
              onChange={setNewHostname}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.ipAddress')}</label>
            <IpListEditor ips={newIps} onChange={setNewIps} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Input
              label={t('assets.macAddress')}
              value={newMac}
              onChange={setNewMac}
            />
            <Select
              label={t('assets.osName')}
              value={newOsName}
              onChange={setNewOsName}
              options={[
                { label: '—', value: '' },
                { label: 'Linux', value: 'Linux' },
                { label: 'Windows', value: 'Windows' },
                { label: 'macOS', value: 'macOS' },
                { label: 'Other', value: 'Other' },
              ]}
            />
            <Input
              label={t('assets.osVersion')}
              value={newOsVersion}
              onChange={setNewOsVersion}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Select
              label={t('assets.architecture')}
              value={newArch}
              onChange={setNewArch}
              options={[
                { label: '—', value: '' },
                { label: 'x86_64', value: 'x86_64' },
                { label: 'ARM64', value: 'aarch64' },
                { label: 'ARM', value: 'arm' },
                { label: 'Other', value: 'other' },
              ]}
            />
            <Input
              label={t('assets.platform')}
              value={newPlatform}
              onChange={setNewPlatform}
            />
            <Select
              label={t('common.status')}
              value={newStatus}
              onChange={setNewStatus}
              options={[
                { label: t('common.active'), value: 'active' },
                { label: t('common.inactive'), value: 'inactive' },
                { label: t('common.pending'), value: 'pending' },
              ]}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.tags')}</label>
            <TagInput tags={newTags} onChange={setNewTags} suggestions={(existingTags as string[]) ?? []} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <Input label={t('assets.location')} value={newLocation} onChange={setNewLocation} />
            <Input label={t('assets.owner')} value={newOwner} onChange={setNewOwner} />
            <Select label={t('assets.inventoryStatus')} value={newInventoryStatus} onChange={setNewInventoryStatus}
              options={INVENTORY_STATUS_OPTIONS.map(o => ({ label: inventoryStatusLabel(o.value, t), value: o.value }))}
            />
          </div>
          <Select label={t('assets.group')} value={newGroupId} onChange={setNewGroupId}
            options={[
              { label: t('assets.noGroup'), value: '' },
              ...groupsList.map((g) => ({ label: g.name, value: String(g.id) })),
            ]}
          />
            {/* CMDB Fusion Fields for Create */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
              CMDB
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label={t('assets.deviceType')}
                value={newDeviceType}
                onChange={setNewDeviceType}
                options={DEVICE_TYPE_OPTIONS.map(o => ({ label: t(`assets.deviceTypeLabels.${o.value}`) === `assets.deviceTypeLabels.${o.value}` ? o.value : t(`assets.deviceTypeLabels.${o.value}`), value: o.value }))}
              />
              <Select
                label={t('assets.criticality')}
                value={newCmdbCriticality}
                onChange={setNewCmdbCriticality}
                options={[{ label: '—', value: '' }, ...CRITICALITY_OPTIONS.map(o => ({ label: t(`assets.criticalityLabels.${o.value}`), value: o.value }))]}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label={t('assets.environment')}
                value={newCmdbEnvironment}
                onChange={setNewCmdbEnvironment}
                options={[{ label: '—', value: '' }, ...ENVIRONMENT_OPTIONS.map(o => ({ label: t(`assets.environmentLabels.${o.value}`), value: o.value }))]}
              />
              {newDeviceType === 'server' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                  <input
                    type="checkbox"
                    checked={newIsVirtualizationHost}
                    onChange={(e) => setNewIsVirtualizationHost(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }} onClick={() => setNewIsVirtualizationHost(!newIsVirtualizationHost)}>
                    {t('assets.virtualizationHost')}
                  </label>
                </div>
              )}
            </div>
        </div>
      </Modal>

      {/* Network Scan Modal */}
      <Modal
        open={scanOpen}
        onClose={closeScanModal}
        title={t('assets.scanNetwork')}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step 1: Config */}
          {scanStep === 'config' && (
            <>
              {/* Auto-detected network info */}
              {networkInfo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('assets.networkInterface')}</div>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{networkInfo.interface || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('assets.gateway')}</div>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{networkInfo.gateway || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('assets.ipRange')}</div>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{networkInfo.network || '—'}</div>
                  </div>
                </div>
              )}

              <Input
                label={t('assets.ipRange')}
                value={ipRange}
                onChange={setIpRange}
                placeholder="192.168.0.0/24"
              />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" icon={<Search size={16} />} onClick={detectNetwork}>
                  {t('assets.detectNetwork')}
                </Button>
                <Button icon={<Radar size={16} />} onClick={startScan} disabled={!ipRange.trim()}>
                  {t('assets.scanNetwork')}
                </Button>
              </div>

              {scanError && (
                <div style={{ padding: '12px', background: 'var(--color-danger-bg, #fef2f2)', borderRadius: '8px', color: 'var(--color-danger)', fontSize: '14px' }}>
                  {scanError}
                </div>
              )}
            </>
          )}

          {/* Step 2: Scanning */}
          {scanStep === 'scanning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '32px 0' }}>
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {t('assets.scanInProgress')}
              </div>
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${scanProgress}%`, background: 'var(--color-accent)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {scanProgress}%
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {scanStep === 'results' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {t('assets.scanComplete')}
                  {scanHosts.length > 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                      {scanHosts.length} {t('assets.hostsFound')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="secondary" size="sm" onClick={selectAllHosts}>
                    {t('assets.selectAll')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={deselectAllHosts}>
                    {t('assets.deselectAll')}
                  </Button>
                </div>
              </div>

              {scanHosts.length === 0 ? (
                <EmptyState title={t('assets.noNewHosts')} />
              ) : (
                <>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {t('assets.selectHosts')}
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ width: '40px', padding: '8px' }}>
                          <input
                            type="checkbox"
                            checked={selectedHosts.size === scanHosts.length && scanHosts.length > 0}
                            onChange={() => selectedHosts.size === scanHosts.length ? deselectAllHosts() : selectAllHosts()}
                          />
                        </th>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.hostname')}</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.ipAddress')}</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.macAddress')}</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('assets.deviceType')}</th>
                        <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHosts.map((host, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', background: selectedHosts.has(i) ? 'var(--color-accent-bg, rgba(99,102,241,0.05))' : 'transparent' }}>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedHosts.has(i)}
                              onChange={() => toggleHostSelection(i)}
                            />
                          </td>
                          <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                            {host.hostname || '—'}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                            {host.ip}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                            {host.mac || '—'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Badge variant={host.device_type === 'Unknown' ? 'default' : 'info'}>
                              {host.device_type || 'Unknown'}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Badge variant="success">{t('assets.newHost')}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.osName')}</label>
                      <select value={importOsName} onChange={(e) => setImportOsName(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}>
                        <option value="">—</option>
                        <option value="Linux">Linux</option>
                        <option value="Windows">Windows</option>
                        <option value="macOS">macOS</option>
                        <option value="Other">Autre</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('assets.osVersion')}</label>
                      <input type="text" value={importOsVersion} onChange={(e) => setImportOsVersion(e.target.value)} placeholder="ex: 22.04"
                        style={{ width: '100%', padding: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => { setScanStep('config'); setScanError(''); }}>
                      {t('common.back')}
                    </Button>
                    <Button
                      onClick={() => importHosts(scanHosts.filter((_, i) => selectedHosts.has(i)).map(h => ({ ...h, os_name: importOsName, os_version: importOsVersion })))}
                      disabled={selectedHosts.size === 0}
                    >
                      {t('assets.importSelected')} ({selectedHosts.size})
                    </Button>
                    <Button onClick={() => importHosts(scanHosts.map(h => ({ ...h, os_name: importOsName, os_version: importOsVersion })))}>
                      {t('assets.importAll')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}