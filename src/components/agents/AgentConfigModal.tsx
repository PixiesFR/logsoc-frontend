import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { Modal, Button, Input, Select } from '../ui'
import { agentsApi } from '../../api'
import { Plus, X } from 'lucide-react'

// Default config mirrors the backend's _DEFAULT_AGENT_CONFIG
const DEFAULT_CONFIG: AgentConfig = {
  hostname: '',
  log_level: 2,
  modules: { network: true, ebpf: true, journald: true },
  ebpf_probes: { write: true, execve: true, tcp_connect: true, fim: true, open: false, unlink: false },
  interfaces: [],
  yara: { active: true, max_scan_file_mb: 10, scan_timeout_ms: 5000, rule_pull_interval_sec: 300 },
  heartbeat_interval_sec: 60,
  fim: { watch_paths: ['/etc/ssh/sshd_config', '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/crontab'], ignore_paths: [] },
  local_filters: { connect_ignore_ports: [], connect_ignore_ips: [], execve_ignore_comm: [], open_ignore_paths: [], open_ignore_flags: [] },
  wal: { segment_max_size_mb: 50, max_total_size_mb: 500, rotation_max_files: 10 },
  batch: { batch_interval_sec: 30, batch_max_lines: 1000 },
}

interface AgentConfig {
  hostname: string
  log_level: number
  modules: { network: boolean; ebpf: boolean; journald: boolean }
  ebpf_probes: { write: boolean; execve: boolean; tcp_connect: boolean; fim: boolean; open: boolean; unlink: boolean }
  interfaces: string[]
  yara: { active: boolean; max_scan_file_mb: number; scan_timeout_ms: number; rule_pull_interval_sec: number }
  heartbeat_interval_sec: number
  fim: { watch_paths: string[]; ignore_paths: string[] }
  local_filters: { connect_ignore_ports: string[]; connect_ignore_ips: string[]; execve_ignore_comm: string[]; open_ignore_paths: string[]; open_ignore_flags: string[] }
  wal: { segment_max_size_mb: number; max_total_size_mb: number; rotation_max_files: number }
  batch: { batch_interval_sec: number; batch_max_lines: number }
}

interface AgentConfigModalProps {
  agentId: string
  agentHostname: string
  onClose: () => void
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-accent)', marginTop: '16px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid var(--color-border)' }}>
      {children}
    </div>
  )
}

function CheckboxField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (val: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', color: 'var(--color-text-primary)', opacity: disabled ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: '16px', height: '16px', accentColor: 'var(--color-accent)' }}
      />
      {label}
    </label>
  )
}

