import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui'
import { cmdbApi, cmdbGrcApi, grcBridgeApi, capabilitiesApi } from '../api'
import {
  Database, Server, Monitor, Network, Box, AlertTriangle,
  LayoutGrid, List, Link2, ExternalLink,
  ChevronDown, ChevronRight, Router, Smartphone, Printer, Wifi,
  AppWindow, Globe as GlobeIcon, ChevronRightSquare, Shield, Download
} from 'lucide-react'

type ViewMode = 'list' | 'tree' | 'map'

interface TreeNode {
  id: number
  parent_id: number | null
  asset_name: string
  asset_type: string
  device_type: string
  hostname: string | null
  ip_address: string | null
  mac_address: string | null
  criticality: string | null
  environment: string | null
  status: string | null
  owner: string | null
  location: string | null
  tier_level?: string | null
  network_zone?: string | null
  agent_id?: string | null
  children: TreeNode[]
}

// ── RTO/RPO conversion helpers ──
function _minutesToUnit(minutes: number): string {
  if (minutes <= 0) return 'minutes'
  if (minutes % 1440 === 0) return 'days'
  if (minutes % 60 === 0) return 'hours'
  return 'minutes'
}
function _minutesToValue(minutes: number): number | '' {
  if (minutes <= 0) return ''
  if (minutes % 1440 === 0) return minutes / 1440
  if (minutes % 60 === 0) return minutes / 60
  return minutes
}
function _valueToMinutes(value: number | '', unit: string): number | null {
  if (value === '' || value === null) return null
  const v = Number(value)
  if (isNaN(v) || v <= 0) return null
  if (unit === 'days') return v * 1440
  if (unit === 'hours') return v * 60
  return v
}
function _formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '-'
  if (minutes % 1440 === 0) return `${minutes / 1440} jour(s)`
  if (minutes % 60 === 0) return `${minutes / 60} heure(s)`
  return `${minutes} min`
}

// ── Category & Type constants ──
const CATEGORIES: Record<string, string> = {
  hardware: 'Matériel',
  software: 'Software',
}

const HARDWARE_TYPES: Record<string, string> = {
  server_bare: 'Serveur physique',
  server_vm: 'Serveur virtuel (VM)',
  container: 'Conteneur',
  network_switch: 'Switch réseau',
  network_router: 'Routeur',
  firewall: 'Pare-feu',
  firewall_cluster: 'Cluster pare-feu',
  load_balancer: 'Répartiteur de charge',
  storage_nas: 'Stockage NAS',
  storage_san: 'Stockage SAN',
  wifi_ap: "Point d'accès WiFi",
  workstation: 'Poste de travail',
  laptop: 'Ordinateur portable',
  tablet: 'Tablette',
  phone_ip: 'Téléphone IP',
  printer: 'Imprimante',
  camera: 'Caméra de surveillance',
  other_hardware: 'Autre matériel',
}

const SOFTWARE_TYPES: Record<string, string> = {
  application: 'Application',
  app_business: 'Application métier (ERP, CRM)',
  app_web: 'Site web / Portail',
  database: 'Base de données',
  saas: 'Service Cloud (SaaS)',
  middleware: 'Middleware / ESB',
  monitoring: 'Outil de supervision',
  siem: 'SIEM / SOC',
  security_suite: 'Solution de sécurité (AV, EDR)',
  backup: 'Solution de sauvegarde',
  identity: "Gestion d'identités (IAM, AD)",
  collaboration: 'Collaboration (messagerie, teams)',
  dev_platform: 'Environnement de développement',
  hypervisor: 'Hyperviseur',
  other_software: 'Autre logiciel',
}

const OS_OPTIONS: Record<string, string> = {
  windows_server_2025: 'Windows Server 2025',
  windows_server_2022: 'Windows Server 2022',
  windows_server_2019: 'Windows Server 2019',
  windows_server_2016: 'Windows Server 2016',
  windows_11: 'Windows 11',
  windows_10: 'Windows 10',
  debian_12: 'Debian 12 (Bookworm)',
  debian_11: 'Debian 11 (Bullseye)',
  ubuntu_24_04: 'Ubuntu 24.04 LTS',
  ubuntu_22_04: 'Ubuntu 22.04 LTS',
  rhel_9: 'RHEL 9',
  rhel_8: 'RHEL 8',
  alma_9: 'AlmaLinux 9',
  rocky_9: 'Rocky Linux 9',
  proxmox_ve_8: 'Proxmox VE 8',
  esxi_8: 'VMware ESXi 8',
  esxi_7: 'VMware ESXi 7',
  fortios: 'FortiOS (Fortinet)',
  ios_xe: 'Cisco IOS XE',
  other_os: 'Autre OS',
}

const OS_REQUIRED_TYPES = ['server_bare', 'server_vm', 'container']

/** Determine category from an asset_type value */
function getCategoryFromType(assetType: string): string {
  if (HARDWARE_TYPES[assetType]) return 'hardware'
  if (SOFTWARE_TYPES[assetType]) return 'software'
  // Legacy mapping for old values
  if (['server', 'vm', 'container', 'network_device', 'router', 'switch', 'firewall', 'firewall_cluster', 'endpoint', 'load_balancer', 'storage_cluster', 'cloud_vm', 'cloud_account', 'printer', 'phone', 'wifi_ap'].includes(assetType)) return 'hardware'
  if (['application', 'database', 'website'].includes(assetType)) return 'software'
  return 'hardware'
}

/** Get the display label for a type key */
function getTypeLabel(typeKey: string): string {
  if (HARDWARE_TYPES[typeKey]) return HARDWARE_TYPES[typeKey]
  if (SOFTWARE_TYPES[typeKey]) return SOFTWARE_TYPES[typeKey]
  return typeKey
}

const DEVICE_TYPE_ICONS: Record<string, typeof Server> = {
  server: Server,
  server_bare: Server,
  vm: Monitor,
  server_vm: Monitor,
  container: Box,
  network_device: Network,
  network_switch: Network,
  router: Router,
  network_router: Router,
  switch: Network,
  firewall: Monitor,
  firewall_cluster: Monitor,
  printer: Printer,
  phone: Smartphone,
  phone_ip: Smartphone,
  wifi_ap: Wifi,
  application: AppWindow,
  app_business: AppWindow,
  app_web: GlobeIcon,
  database: Database,
  website: GlobeIcon,
  endpoint: Monitor,
  load_balancer: Network,
  storage_cluster: Database,
  storage_nas: Database,
  storage_san: Database,
  cloud_vm: Monitor,
  cloud_account: GlobeIcon,
  saas: GlobeIcon,
  monitoring: Monitor,
  siem: Monitor,
  security_suite: Shield,
  backup: Database,
  identity: Shield,
  collaboration: AppWindow,
  dev_platform: Box,
  hypervisor: Box,
  other: Box,
  other_hardware: Box,
  other_software: Box,
  camera: Monitor,
  tablet: Smartphone,
  laptop: Monitor,
  workstation: Monitor,
}

