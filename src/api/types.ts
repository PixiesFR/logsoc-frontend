// API response types for LogSOC

export interface EventStatsSummary {
  total: number
  by_severity: Record<string, number>
  by_service: Record<string, number>
  by_host: Record<string, number>
  events_per_minute: number
}

export interface AlertSummary {
  source: string
  summary: Array<{
    severity: string
    status: string
    count: number
  }>
}

export interface AssetStatsSummary {
  total: number
  by_status: Record<string, number>
  by_os: Record<string, number>
  groups_count: number
}

export interface SystemHealth {
  api: string
  mysql: string
  clickhouse: string
  ollama?: string
  version?: string
}

export interface EventItem {
  id: number
  event_id: string
  received_at: string
  agent_id: string
  source_host: string
  source_ip: string
  service: string
  severity: string
  event: string
  message: string
  raw_message: string
  comm: string
  username: string
  filename: string
  pid: number
  uid: number | null
  dst_ip: string
  dst_port: number | null
  inode: number | null
  os_name: string
  os_version: string
  kernel_version: string
  agent_version: string
  host_ips: string
  tags: string[]
  metadata: Record<string, unknown>
}

export interface AlertItem {
  id: number
  alert_id: string
  title: string
  severity: string
  status: string
  source_host: string
  description: string
  rule_id: string
  created_at: string
  assigned_to: number | null
  llm_analysis: string | null
  sla_first_response_at: string | null
  sla_resolution_at: string | null
  escalation_level: number
  escalated_at: string | null
  first_acknowledged_at: string | null
  closed_at: string | null
  closed_by: number | null
  closure_reason: string | null
  post_mortem: string | null
  related_case_id: number | null
  sla_breached: boolean
}

export interface AssetItem {
  id: number
  agent_id: string
  hostname: string
  platform: string
  os_name: string | null
  os_version: string | null
  arch: string | null
  status: string
  version: string
  ebpf_status: string
  mac: string | null
  cpu_model: string | null
  memory_mb: number | null
  disk_gb: number | null
  group_id: number | null
  group_name: string | null
  last_seen: string
  created_at: string
  host_ips: string | null
  tags: string | null
  location: string | null
  owner: string | null
  source: string | null
  inventory_status: string | null
  // CMDB fusion fields
  device_type: string | null
  parent_id: number | null
  is_virtualization_host: boolean | null
  cmdb_criticality: string | null
  cmdb_environment: string | null
}

export interface AgentHeartbeat {
  id: number
  agent_id: string
  cpu_percent: string | null
  memory_mb: number | null
  wal_segments: number | null
  network_status: string | null
  message: string | null
  received_at: string | null
}

// Paginated response
export interface PaginatedResponse<T> {
  items?: T[]
  total?: number
  page?: number
  page_size?: number
  pages?: number
}