function StringListEditor({ items, onChange, addLabel, disabled }: { items: string[]; onChange: (items: string[]) => void; addLabel: string; disabled?: boolean }) {
  const [newItem, setNewItem] = useState('')
  const handleAdd = () => {
    const trimmed = newItem.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setNewItem('')
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', flex: 1 }}>{item}</span>
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center' }}
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder={addLabel}
          disabled={disabled}
          style={{ flex: 1, padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
        />
        <button onClick={handleAdd} disabled={disabled} style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, min, max, disabled }: { label: string; value: number; onChange: (val: number) => void; min?: number; max?: number; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: disabled ? 0.5 : 1 }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        disabled={disabled}
        style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )
}

/** Wraps a section with a grayed-out overlay when `disabled` is true */
function DisabledSection({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
      {children}
    </div>
  )
}

export function AgentConfigModal({ agentId, agentHostname, onClose }: AgentConfigModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<AgentConfig>(deepClone(DEFAULT_CONFIG))
  const [originalConfig, setOriginalConfig] = useState<AgentConfig>(deepClone(DEFAULT_CONFIG))

  const { data: configData, isLoading } = useQuery({
    queryKey: ['agent-config', agentId],
    queryFn: () => agentsApi.getConfig(agentId).then((r: any) => r.data),
    enabled: !!agentId,
  })

  useEffect(() => {
    if (configData?.config) {
      const merged = { ...deepClone(DEFAULT_CONFIG), ...configData.config }
      // Deep merge nested objects
      if (configData.config.modules) merged.modules = { ...DEFAULT_CONFIG.modules, ...configData.config.modules }
      if (configData.config.ebpf_probes) merged.ebpf_probes = { ...DEFAULT_CONFIG.ebpf_probes, ...configData.config.ebpf_probes }
      if (configData.config.yara) merged.yara = { ...DEFAULT_CONFIG.yara, ...configData.config.yara }
      if (configData.config.fim) merged.fim = { ...DEFAULT_CONFIG.fim, ...configData.config.fim }
      if (configData.config.local_filters) merged.local_filters = { ...DEFAULT_CONFIG.local_filters, ...configData.config.local_filters }
      if (configData.config.wal) merged.wal = { ...DEFAULT_CONFIG.wal, ...configData.config.wal }
      if (configData.config.batch) merged.batch = { ...DEFAULT_CONFIG.batch, ...configData.config.batch }
      setConfig(merged)
      setOriginalConfig(deepClone(merged))
    }
  }, [configData])

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentsApi.putConfig(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-config', agentId] })
      onClose()
    },
    onError: () => {
      // Error handled via toast in the component
    },
  })

  const handleSave = useCallback(() => {
    saveMutation.mutate(config as unknown as Record<string, unknown>)
  }, [config, saveMutation])

  const handleReset = useCallback(() => {
    setConfig(deepClone(originalConfig))
  }, [originalConfig])

  const updateConfig = useCallback(<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Derived disabled states
  const networkDisabled = !config.modules.network
  const ebpfDisabled = !config.modules.ebpf
  const journaldDisabled = !config.modules.journald
  const yaraDisabled = !config.yara.active
  const fimDisabled = !config.ebpf_probes.fim
  const tcpConnectDisabled = !config.ebpf_probes.tcp_connect

  const LOG_LEVEL_OPTIONS = [
    { value: '0', label: `0 - ${t('agents.logLevelError')}` },
    { value: '1', label: `1 - ${t('agents.logLevelWarn')}` },
    { value: '2', label: `2 - ${t('agents.logLevelInfo')}` },
    { value: '3', label: '3 - Notice' },
    { value: '4', label: `4 - ${t('agents.logLevelDebug')}` },
    { value: '5', label: `5 - ${t('agents.logLevelTrace')}` },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t('agents.configTitle')} — ${agentHostname || agentId.slice(0, 8)}`}
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={handleReset}>{t('agents.resetConfig')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '...' : t('agents.saveConfig')}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
          {/* SECTION 1 - General */}
          <SectionTitle>{t('agents.general')}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label={t('agents.hostname')}
              value={config.hostname}
              onChange={(v: string) => updateConfig('hostname', v)}
              placeholder={agentHostname || 'auto'}
            />
            <Select
              label={t('agents.logLevel')}
              value={String(config.log_level)}
              onChange={(v: string) => updateConfig('log_level', Number(v))}
              options={LOG_LEVEL_OPTIONS}
            />
          </div>

          {/* SECTION 2 - Modules */}
          <SectionTitle>{t('agents.modules')}</SectionTitle>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <CheckboxField label="Network" checked={config.modules.network} onChange={(v: boolean) => updateConfig('modules', { ...config.modules, network: v })} />
            <CheckboxField label="eBPF" checked={config.modules.ebpf} onChange={(v: boolean) => updateConfig('modules', { ...config.modules, ebpf: v })} />
            <CheckboxField label="Journald" checked={config.modules.journald} onChange={(v: boolean) => updateConfig('modules', { ...config.modules, journald: v })} />
          </div>

          {/* SECTION 3 - eBPF Probes */}
          <SectionTitle>{t('agents.probes')}</SectionTitle>
          <DisabledSection disabled={ebpfDisabled}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <CheckboxField label="write" checked={config.ebpf_probes.write} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, write: v })} disabled={ebpfDisabled} />
              <CheckboxField label="execve" checked={config.ebpf_probes.execve} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, execve: v })} disabled={ebpfDisabled} />
              <CheckboxField label="tcp_connect" checked={config.ebpf_probes.tcp_connect} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, tcp_connect: v })} disabled={ebpfDisabled} />
              <CheckboxField label="fim" checked={config.ebpf_probes.fim} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, fim: v })} disabled={ebpfDisabled} />
              <CheckboxField label="open" checked={config.ebpf_probes.open} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, open: v })} disabled={ebpfDisabled} />
              <CheckboxField label="unlink" checked={config.ebpf_probes.unlink} onChange={(v: boolean) => updateConfig('ebpf_probes', { ...config.ebpf_probes, unlink: v })} disabled={ebpfDisabled} />
            </div>
          </DisabledSection>

          {/* SECTION 4 - Network Interfaces */}
          <SectionTitle>{t('agents.interfaces')}</SectionTitle>
          <DisabledSection disabled={networkDisabled}>
            <StringListEditor
              items={config.interfaces}
              onChange={(v: string[]) => updateConfig('interfaces', v)}
              addLabel={t('agents.addInterface')}
              disabled={networkDisabled}
            />
          </DisabledSection>

          {/* SECTION 5 - YARA */}
          <SectionTitle>{t('agents.yara')}</SectionTitle>
          <CheckboxField label={t('agents.yara') + ' ' + t('common.active')} checked={config.yara.active} onChange={(v: boolean) => updateConfig('yara', { ...config.yara, active: v })} />
          <DisabledSection disabled={yaraDisabled}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <NumberField label={t('agents.maxScanFileMb')} value={config.yara.max_scan_file_mb} onChange={(v: number) => updateConfig('yara', { ...config.yara, max_scan_file_mb: v })} min={1} disabled={yaraDisabled} />
              <NumberField label={t('agents.scanTimeoutMs')} value={config.yara.scan_timeout_ms} onChange={(v: number) => updateConfig('yara', { ...config.yara, scan_timeout_ms: v })} min={100} disabled={yaraDisabled} />
              <NumberField label={t('agents.rulePullInterval')} value={config.yara.rule_pull_interval_sec} onChange={(v: number) => updateConfig('yara', { ...config.yara, rule_pull_interval_sec: v })} min={10} disabled={yaraDisabled} />
            </div>
          </DisabledSection>

          {/* SECTION 6 - Heartbeat */}
          <SectionTitle>{t('agents.heartbeat')}</SectionTitle>
          <NumberField label={t('agents.heartbeatInterval')} value={config.heartbeat_interval_sec} onChange={(v: number) => updateConfig('heartbeat_interval_sec', v)} min={5} max={3600} />

          {/* SECTION 7 - FIM */}
          <SectionTitle>{t('agents.fim')}</SectionTitle>
          <DisabledSection disabled={fimDisabled}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.watchPaths')}</div>
                <StringListEditor items={config.fim.watch_paths} onChange={(v: string[]) => updateConfig('fim', { ...config.fim, watch_paths: v })} addLabel={t('agents.addPath')} disabled={fimDisabled} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.ignorePaths')}</div>
                <StringListEditor items={config.fim.ignore_paths} onChange={(v: string[]) => updateConfig('fim', { ...config.fim, ignore_paths: v })} addLabel={t('agents.addPath')} disabled={fimDisabled} />
              </div>
            </div>
          </DisabledSection>

          {/* SECTION 8 - Local Filters */}
          <SectionTitle>{t('agents.filters')}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <DisabledSection disabled={tcpConnectDisabled}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.ignorePorts')}</div>
                <StringListEditor items={config.local_filters.connect_ignore_ports} onChange={(v: string[]) => updateConfig('local_filters', { ...config.local_filters, connect_ignore_ports: v })} addLabel={t('agents.addInterface')} disabled={tcpConnectDisabled} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.ignoreIps')}</div>
                <StringListEditor items={config.local_filters.connect_ignore_ips} onChange={(v: string[]) => updateConfig('local_filters', { ...config.local_filters, connect_ignore_ips: v })} addLabel={t('agents.addPath')} disabled={tcpConnectDisabled} />
              </div>
            </DisabledSection>
            <DisabledSection disabled={journaldDisabled}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.ignoreComm')}</div>
                <StringListEditor items={config.local_filters.execve_ignore_comm} onChange={(v: string[]) => updateConfig('local_filters', { ...config.local_filters, execve_ignore_comm: v })} addLabel={t('agents.addPath')} disabled={journaldDisabled} />
              </div>
            </DisabledSection>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('agents.ignoreFlags') + ' (open)'}</div>
              <StringListEditor items={config.local_filters.open_ignore_flags} onChange={(v: string[]) => updateConfig('local_filters', { ...config.local_filters, open_ignore_flags: v })} addLabel={t('agents.addPath')} />
            </div>
          </div>

          {/* SECTION 9 - Storage (WAL) */}
          <SectionTitle>{t('agents.storage')}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <NumberField label={t('agents.segmentMaxSize')} value={config.wal.segment_max_size_mb} onChange={(v: number) => updateConfig('wal', { ...config.wal, segment_max_size_mb: v })} min={1} />
            <NumberField label={t('agents.maxTotalSize')} value={config.wal.max_total_size_mb} onChange={(v: number) => updateConfig('wal', { ...config.wal, max_total_size_mb: v })} min={10} />
            <NumberField label={t('agents.rotationMaxFiles')} value={config.wal.rotation_max_files} onChange={(v: number) => updateConfig('wal', { ...config.wal, rotation_max_files: v })} min={1} />
          </div>

          {/* SECTION 10 - Batch */}
          <SectionTitle>{t('agents.batch')}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <NumberField label={t('agents.batchInterval')} value={config.batch.batch_interval_sec} onChange={(v: number) => updateConfig('batch', { ...config.batch, batch_interval_sec: v })} min={1} />
            <NumberField label={t('agents.batchMaxLines')} value={config.batch.batch_max_lines} onChange={(v: number) => updateConfig('batch', { ...config.batch, batch_max_lines: v })} min={10} />
          </div>

          {saveMutation.isError && (
            <div style={{ fontSize: '13px', color: 'var(--color-danger)', marginTop: '8px' }}>
              {t('agents.configError')}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}