const ENV_COLORS: Record<string, { bg: string; text: string }> = {
  production: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
  staging: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  development: { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
  test: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
}

const CRIT_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
  high: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  medium: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  low: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  archived: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  Tier_0: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
  Tier_1: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  Tier_2: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  Non_defini: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const ZONE_COLORS: Record<string, { bg: string; text: string }> = {
  DMZ: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
  Production: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  Interne: { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
  Administration: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  Non_defini: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const HOSTING_COLORS: Record<string, { bg: string; text: string }> = {
  'On-Premise': { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
  SaaS: { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
  IaaS: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  PaaS: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
}

const DATA_CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  public: { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  internal: { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
  confidential: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  secret: { bg: 'rgba(239,68,68,0.15)', text: 'var(--color-danger)' },
}

const RECOVERY_COLORS: Record<string, { bg: string; text: string }> = {
  'Active-Active': { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  'Active-Passive': { bg: 'rgba(59,130,246,0.15)', text: 'var(--color-info)' },
  'Backup-Restoration': { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  None: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const SUPPORT_COLORS: Record<string, { bg: string; text: string }> = {
  '24/7': { bg: 'rgba(34,197,94,0.15)', text: 'var(--color-success)' },
  '5/7_HO': { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  Aucun: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
}

const DATA_CLASS_LABELS: Record<string, string> = {
  public: 'Public',
  internal: 'Interne',
  confidential: 'Confidentiel',
  secret: 'Secret',
}

const RECOVERY_LABELS: Record<string, string> = {
  'Active-Active': 'Active-Active',
  'Active-Passive': 'Active-Passive',
  'Backup-Restoration': 'Backup-Restoration',
  None: 'Aucune',
}

const SUPPORT_LABELS: Record<string, string> = {
  '24/7': '24/7',
  '5/7_HO': '5/7 HO',
  Aucun: 'Aucun',
}

const DICP_LABELS: Record<string, string> = { dicp_d: 'Disponibilité (D)', dicp_i: 'Intégrité (I)', dicp_c: 'Confidentialité (C)', dicp_p: 'Preuve (P)' }

function EnvBadge({ env }: { env: string }) {
  const { t } = useTranslation()
  const colors = ENV_COLORS[env] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = t(`cmdb.environmentLabels.${env}`) === `cmdb.environmentLabels.${env}` ? env : t(`cmdb.environmentLabels.${env}`)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function CritBadge({ crit }: { crit: string }) {
  const { t } = useTranslation()
  const colors = CRIT_COLORS[crit] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = t(`cmdb.criticalityLabels.${crit}`) === `cmdb.criticalityLabels.${crit}` ? crit : t(`cmdb.criticalityLabels.${crit}`)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const colors = STATUS_COLORS[status] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = t(`cmdb.statusLabels.${status}`) === `cmdb.statusLabels.${status}` ? status : t(`cmdb.statusLabels.${status}`)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const colors = TIER_COLORS[tier] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const display = tier.replace('_', ' ')
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {display}
    </span>
  )
}

function ZoneBadge({ zone }: { zone: string }) {
  const colors = ZONE_COLORS[zone] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {zone.replace('_', ' ')}
    </span>
  )
}

function HostingBadge({ hosting }: { hosting: string }) {
  const colors = HOSTING_COLORS[hosting] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {hosting}
    </span>
  )
}

function DataClassBadge({ value }: { value: string }) {
  const colors = DATA_CLASS_COLORS[value] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = DATA_CLASS_LABELS[value] ?? value
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function RecoveryBadge({ value }: { value: string }) {
  const colors = RECOVERY_COLORS[value] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = RECOVERY_LABELS[value] ?? value
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function AgentBadge({ agentId, status }: { agentId: string | null | undefined; status?: string }) {
  if (!agentId || agentId === '') return null
  const isActive = status === 'active'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)',
      color: isActive ? 'var(--color-success)' : '#f97316',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? 'var(--color-success)' : '#f97316' }} />
      Agent
    </span>
  )
}

function SupportBadge({ value }: { value: string }) {
  const colors = SUPPORT_COLORS[value] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const label = SUPPORT_LABELS[value] ?? value
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '12px', fontWeight: 600,
      padding: '2px 10px', borderRadius: '9999px', color: colors.text,
      background: colors.bg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function GrcSectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      borderTop: '2px solid var(--color-border)', paddingTop: '12px', marginTop: '8px',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      {icon}
      {title}
    </div>
  )
}

function GrcDetailSectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      borderTop: '2px solid var(--color-border)', paddingTop: '10px', marginTop: '10px',
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      {icon}
      {title}
    </div>
  )
}

function DeviceTypeIcon({ type }: { type: string }) {
  const Icon = DEVICE_TYPE_ICONS[type] ?? Box
  return <Icon size={16} style={{ marginRight: '6px', flexShrink: 0 }} />
}

function DeviceTypeLabel({ type }: { type: string }) {
  const label = getTypeLabel(type)
  return <>{label}</>
}

// ── Tree Node Component ──
function TreeNodeRow({ node, depth, onSelect, expandedIds, toggleExpand }: {
  node: TreeNode
  depth: number
  onSelect: (node: TreeNode) => void
  expandedIds: Set<number>
  toggleExpand: (id: number) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const status = node.status ?? 'active'
  const statusColor = STATUS_COLORS[status] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          paddingLeft: `${depth * 20 + 8}px`, paddingRight: '12px',
          paddingTop: '6px', paddingBottom: '6px',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer', background: depth % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)',
        }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse toggle */}
        <span
          style={{ width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default' }}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id) }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
          ) : <span style={{ width: '14px' }} />}
        </span>
        <DeviceTypeIcon type={node.device_type || node.asset_type} />
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.asset_name}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
          color: statusColor.text, background: statusColor.bg, whiteSpace: 'nowrap',
        }}>
          {status}
        </span>
        <Badge variant="default"><DeviceTypeLabel type={node.asset_type} /></Badge>
        {node.criticality && <CritBadge crit={node.criticality} />}
        {node.tier_level && String(node.tier_level) !== 'Non_defini' && <TierBadge tier={String(node.tier_level)} />}
        <AgentBadge agentId={String(node.agent_id ?? '')} status={String(node.status ?? '')} />
        {node.location && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            {node.location}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && node.children.map((child) => (
        <TreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          onSelect={onSelect}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
        />
      ))}
    </>
  )
}

// ── Map View: Horizontal Org Chart ──
function MapNode({ node, onSelect }: { node: TreeNode; onSelect: (n: TreeNode) => void }) {
  const dt = node.device_type || node.asset_type
  const Icon = DEVICE_TYPE_ICONS[dt] ?? Box
  const critColors = CRIT_COLORS[node.criticality ?? ''] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' }
  const catLabel = getTypeLabel(dt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => onSelect(node)}
        style={{
          padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
          border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
          minWidth: '140px', textAlign: 'center', transition: 'box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
          <Icon size={16} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {node.asset_name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(107,114,128,0.12)', color: 'var(--color-text-secondary)' }}>
            {catLabel}
          </span>
          {node.criticality && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '9999px', color: critColors.text, background: critColors.bg }}>
              {node.criticality}
            </span>
          )}
        </div>
        {node.location && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {node.location}
          </div>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <>
          <div style={{ width: '2px', height: '20px', background: 'var(--color-border)' }} />
          <div style={{ display: 'flex', gap: '24px', position: 'relative' }}>
            {node.children.length > 1 && (
              <div style={{
                position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
                width: `calc(100% - 48px)`, height: '2px', background: 'var(--color-border)',
              }} />
            )}
            {node.children.map((child) => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <MapNode node={child} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function CmdbPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [typeFilter, setTypeFilter] = useState('')
  const [envFilter, setEnvFilter] = useState('')
  const [criticalityFilter, setCriticalityFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showCreate, setShowCreate] = useState(false)
  const [editingCi, setEditingCi] = useState<Record<string, unknown> | null>(null)
  const [selectedCi, setSelectedCi] = useState<Record<string, unknown> | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // Form state
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('hardware')
  const [formType, setFormType] = useState('server_bare')
  const [formDeviceType, setFormDeviceType] = useState('server_bare')
  const [formOsChoice, setFormOsChoice] = useState('')
  const [formOsLocked, setFormOsLocked] = useState(false)
  const [formEnv, setFormEnv] = useState('production')
  const [formCriticality, setFormCriticality] = useState('medium')
  const [formDoc, setFormDoc] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formAssetIds, setFormAssetIds] = useState<number[]>([])
  const [formIpAddress, setFormIpAddress] = useState('')
  const [formMacAddress, setFormMacAddress] = useState('')
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [formHostname, setFormHostname] = useState('')
  const [formLocation, setFormLocation] = useState('')

  // GRC form state
  const [formTierLevel, setFormTierLevel] = useState('Non_defini')
  const [formNetworkZone, setFormNetworkZone] = useState('Non_defini')
  const [formResponsableTeam, setFormResponsableTeam] = useState('')
  const [formHostingType, setFormHostingType] = useState('')
  const [formBusinessOwner, setFormBusinessOwner] = useState('')
  const [formDicpD, setFormDicpD] = useState(0)
  const [formDicpI, setFormDicpI] = useState(0)
  const [formDicpC, setFormDicpC] = useState(0)
  const [formDicpP, setFormDicpP] = useState(0)
  const [formRgpdRegistry, setFormRgpdRegistry] = useState(false)
  const [formCapabilities, setFormCapabilities] = useState<string[]>([])
  const [formAppVersion, setFormAppVersion] = useState('')
  // GRC Phase 2 form state
  const [formDataClassification, setFormDataClassification] = useState('')
  const [formHasPri, setFormHasPri] = useState(false)
  const [formPriDocumentUrl, setFormPriDocumentUrl] = useState('')
  const [formRtoTargetMinutes, setFormRtoTargetMinutes] = useState<number | ''>('')
  const [formRtoUnit, setFormRtoUnit] = useState('minutes')
  const [formRpoTargetMinutes, setFormRpoTargetMinutes] = useState<number | ''>('')
  const [formRpoUnit, setFormRpoUnit] = useState('minutes')
  const [formRecoveryStrategy, setFormRecoveryStrategy] = useState('')
  const [formLastTestDate, setFormLastTestDate] = useState('')
  const [formEolDate, setFormEolDate] = useState('')
  const [formEoslDate, setFormEoslDate] = useState('')
  const [formProviderVendor, setFormProviderVendor] = useState('')
  const [formMaintenanceContractRef, setFormMaintenanceContractRef] = useState('')
  const [formSupportLevel, setFormSupportLevel] = useState('')
  const [formLastVulnerabilityScan, setFormLastVulnerabilityScan] = useState('')
  const [formPatchPolicyGroup, setFormPatchPolicyGroup] = useState('')

  const { data: cis, isLoading } = useQuery({
    queryKey: ['cmdb', typeFilter, envFilter],
    queryFn: () => cmdbApi.list({ type: typeFilter || undefined, environment: envFilter || undefined } as Record<string, string>).then((r) => r.data),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['cmdb', 'stats'],
    queryFn: () => cmdbApi.stats().then((r) => r.data),
  })

  const { data: grcStats } = useQuery({
    queryKey: ['cmdb', 'grc-stats'],
    queryFn: () => cmdbGrcApi.stats().then((r) => r.data),
  })

  // Catalogue des capacités (mapping auto)
  const { data: capCatalog } = useQuery({
    queryKey: ['cmdb', 'capability-catalog'],
    queryFn: () => capabilitiesApi.catalog().then((r) => r.data),
  })
  const capabilityCatalog: { capability: string; label: string }[] = (capCatalog as any)?.items ?? []

  const { data: ciDetail } = useQuery({
    queryKey: ['cmdb', 'detail', selectedCi?.id],
    queryFn: () => {
      const id = Number(selectedCi!.id)
      if (id < 0) {
        return cmdbGrcApi.getAsset(Math.abs(id)).then((r) => r.data)
      }
      return cmdbApi.get(id).then((r) => r.data)
    },
    enabled: !!selectedCi,
  })

  // Compliance score for selected CI
  const { data: complianceScore, refetch: refetchScore } = useQuery({
    queryKey: ['grc', 'compliance-score', selectedCi?.id],
    queryFn: () => grcBridgeApi.assetComplianceScore(Number(selectedCi!.id)).then((r) => r.data as Record<string, unknown>),
    enabled: !!selectedCi,
  })

  // Auto-associate mutation
  const autoAssociateMutation = useMutation({
    mutationFn: () => grcBridgeApi.autoAssociate(Number(selectedCi!.id)),
    onSuccess: (res) => {
      const data = res.data as Record<string, unknown>
      toast('success', String(data.links_created ?? data.total_links ?? 0) + ' exigences auto-associees')
      refetchScore()
      qc.invalidateQueries({ queryKey: ['cmdb'] })
    },
    onError: () => toast('error', 'Erreur lors de l\'auto-association'),
  })

  const { data: treeData } = useQuery({
    queryKey: ['cmdb', 'tree'],
    queryFn: () => cmdbApi.tree().then((r) => r.data),
    enabled: viewMode === 'tree' || viewMode === 'map',
  })

  const { data: availableParents } = useQuery({
    queryKey: ['cmdb', 'available-parents', editingCi?.id ?? showCreate ? 'create' : ''],
    queryFn: () => cmdbApi.availableParents(editingCi ? Number(editingCi.id) : undefined).then((r) => r.data),
    enabled: showCreate || !!editingCi,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => cmdbApi.create(data),
    onSuccess: (resp: any) => {
      // Capacités: les envoyer après création (l'event-driven crée les liens auto)
      const newId = resp?.data?.id
      if (newId && formCapabilities.length > 0) {
        capabilitiesApi.setForAsset(newId, formCapabilities).catch(() => {})
      }
      qc.invalidateQueries({ queryKey: ['cmdb'] }); setShowCreate(false); resetForm(); toast('success', t('cmdb.createSuccess'))
    },
    onError: () => toast('error', t('cmdb.createError')),
  })

  const grcUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => cmdbGrcApi.updateAsset(id, data),
    onSuccess: (_resp: any, vars: { id: number; data: Record<string, unknown> }) => {
      // Capacités: les mettre à jour après le save de l'asset (auto-liens si ajout)
      const editId = Math.abs(Number(vars.id))
      capabilitiesApi.setForAsset(editId, formCapabilities).catch(() => {})
      qc.invalidateQueries({ queryKey: ['cmdb'] }); qc.invalidateQueries({ queryKey: ['cmdb', 'grc-stats'] }); setEditingCi(null); resetForm(); toast('success', t('common.save') ?? 'Enregistré')
    },
    onError: () => toast('error', t('cmdb.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      // Negative ID = standalone CMDB asset, positive = agent
      if (id < 0) {
        return cmdbGrcApi.deleteAsset(Math.abs(id))
      }
      return cmdbApi.delete(id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cmdb'] }); toast('success', t('cmdb.deleteSuccess')); setSelectedCi(null) },
    onError: () => toast('error', t('cmdb.deleteError')),
  })

  function resetForm() {
    setFormName(''); setFormCategory('hardware'); setFormType('server_bare'); setFormDeviceType('server_bare'); setFormOsChoice(''); setFormOsLocked(false); setFormEnv('production'); setFormCriticality('medium')
    setFormDoc(''); setFormDescription(''); setFormStatus('active'); setFormAssetIds([])
    setFormIpAddress(''); setFormMacAddress(''); setFormParentId(null); setFormHostname(''); setFormLocation('')
    setFormTierLevel('Non_defini'); setFormNetworkZone('Non_defini'); setFormResponsableTeam('')
    setFormHostingType(''); setFormBusinessOwner('')
    setFormDicpD(0); setFormDicpI(0); setFormDicpC(0); setFormDicpP(0); setFormRgpdRegistry(false); setFormAppVersion(''); setFormCapabilities([])
    // Phase 2 resets
    setFormDataClassification(''); setFormHasPri(false); setFormPriDocumentUrl('')
    setFormRtoTargetMinutes(''); setFormRpoTargetMinutes(''); setFormRecoveryStrategy('')
    setFormLastTestDate(''); setFormEolDate(''); setFormEoslDate('')
    setFormProviderVendor(''); setFormMaintenanceContractRef(''); setFormSupportLevel('')
    setFormLastVulnerabilityScan(''); setFormPatchPolicyGroup('')
  }

  function openEditModal(ci: Record<string, unknown>) {
    setEditingCi(ci)
    setFormName(String(ci.asset_name ?? ''))
    // Charger les capacités déclarées de l'asset
    capabilitiesApi.getForAsset(Number(ci.id)).then((r) => {
      setFormCapabilities((r.data as any)?.capabilities ?? [])
    }).catch(() => setFormCapabilities([]))
    // Determine category & type from asset_type/device_type
    const assetType = String(ci.asset_type ?? '')
    const deviceType = String(ci.device_type ?? '')
    // Map legacy types to new types
    const legacyMap: Record<string, string> = {
      'server': 'server_bare',
      'vm': 'server_vm',
      'network_device': 'network_switch',
      'endpoint': 'workstation',
    }
    // First try asset_type, then device_type with legacy mapping
    const mappedAsset = legacyMap[assetType] || assetType
    const mappedDevice = legacyMap[deviceType] || deviceType
    const effectiveType = HARDWARE_TYPES[mappedAsset] || SOFTWARE_TYPES[mappedAsset] ? mappedAsset
      : HARDWARE_TYPES[mappedDevice] || SOFTWARE_TYPES[mappedDevice] ? mappedDevice
      : 'server_bare'
    const category = getCategoryFromType(effectiveType)
    setFormCategory(category)
    setFormType(effectiveType)
    setFormDeviceType(effectiveType)
    // OS: if agent provides os_name, pre-fill and lock
    const hasAgent = ci.agent_id != null && String(ci.agent_id) !== ''
    const osName = String(ci.os_name ?? '')
    if (hasAgent && osName) {
      setFormOsChoice(osName)
      setFormOsLocked(true)
    } else {
      setFormOsChoice(osName)
      setFormOsLocked(false)
    }
    setFormEnv(String(ci.environment ?? 'production'))
    setFormCriticality(String(ci.criticality ?? 'medium'))
    setFormResponsableTeam(String(ci.responsable_team ?? ''))
    setFormDoc(String(ci.documentation ?? ''))
    setFormDescription(String(ci.notes ?? ''))
    setFormStatus(String(ci.status ?? 'active'))
    setFormIpAddress(String(ci.ip_address ?? ''))
    setFormMacAddress(String(ci.mac_address ?? ''))
    setFormParentId(ci.parent_id != null ? Number(ci.parent_id) : null)
    setFormHostname(String(ci.hostname ?? ''))
    setFormLocation(String(ci.location ?? ''))
    const ids = String(ci.asset_ids ?? '').split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
    setFormAssetIds(ids)
    // GRC fields
    setFormTierLevel(String(ci.tier_level ?? 'Non_defini'))
    setFormNetworkZone(String(ci.network_zone ?? 'Non_defini'))
    setFormResponsableTeam(String(ci.responsable_team ?? ''))
    setFormHostingType(String(ci.hosting_type ?? ''))
    setFormBusinessOwner(String(ci.business_owner ?? ''))
    setFormDicpD(Number(ci.dicp_d ?? 0))
    setFormDicpI(Number(ci.dicp_i ?? 0))
    setFormDicpC(Number(ci.dicp_c ?? 0))
    setFormDicpP(Number(ci.dicp_p ?? 0))
    setFormRgpdRegistry(Boolean(ci.rgpd_registry))
    setFormAppVersion(String(ci.app_version ?? ''))
    // GRC Phase 2 fields
    setFormDataClassification(String(ci.data_classification ?? ''))
    setFormHasPri(Boolean(ci.has_pri))
    setFormPriDocumentUrl(String(ci.pri_document_url ?? ''))
    setFormRtoTargetMinutes(ci.rto_target_minutes != null ? _minutesToValue(Number(ci.rto_target_minutes)) : '')
    setFormRtoUnit(ci.rto_target_minutes != null ? _minutesToUnit(Number(ci.rto_target_minutes)) : 'minutes')
    setFormRpoTargetMinutes(ci.rpo_target_minutes != null ? _minutesToValue(Number(ci.rpo_target_minutes)) : '')
    setFormRpoUnit(ci.rpo_target_minutes != null ? _minutesToUnit(Number(ci.rpo_target_minutes)) : 'minutes')
    setFormRecoveryStrategy(String(ci.recovery_strategy ?? ''))
    setFormLastTestDate(String(ci.last_test_date ?? ''))
    setFormEolDate(String(ci.eol_date ?? ''))
    setFormEoslDate(String(ci.eosl_date ?? ''))
    setFormProviderVendor(String(ci.provider_vendor ?? ''))
    setFormMaintenanceContractRef(String(ci.maintenance_contract_ref ?? ''))
    setFormSupportLevel(String(ci.support_level ?? ''))
    setFormLastVulnerabilityScan(String(ci.last_vulnerability_scan ?? ''))
    setFormPatchPolicyGroup(String(ci.patch_policy_group ?? ''))
  }

  function openCreateModal() {
    resetForm()
    setShowCreate(true)
  }

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Auto-expand first level
  useMemo(() => {
    if (treeData && expandedIds.size === 0) {
      const firstLevel = (treeData as TreeNode[]).map(n => n.id)
      if (firstLevel.length > 0) setExpandedIds(new Set(firstLevel))
    }
  }, [treeData])

  const statsData = stats as Record<string, unknown> | undefined
  const totalCi = Number(statsData?.total ?? 0)
  const byEnv = (statsData?.by_environment ?? {}) as Record<string, number>
  const byCriticality = (statsData?.by_criticality ?? {}) as Record<string, number>
  const noLinkedAssets = Number(statsData?.no_linked_assets ?? 0)
  const criticalCount = Number(byCriticality?.critical ?? 0)
  const prodCount = Number(byEnv?.production ?? 0)

  const grcStatsData = grcStats as Record<string, unknown> | undefined
  const byTier = (grcStatsData?.by_tier ?? {}) as Record<string, number>
  const byZone = (grcStatsData?.by_zone ?? {}) as Record<string, number>

  const filteredCis = ((cis ?? []) as Record<string, unknown>[]).filter((ci) => {
    if (typeFilter && !typeFilter.startsWith('__') && ci.asset_type !== typeFilter && ci.device_type !== typeFilter) return false
    if (envFilter && ci.environment !== envFilter) return false
    if (criticalityFilter && ci.criticality !== criticalityFilter) return false
    return true
  })

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: '— Matériel —', value: '__hw_header__' },
    ...Object.entries(HARDWARE_TYPES).map(([k, v]) => ({ label: v, value: k })),
    { label: '— Software —', value: '__sw_header__' },
    ...Object.entries(SOFTWARE_TYPES).map(([k, v]) => ({ label: v, value: k })),
  ]

  const hardwareTypeOptions = Object.entries(HARDWARE_TYPES).map(([k, v]) => ({ label: v, value: k }))
  const softwareTypeOptions = Object.entries(SOFTWARE_TYPES).map(([k, v]) => ({ label: v, value: k }))
  const categoryTypeOptions = formCategory === 'hardware' ? hardwareTypeOptions : softwareTypeOptions
  const osSelectOptions = Object.entries(OS_OPTIONS).map(([k, v]) => ({ label: v, value: k }))
  const showOsSelect = OS_REQUIRED_TYPES.includes(formType)

  const envOptions = [
    { label: t('common.all'), value: '' },
    { label: t('cmdb.environmentLabels.production'), value: 'production' },
    { label: t('cmdb.environmentLabels.staging'), value: 'staging' },
    { label: t('cmdb.environmentLabels.development'), value: 'development' },
    { label: t('cmdb.environmentLabels.test'), value: 'test' },
  ]

  const critOptions = [
    { label: t('common.all'), value: '' },
    { label: t('cmdb.criticalityLabels.critical'), value: 'critical' },
    { label: t('cmdb.criticalityLabels.high'), value: 'high' },
    { label: t('cmdb.criticalityLabels.medium'), value: 'medium' },
    { label: t('cmdb.criticalityLabels.low'), value: 'low' },
  ]

  const columns = [
    { key: 'asset_name', label: t('common.name') },
    { key: 'asset_type', label: t('cmdb.category') },
    { key: 'environment', label: t('cmdb.environment') },
    { key: 'criticality', label: t('cmdb.criticality') },
    { key: 'responsable_team', label: 'Équipe responsable' },
    { key: 'status', label: t('cmdb.status') },
  ]

  // Parent select options
  const parentOptions = useMemo(() => {
    const parents = (availableParents ?? []) as Record<string, unknown>[]
    return [
      { label: t('cmdb.noParent'), value: '__none__' },
      ...parents.map(p => ({
        label: `${String(p.asset_name ?? '')} (${getTypeLabel(String(p.device_type ?? p.asset_type ?? 'server_bare'))})`,
        value: String(p.id),
      })),
    ]
  }, [availableParents, t])

  // Form JSX shared between create/edit
  function renderForm(_isEdit: boolean) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Section 1 - Informations */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('cmdb.title')} — Informations
        </div>
        <Input label={t('common.name')} value={formName} onChange={setFormName} required />
        {formCategory === 'hardware' && (
          <Input label="Hostname" value={formHostname} onChange={setFormHostname} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <Select label="Catégorie" value={formCategory} onChange={(v: string) => {
            setFormCategory(v)
            // Reset type when category changes
            const firstType = v === 'hardware' ? 'server_bare' : 'app_business'
            setFormType(firstType)
            setFormDeviceType(firstType)
            setFormOsChoice('')
          }} options={Object.entries(CATEGORIES).map(([k, v]) => ({ label: v, value: k }))} />
          <Select label="Type" value={formType} onChange={(v: string) => {
            setFormType(v)
            setFormDeviceType(v)
            // Reset OS if type no longer supports it
            if (!OS_REQUIRED_TYPES.includes(v)) setFormOsChoice('')
          }} options={categoryTypeOptions} />
          {OS_REQUIRED_TYPES.includes(formType) && (
            formOsLocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>OS (fourni par l'agent)</label>
                <input
                  type="text"
                  value={formOsChoice}
                  readOnly
                  style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ) : (
              <Select
                label="OS"
                value={formOsChoice}
                onChange={setFormOsChoice}
                options={[{ label: '— Sélectionner —', value: '' }, ...osSelectOptions]}
              />
            )
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Select label={t('cmdb.environment')} value={formEnv} onChange={setFormEnv} options={[
            { label: t('cmdb.environmentLabels.production'), value: 'production' },
            { label: t('cmdb.environmentLabels.staging'), value: 'staging' },
            { label: t('cmdb.environmentLabels.development'), value: 'development' },
            { label: t('cmdb.environmentLabels.test'), value: 'test' },
          ]} />
          <Select label={t('cmdb.criticality')} value={formCriticality} onChange={setFormCriticality} options={[
            { label: t('cmdb.criticalityLabels.critical'), value: 'critical' },
            { label: t('cmdb.criticalityLabels.high'), value: 'high' },
            { label: t('cmdb.criticalityLabels.medium'), value: 'medium' },
            { label: t('cmdb.criticalityLabels.low'), value: 'low' },
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Select label={t('cmdb.status')} value={formStatus} onChange={setFormStatus} options={[
            { label: t('cmdb.statusLabels.active'), value: 'active' },
            { label: t('cmdb.statusLabels.archived'), value: 'archived' },
          ]} />
          <Select label={t('cmdb.parent')} value={formParentId != null ? String(formParentId) : '__none__'} onChange={(v) => setFormParentId(v === '__none__' ? null : Number(v))} options={parentOptions} />
        </div>

        {/* Section 2 - Network (hardware only) */}
        {formCategory === 'hardware' && (
        <>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
          Réseau
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input label={t('cmdb.ipAddress')} value={formIpAddress} onChange={setFormIpAddress} placeholder="192.168.1.10" />
          <Input label={t('cmdb.macAddress')} value={formMacAddress} onChange={setFormMacAddress} placeholder="AA:BB:CC:DD:EE:FF" />
        </div>
        </>
        )}

        {/* Section 3 - Meta */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
          Méta
        </div>
        <Select
          label="Équipe responsable"
          value={formResponsableTeam}
          onChange={setFormResponsableTeam}
          options={[
            { label: '— Sélectionner —', value: '' },
            { label: 'Equipe Infra Ops', value: 'Equipe_Infra_Ops' },
            { label: 'SecOps CyberTech', value: 'SecOps_CyberTech' },
            { label: 'RSSI Gouvernance', value: 'RSSI_Gouvernance' },
            { label: 'RH Juridique', value: 'RH_Juridique' },
          ]}
        />
        <Input label={t('cmdb.location')} value={formLocation} onChange={setFormLocation} />
        <Input label={t('cmdb.documentation')} value={formDoc} onChange={setFormDoc} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('cmdb.description')}</label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            style={{
              padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)', outline: 'none', width: '100%',
              boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Section 4 - GRC Infrastructure */}
        {formCategory === 'hardware' && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
              <Shield size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              GRC — Infrastructure
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label="Tier Level *"
                value={formTierLevel}
                onChange={setFormTierLevel}
                title={t('cmdb.tooltips.tierLevel')}
                options={[
                  { label: 'Tier 0 (Critique)', value: 'Tier_0' },
                  { label: 'Tier 1 (Important)', value: 'Tier_1' },
                  { label: 'Tier 2 (Standard)', value: 'Tier_2' },
                  { label: 'Non défini', value: 'Non_defini' },
                ]}
              />
              <Select
                label="Zone réseau *"
                value={formNetworkZone}
                onChange={setFormNetworkZone}
                title={t('cmdb.tooltips.networkZone')}
                options={[
                  { label: 'DMZ', value: 'DMZ' },
                  { label: 'Interne', value: 'Interne' },
                  { label: 'Administration', value: 'Administration' },
                  { label: 'Production', value: 'Production' },
                  { label: 'Non défini', value: 'Non_defini' },
                ]}
              />
            </div>
            <Select
              label="Équipe responsable"
              value={formResponsableTeam}
              onChange={setFormResponsableTeam}
              title={t('cmdb.tooltips.responsableTeam')}
              options={[
                { label: '— Aucune —', value: '' },
                { label: 'Equipe Infra Ops', value: 'Equipe_Infra_Ops' },
                { label: 'SecOps CyberTech', value: 'SecOps_CyberTech' },
                { label: 'RSSI Gouvernance', value: 'RSSI_Gouvernance' },
                { label: 'RH Juridique', value: 'RH_Juridique' },
              ]}
            />
          </>
        )}

        {/* Section 5 - GRC Application (Phase 2: 3 blocs) */}
        {formCategory === 'software' && (
          <>
            {/* Bloc 2 — Conformité Data (BIA / RGPD) */}
            <GrcSectionTitle
              icon={<Shield size={14} />}
              title="Conformité Data (BIA / RGPD)"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label="Classification données *"
                value={formDataClassification}
                onChange={setFormDataClassification}
                title={t('cmdb.tooltips.dataClassification')}
                options={[
                  { label: '— Sélectionner —', value: '' },
                  { label: 'Public', value: 'public' },
                  { label: 'Interne', value: 'internal' },
                  { label: 'Confidentiel', value: 'confidential' },
                  { label: 'Secret', value: 'secret' },
                ]}
              />
              <Select
                label="Type d'hébergement *"
                value={formHostingType}
                onChange={setFormHostingType}
                title={t('cmdb.tooltips.hostingType')}
                options={[
                  { label: '— Sélectionner —', value: '' },
                  { label: 'On-Premise', value: 'On-Premise' },
                  { label: 'SaaS', value: 'SaaS' },
                  { label: 'IaaS', value: 'IaaS' },
                  { label: 'PaaS', value: 'PaaS' },
                ]}
              />
              <Input label="Business Owner *" value={formBusinessOwner} onChange={setFormBusinessOwner} placeholder="Propriétaire métier" title={t('cmdb.tooltips.businessOwner')} />
              <Input label="Version application" value={formAppVersion} onChange={setFormAppVersion} placeholder="ex: 23.04, v2.5.1..." title={t('cmdb.tooltips.appVersion')} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              DICP — Criticité GRC (1-4) * (C obligatoire)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              {(['dicp_d', 'dicp_i', 'dicp_c', 'dicp_p'] as const).map((key) => {
                const val = key === 'dicp_d' ? formDicpD : key === 'dicp_i' ? formDicpI : key === 'dicp_c' ? formDicpC : formDicpP
                const setter = key === 'dicp_d' ? setFormDicpD : key === 'dicp_i' ? setFormDicpI : key === 'dicp_c' ? setFormDicpC : setFormDicpP
                const isRequired = key === 'dicp_c'
                const tooltipKey = key === 'dicp_d' ? 'cmdb.tooltips.dicpD' : key === 'dicp_i' ? 'cmdb.tooltips.dicpI' : key === 'dicp_c' ? 'cmdb.tooltips.dicpC' : 'cmdb.tooltips.dicpP'
                return (
                  <Select
                    key={key}
                    label={DICP_LABELS[key] + (isRequired ? ' *' : '')}
                    value={String(val)}
                    onChange={(v: string) => setter(Number(v))}
                    title={t(tooltipKey)}
                    options={[
                      { label: '—', value: '0' },
                      { label: '1 — Faible', value: '1' },
                      { label: '2 — Moyen', value: '2' },
                      { label: '3 — Élevé', value: '3' },
                      { label: '4 — Critique', value: '4' },
                    ]}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="rgpd_registry"
                checked={formRgpdRegistry}
                onChange={(e) => setFormRgpdRegistry(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="rgpd_registry" title={t('cmdb.tooltips.rgpdRegistry')} style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                Registre RGPD
              </label>
            </div>

          </>
        )}
        {/* Bloc 3 — Continuité & Reprise (hardware only) */}
        {formCategory === 'hardware' && (
        <>
        <GrcSectionTitle
              icon={<Shield size={14} />}
              title="Continuité & Reprise (PCI / PRI)"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select
                label="PRI active ?"
                value={formHasPri ? 'true' : 'false'}
                onChange={(v: string) => setFormHasPri(v === 'true')}
                title={t('cmdb.tooltips.hasPri')}
                options={[
                  { label: 'Oui', value: 'true' },
                  { label: 'Non', value: 'false' },
                ]}
              />
              {formHasPri && (
                <Input label="URL document PRI" value={formPriDocumentUrl} onChange={setFormPriDocumentUrl} placeholder="https://..." title={t('cmdb.tooltips.priDocumentUrl')} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.rto')}>RTO (temps de reprise)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={String(formRtoTargetMinutes)}
                    onChange={(e) => setFormRtoTargetMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="4"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <select value={formRtoUnit} onChange={(e) => setFormRtoUnit(e.target.value)} style={{ width: '120px', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Heures</option>
                    <option value="days">Jours</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.rpo')}>RPO (perte de donnees)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={String(formRpoTargetMinutes)}
                    onChange={(e) => setFormRpoTargetMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="1"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <select value={formRpoUnit} onChange={(e) => setFormRpoUnit(e.target.value)} style={{ width: '120px', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Heures</option>
                    <option value="days">Jours</option>
                  </select>
                </div>
              </div>
              <Select
                label="Stratégie de reprise"
                value={formRecoveryStrategy}
                onChange={setFormRecoveryStrategy}
                title={t('cmdb.tooltips.recoveryStrategy')}
                options={[
                  { label: '— Sélectionner —', value: '' },
                  { label: 'Active-Active', value: 'Active-Active' },
                  { label: 'Active-Passive', value: 'Active-Passive' },
                  { label: 'Backup-Restoration', value: 'Backup-Restoration' },
                  { label: 'Aucune', value: 'None' },
                ]}
              />
              {formHasPri && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.lastTestDate')}>Date dernier test PRI</label>
                <input
                  type="date"
                  value={formLastTestDate}
                  onChange={(e) => setFormLastTestDate(e.target.value)}
                  style={{
                    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                </div>
              )}
            </div>
        </>
        )}

            {/* Bloc 4 — Cycle de vie (MCO / MCS) */}
            <GrcSectionTitle
              icon={<Shield size={14} />}
              title="Cycle de vie (MCO / MCS)"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.eolDate')}>Date EOL</label>
                <input
                  type="date"
                  value={formEolDate}
                  onChange={(e) => setFormEolDate(e.target.value)}
                  style={{
                    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.eoslDate')}>Date EOSL</label>
                <input
                  type="date"
                  value={formEoslDate}
                  onChange={(e) => setFormEoslDate(e.target.value)}
                  style={{
                    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
              <Input label="Fournisseur / Vendor" value={formProviderVendor} onChange={setFormProviderVendor} placeholder="Dell, Microsoft, ..." title={t('cmdb.tooltips.providerVendor')} />
              <Input label="Réf. contrat maintenance" value={formMaintenanceContractRef} onChange={setFormMaintenanceContractRef} placeholder="CT-2024-001" title={t('cmdb.tooltips.maintenanceContractRef')} />
              <Select
                label="Niveau support"
                value={formSupportLevel}
                onChange={setFormSupportLevel}
                title={t('cmdb.tooltips.supportLevel')}
                options={[
                  { label: '— Sélectionner —', value: '' },
                  { label: '24/7', value: '24/7' },
                  { label: '5/7 HO', value: '5/7_HO' },
                  { label: 'Aucun', value: 'Aucun' },
                ]}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }} title={t('cmdb.tooltips.lastVulnerabilityScan')}>Dernier scan vulnérabilités</label>
                <input
                  type="date"
                  value={formLastVulnerabilityScan}
                  onChange={(e) => setFormLastVulnerabilityScan(e.target.value)}
                  style={{
                    padding: '8px 12px', fontSize: '14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <Input label="Groupe politique patch" value={formPatchPolicyGroup} onChange={setFormPatchPolicyGroup} placeholder="critical-patch-group" title={t('cmdb.tooltips.patchPolicyGroup')} />

            {/* Section 6 — Capacités techniques (mapping auto des exigences) */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>
              Capacités techniques — rattachement automatique
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Chaque capacité déclenche automatiquement le rattachement des exigences correspondantes (ex: « Contrôleur de domaine » → toutes les exigences Active Directory).
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {capabilityCatalog.map((c) => {
                const active = formCapabilities.includes(c.capability)
                return (
                  <button
                    key={c.capability}
                    type="button"
                    onClick={() => {
                      setFormCapabilities(active
                        ? formCapabilities.filter(x => x !== c.capability)
                        : [...formCapabilities, c.capability])
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 500,
                      border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-bg-hover)' : 'transparent',
                      color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    title={c.capability}
                  >
                    {active ? '✓' : '+'} {c.label}
                  </button>
                )
              })}
            </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('cmdb.title')}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                background: viewMode === 'list' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--color-text-secondary)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <List size={14} /> {t('cmdb.listView')}
            </button>
            <button
              onClick={() => setViewMode('tree')}
              style={{
                padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                background: viewMode === 'tree' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'tree' ? '#fff' : 'var(--color-text-secondary)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <ChevronRightSquare size={14} /> {t('cmdb.tree')}
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{
                padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                background: viewMode === 'map' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'map' ? '#fff' : 'var(--color-text-secondary)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <LayoutGrid size={14} /> {t('cmdb.map')}
            </button>
          </div>
          {canEdit('admin') && <Button onClick={openCreateModal}>{t('cmdb.createCi')}</Button>}
          <button onClick={() => {
            cmdbGrcApi.exportAssets().then(r => {
              const url = window.URL.createObjectURL(new Blob([r.data]))
              const a = document.createElement('a')
              a.href = url
              a.download = 'cmdb_assets.csv'
              a.click()
              window.URL.revokeObjectURL(url)
            }).catch(() => toast('error', 'Erreur export'))
          }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', fontSize: '14px' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label={t('cmdb.totalCi')} value={totalCi} icon={<Database size={20} />} color="var(--color-accent)" loading={statsLoading} />
        <StatCard label={t('cmdb.criticalityLabels.critical')} value={criticalCount} icon={<AlertTriangle size={20} />} color="var(--color-danger)" loading={statsLoading} />
        <StatCard label={t('cmdb.environmentLabels.production')} value={prodCount} icon={<Server size={20} />} color="var(--color-info)" loading={statsLoading} />
        <StatCard label={t('cmdb.noAssetsLinked')} value={noLinkedAssets} icon={<Link2 size={20} />} color="var(--color-warning)" loading={statsLoading} />
      </div>

      {/* GRC Stats */}
      {(Object.keys(byTier).length > 0 || Object.keys(byZone).length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} /> Répartition par Tier
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['Tier_0', 'Tier_1', 'Tier_2', 'Non_defini'].filter(k => byTier[k] != null).map((tier) => (
                <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <TierBadge tier={tier} />
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{String(byTier[tier])}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Network size={14} /> Répartition par Zone
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['DMZ', 'Interne', 'Administration', 'Production', 'Non_defini'].filter(k => byZone[k] != null).map((zone) => (
                <div key={zone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ZoneBadge zone={zone} />
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{String(byZone[zone])}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('cmdb.category')} value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('cmdb.environment')} value={envFilter} onChange={setEnvFilter} options={envOptions} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('cmdb.criticality')} value={criticalityFilter} onChange={setCriticalityFilter} options={critOptions} />
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          filteredCis.length === 0 && !isLoading ? (
            <EmptyState title={t('cmdb.noCi')} />
          ) : (
            <Table
              columns={columns}
              data={filteredCis}
              loading={isLoading}
              onRowClick={(row) => setSelectedCi(row)}
              renderCell={(col, row) => {
                if (col.key === 'asset_name') {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DeviceTypeIcon type={String(row.device_type ?? row.asset_type ?? '')} />
                      <span style={{ fontWeight: 600 }}>{String(row.asset_name ?? '')}</span>
                      {String(row.tier_level ?? '') !== '' && String(row.tier_level) !== 'Non_defini' ? <TierBadge tier={String(row.tier_level)} /> : null}
                      <AgentBadge agentId={String(row.agent_id ?? '')} status={String(row.status ?? '')} />
                    </div>
                  )
                }
                if (col.key === 'asset_type') {
                  const effectiveType = String(row.device_type ?? row.asset_type ?? '')
                  const label = getTypeLabel(effectiveType)
                  return <Badge variant="default">{label}</Badge>
                }
                if (col.key === 'environment') return <EnvBadge env={String(row.environment ?? 'production')} />
                if (col.key === 'criticality') return <CritBadge crit={String(row.criticality ?? 'medium')} />
                if (col.key === 'status') return <StatusBadge status={String(row.status ?? 'active')} />
                return String(row[col.key] ?? '')
              }}
            />
          )
        )}

        {/* Tree View */}
        {viewMode === 'tree' && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              padding: '10px 16px', background: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <ChevronRightSquare size={16} style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {t('cmdb.tree')} — {(treeData as TreeNode[] | undefined)?.length ?? 0} {t('cmdb.totalCi').toLowerCase()}
              </span>
            </div>
            {(!treeData || (treeData as TreeNode[]).length === 0) ? (
              <EmptyState title={t('cmdb.noCi')} />
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {(treeData as TreeNode[]).map((node) => (
                  <TreeNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    onSelect={(n) => setSelectedCi(n as unknown as Record<string, unknown>)}
                    expandedIds={expandedIds}
                    toggleExpand={toggleExpand}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <div style={{
            border: '1px solid var(--color-border)', borderRadius: '8px',
            padding: '24px', overflow: 'auto',
            minHeight: '400px',
          }}>
            {(!treeData || (treeData as TreeNode[]).length === 0) ? (
              <EmptyState title={t('cmdb.noCi')} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
                {(treeData as TreeNode[]).map((node) => (
                  <MapNode
                    key={node.id}
                    node={node}
                    onSelect={(n) => setSelectedCi(n as unknown as Record<string, unknown>)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Create Modal */}
      {showCreate && canEdit('admin') && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('cmdb.createCi')} size="xl" footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              const baseData: Record<string, unknown> = {
                asset_name: formName, asset_type: formType, device_type: formDeviceType,
                environment: formEnv, criticality: formCriticality, responsable_team: formResponsableTeam,
                documentation: formDoc, notes: formDescription, status: formStatus,
                asset_ids: formAssetIds.join(','), ip_address: formIpAddress,
                mac_address: formMacAddress, parent_id: formParentId, hostname: formHostname,
                location: formLocation,
              }
              // OS: only send os_name if it's a server/container type and NOT locked by agent
              if (showOsSelect && formOsChoice && !formOsLocked) {
                baseData.os_name = formOsChoice
              }
              if (formCategory === 'hardware') {
                baseData.tier_level = formTierLevel
                baseData.network_zone = formNetworkZone
                baseData.responsable_team = formResponsableTeam
              }
              if (formCategory === 'software') {
                baseData.hosting_type = formHostingType
                baseData.business_owner = formBusinessOwner
                baseData.dicp_d = formDicpD
                baseData.dicp_i = formDicpI
                baseData.dicp_c = formDicpC
                baseData.dicp_p = formDicpP
                baseData.rgpd_registry = formRgpdRegistry
                baseData.app_version = formAppVersion
                baseData.data_classification = formDataClassification
              }
              // Phase 2 fields (all asset types)
              baseData.has_pri = formHasPri
              baseData.pri_document_url = formPriDocumentUrl
              baseData.rto_target_minutes = _valueToMinutes(formRtoTargetMinutes, formRtoUnit)
              baseData.rpo_target_minutes = _valueToMinutes(formRpoTargetMinutes, formRpoUnit)
              baseData.recovery_strategy = formRecoveryStrategy
              baseData.last_test_date = formLastTestDate || null
              baseData.eol_date = formEolDate || null
              baseData.eosl_date = formEoslDate || null
              baseData.provider_vendor = formProviderVendor
              baseData.maintenance_contract_ref = formMaintenanceContractRef
              baseData.support_level = formSupportLevel
              baseData.last_vulnerability_scan = formLastVulnerabilityScan || null
              baseData.patch_policy_group = formPatchPolicyGroup
              createMutation.mutate(baseData)
            }} disabled={!formName}>{t('common.create')}</Button>
          </>
        }>
          {renderForm(false)}
        </Modal>
      )}

      {/* Edit Modal */}
      {editingCi && canEdit('admin') && (
        <Modal open={!!editingCi} onClose={() => { setEditingCi(null); resetForm() }} title={t('cmdb.createCi').replace('Créer', 'Modifier').replace('Create', 'Edit')} size="xl" footer={
          <>
            <Button variant="secondary" onClick={() => { setEditingCi(null); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              const baseData: Record<string, unknown> = {
                asset_name: formName, asset_type: formType, device_type: formDeviceType,
                environment: formEnv, criticality: formCriticality, responsable_team: formResponsableTeam,
                documentation: formDoc, notes: formDescription, status: formStatus,
                asset_ids: formAssetIds.join(','), ip_address: formIpAddress,
                mac_address: formMacAddress, parent_id: formParentId, hostname: formHostname,
                location: formLocation,
              }
              // OS: only send os_name if it's a server/container type and NOT locked by agent
              if (showOsSelect && formOsChoice && !formOsLocked) {
                baseData.os_name = formOsChoice
              }
              // Add GRC fields based on category
              if (formCategory === 'hardware') {
                baseData.tier_level = formTierLevel
                baseData.network_zone = formNetworkZone
                baseData.responsable_team = formResponsableTeam
              }
              if (formCategory === 'software') {
                baseData.hosting_type = formHostingType
                baseData.business_owner = formBusinessOwner
                baseData.dicp_d = formDicpD
                baseData.dicp_i = formDicpI
                baseData.dicp_c = formDicpC
                baseData.dicp_p = formDicpP
                baseData.rgpd_registry = formRgpdRegistry
                baseData.app_version = formAppVersion
                baseData.data_classification = formDataClassification
              }
              // Phase 2 fields (all asset types)
              baseData.has_pri = formHasPri
              baseData.pri_document_url = formPriDocumentUrl
              baseData.rto_target_minutes = _valueToMinutes(formRtoTargetMinutes, formRtoUnit)
              baseData.rpo_target_minutes = _valueToMinutes(formRpoTargetMinutes, formRpoUnit)
              baseData.recovery_strategy = formRecoveryStrategy
              baseData.last_test_date = formLastTestDate || null
              baseData.eol_date = formEolDate || null
              baseData.eosl_date = formEoslDate || null
              baseData.provider_vendor = formProviderVendor
              baseData.maintenance_contract_ref = formMaintenanceContractRef
              baseData.support_level = formSupportLevel
              baseData.last_vulnerability_scan = formLastVulnerabilityScan || null
              baseData.patch_policy_group = formPatchPolicyGroup
              grcUpdateMutation.mutate({ id: Math.abs(Number(editingCi.id)), data: baseData })
            }} disabled={!formName}>{t('common.save')}</Button>
          </>
        }>
          {renderForm(true)}
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedCi && (
        <Modal open={!!selectedCi} onClose={() => setSelectedCi(null)} title={t('cmdb.ciDetail')} size="xl">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* CI Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <DeviceTypeIcon type={String(ciDetail?.asset_type ?? selectedCi.asset_type ?? ciDetail?.device_type ?? selectedCi.device_type ?? '')} />
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {String(ciDetail?.asset_name ?? selectedCi.asset_name ?? '')}
              </span>
              <StatusBadge status={String(ciDetail?.status ?? selectedCi.status ?? 'active')} />
              <AgentBadge agentId={String(ciDetail?.agent_id ?? selectedCi.agent_id ?? '')} status={String(ciDetail?.status ?? selectedCi.status ?? '')} />
            </div>

            {/* Parent Info */}
            {(ciDetail as Record<string, unknown>)?.parent_info && (() => {
              const parent = (ciDetail as Record<string, unknown>).parent_info as Record<string, unknown>
              if (!parent) return null
              return (
                <div style={{
                  padding: '12px', borderRadius: '8px', background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={14} /> {t('cmdb.parentInfo')}
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    onClick={() => { setSelectedCi(parent) }}
                  >
                    <DeviceTypeIcon type={String(parent.device_type ?? parent.asset_type ?? 'server')} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{String(parent.asset_name ?? '')}</span>
                    {parent.ip_address != null && String(parent.ip_address) !== '' && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{String(parent.ip_address)}</span>}
                    {parent.criticality != null && String(parent.criticality) !== '' && <CritBadge crit={String(parent.criticality)} />}
                  </div>
                </div>
              )
            })()}

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {(() => {
                const detailType = String(ciDetail?.asset_type ?? selectedCi.asset_type ?? ciDetail?.device_type ?? selectedCi.device_type ?? '')
                const catKey = getCategoryFromType(detailType)
                const catLabel = CATEGORIES[catKey] ?? catKey
                const typeLabel = getTypeLabel(detailType)
                const osName = String(ciDetail?.os_name ?? selectedCi.os_name ?? '')
                return (
                  <>
                    <div>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Catégorie</span>
                      <div><Badge variant="default">{catLabel}</Badge></div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Type</span>
                      <div><Badge variant="default">{typeLabel}</Badge></div>
                    </div>
                    {osName && (
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>OS</span>
                        <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{osName}</div>
                      </div>
                    )}
                  </>
                )
              })()}
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.environment')}</span>
                <div><EnvBadge env={String(ciDetail?.environment ?? selectedCi.environment ?? 'production')} /></div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.criticality')}</span>
                <div><CritBadge crit={String(ciDetail?.criticality ?? selectedCi.criticality ?? 'medium')} /></div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Équipe responsable</span>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(ciDetail?.responsable_team ?? selectedCi.responsable_team ?? '-').replace(/_/g, ' ')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Hostname</span>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(ciDetail?.hostname ?? selectedCi.hostname ?? '-')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.location')}</span>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(ciDetail?.location ?? selectedCi.location ?? '-')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.ipAddress')}</span>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{String(ciDetail?.ip_address ?? selectedCi.ip_address ?? '-')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.macAddress')}</span>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{String(ciDetail?.mac_address ?? selectedCi.mac_address ?? '-')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.documentation')}</span>
                <div style={{ color: 'var(--color-text-primary)' }}>
                  {ciDetail?.documentation ? (
                    <a href={String(ciDetail.documentation)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ExternalLink size={14} /> Link
                    </a>
                  ) : '-'}
                </div>
              </div>
            </div>

            {/* GRC Section */}
            {(() => {
              const detail = ciDetail as Record<string, unknown> | null
              const assetType = String(detail?.asset_type ?? selectedCi.asset_type ?? '')
              const effectiveType = String(detail?.device_type ?? selectedCi.device_type ?? assetType)
              const catKey = getCategoryFromType(effectiveType)
              const isInfra = catKey === 'hardware'
              const isApp = catKey === 'software'
              if (!isInfra && !isApp) return null
              return (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> GRC — {isInfra ? 'Infrastructure' : 'Application'}
                  </div>
                  {/* Compliance Score + Auto-associate */}
                  {complianceScore && (() => {
                    const pct = Number(complianceScore.percentage ?? 0)
                    const conforme = Number(complianceScore.conforme ?? 0)
                    const total = Number(complianceScore.total ?? 0)
                    const barColor = pct > 80 ? 'var(--color-success)' : pct > 50 ? '#f97316' : 'var(--color-danger)'
                    return (
                      <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Conformite</span>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: barColor }}>{String(pct)}%</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{String(conforme)}/{String(total)} exigences conformes</div>
                          </div>
                          <button
                            onClick={() => autoAssociateMutation.mutate()}
                            disabled={autoAssociateMutation.isPending}
                            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: autoAssociateMutation.isPending ? 'not-allowed' : 'pointer', opacity: autoAssociateMutation.isPending ? 0.7 : 1, fontWeight: 500 }}
                          >
                            Auto-associer les exigences
                          </button>
                        </div>
                        <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--color-bg-primary)', overflow: 'hidden' }}>
                          <div style={{ width: String(Math.min(pct, 100)) + '%', height: '100%', borderRadius: '4px', background: barColor, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )
                  })()}
                  {isInfra && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.tierLevel')}>Tier Level</span>
                        <div>{detail?.tier_level && String(detail.tier_level) !== 'Non_defini' ? <TierBadge tier={String(detail.tier_level)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>Non défini</span>}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.networkZone')}>Zone réseau</span>
                        <div>{detail?.network_zone && String(detail.network_zone) !== 'Non_defini' ? <ZoneBadge zone={String(detail.network_zone)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>Non défini</span>}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.responsableTeam')}>Équipe responsable</span>
                        <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.responsable_team ?? '-').replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  )}
                  {isApp && (
                    <>
                      {/* Bloc 2 — Conformité Data (applications uniquement) */}
                      <GrcDetailSectionTitle icon={<Shield size={12} />} title="Conformité Data (BIA / RGPD)" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.dataClassification')}>Classification données</span>
                          <div>{detail?.data_classification && String(detail.data_classification) !== '' ? <DataClassBadge value={String(detail.data_classification)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.hostingType')}>Type d'hébergement</span>
                          <div>{detail?.hosting_type ? <HostingBadge hosting={String(detail.hosting_type)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.businessOwner')}>Business Owner</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.business_owner ?? '-')}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.appVersion')}>Version</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.app_version ?? '-')}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.rgpdRegistry')}>Registre RGPD</span>
                          <div>{detail?.rgpd_registry ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Oui</span> : <span style={{ color: 'var(--color-text-secondary)' }}>Non</span>}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', marginTop: '8px' }}>DICP — Criticité</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        {(['dicp_d', 'dicp_i', 'dicp_c', 'dicp_p'] as const).map((key) => {
                          const val = Number((detail ?? {})[key] ?? 0)
                          const label = DICP_LABELS[key]
                          return (
                            <div key={key} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} title={t(key === 'dicp_d' ? 'cmdb.tooltips.dicpD' : key === 'dicp_i' ? 'cmdb.tooltips.dicpI' : key === 'dicp_c' ? 'cmdb.tooltips.dicpC' : 'cmdb.tooltips.dicpP')}>{label}</div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: val >= 3 ? 'var(--color-danger)' : val >= 2 ? '#f97316' : 'var(--color-text-primary)' }}>{val === 1 ? 'Faible' : val === 2 ? 'Modéré' : val === 3 ? 'Élevé' : val === 4 ? 'Critique' : '-'}</div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {/* Bloc 3 — Continuité & Reprise (tous types d actifs) */}
                  <GrcDetailSectionTitle icon={<Shield size={12} />} title="Continuité & Reprise (PCI / PRI)" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.hasPri')}>PRI active</span>
                          <div>{detail?.has_pri ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Oui</span> : <span style={{ color: 'var(--color-text-secondary)' }}>Non</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.priDocumentUrl')}>URL document PRI</span>
                          <div>{detail?.pri_document_url ? <a href={String(detail.pri_document_url)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Lien</a> : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.recoveryStrategy')}>Stratégie de reprise</span>
                          <div>{detail?.recovery_strategy && String(detail.recovery_strategy) !== '' ? <RecoveryBadge value={String(detail.recovery_strategy)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }} title={t('cmdb.tooltips.rto')}>RTO</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{_formatMinutes(detail?.rto_target_minutes != null ? Number(detail.rto_target_minutes) : null)}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>RPO</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{_formatMinutes(detail?.rpo_target_minutes != null ? Number(detail.rpo_target_minutes) : null)}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Dernier test PRI</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{detail?.last_test_date ? String(detail.last_test_date).slice(0, 10) : '-'}</div>
                        </div>
                      </div>

                      {/* Bloc 4 — Cycle de vie & Maintenance */}
                      <GrcDetailSectionTitle icon={<Shield size={12} />} title="Cycle de vie & Maintenance (MCO / MCS)" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Date EOL</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{detail?.eol_date ? String(detail.eol_date).slice(0, 10) : '-'}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Date EOSL</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{detail?.eosl_date ? String(detail.eosl_date).slice(0, 10) : '-'}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Fournisseur</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.provider_vendor ?? '-')}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Réf. contrat maintenance</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.maintenance_contract_ref ?? '-')}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Niveau support</span>
                          <div>{detail?.support_level && String(detail.support_level) !== '' ? <SupportBadge value={String(detail.support_level)} /> : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Dernier scan vuln.</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{detail?.last_vulnerability_scan ? String(detail.last_vulnerability_scan).slice(0, 10) : '-'}</div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Groupe politique patch</span>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail?.patch_policy_group ?? '-')}</div>
                        </div>
                      </div>
                </div>
              )
            })()}

            {/* Description */}
            {(ciDetail?.notes || selectedCi.notes) && (
              <div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('cmdb.description')}</span>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {String(ciDetail?.notes ?? selectedCi.notes ?? '')}
                </div>
              </div>
            )}

            {/* Children */}
            {(ciDetail as Record<string, unknown>)?.children && ((ciDetail as Record<string, unknown>).children as unknown[]).length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} /> {t('cmdb.childrenInfo')} ({((ciDetail as Record<string, unknown>).children as unknown[]).length})
                </h3>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{t('common.name')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{t('cmdb.deviceType')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{t('cmdb.criticality')}</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{t('cmdb.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((ciDetail as Record<string, unknown>).children as Record<string, unknown>[]).map((child, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => { setSelectedCi(child) }}>
                          <td style={{ padding: '8px 12px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <DeviceTypeIcon type={String(child.device_type ?? child.asset_type ?? '')} />
                              <span style={{ fontWeight: 500 }}>{String(child.asset_name ?? '')}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '14px' }}><DeviceTypeLabel type={String(child.device_type ?? child.asset_type ?? '')} /></td>
                          <td style={{ padding: '8px 12px' }}>{child.criticality ? <CritBadge crit={String(child.criticality)} /> : '-'}</td>
                          <td style={{ padding: '8px 12px' }}>{child.status ? <StatusBadge status={String(child.status)} /> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Linked Assets */}
            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {canEdit('admin') && (
                <Button onClick={() => { if (ciDetail) { openEditModal(ciDetail); setSelectedCi(null) } }} disabled={!ciDetail}>{t('common.edit') ?? 'Edit'}</Button>
              )}
              {canEdit('admin') && (
                <Button variant="danger" onClick={() => { deleteMutation.mutate(Number(selectedCi.id)); setSelectedCi(null) }}>{t('common.delete')}</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}