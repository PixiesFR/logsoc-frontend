import type { LucideIcon } from 'lucide-react'
import {
  CalendarCheck,
  History,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Zap,
  Shield,
  Crosshair,
  Sigma,
  Target,
  GitBranch,
  Search,
  Monitor,
  Map,
  CheckSquare,
  Server,
  FileCheck,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
  BrainCircuit,
  Bot,
  Radio,
  FileBarChart,
  Shuffle,
  Globe,
  Layers,
  Bell,
  Siren,
  TriangleAlert,
  BookOpen,
  ClipboardList,
  Briefcase,
  Gavel,
  FileText,
  Users,
  GitCommitHorizontal,
  Settings,
  Database,
  UserCog,
  ShieldAlert,
  FileWarning,
  ClipboardCheck,
  Link,
  HardDrive,
  Calendar,
  Tag,
  GraduationCap,
  UsersRound,
  Lightbulb,
} from 'lucide-react'
import type { NavSection } from '../../stores'

export interface NavItem {
  key: string
  label: string
  path: string
  icon: LucideIcon
  minRole: string
  hidden?: boolean
}

export interface NavSectionConfig {
  key: NavSection
  label: string
  icon: LucideIcon
  items: NavItem[]
}

const navConfig: NavSectionConfig[] = [
  {
    key: 'governance',
    label: 'nav.governance',
    icon: Gavel,
    items: [
      // Governance items
      { key: 'policies', label: 'nav.policies', path: '/governance/policies', icon: FileText, minRole: 'viewer' },
      { key: 'govActionPlan', label: 'nav.govActionPlan', path: '/governance/action-plan', icon: ClipboardList, minRole: 'rssi' },
      { key: 'govActionPlanRssi', label: 'nav.rssiDashboard', path: '/governance/rssi-dashboard', icon: ShieldCheck, minRole: 'rssi' },
      { key: 'homologations', label: 'nav.homologations', path: '/governance/homologations', icon: ShieldCheck, minRole: 'rssi' },
      { key: 'govDocumentation', label: 'nav.govDocumentation', path: '/governance/documentation', icon: BookOpen, minRole: 'rssi' },
      // Risk items (merged from risques section)
      { key: 'riskRegister', label: 'nav.riskRegister', path: '/risques', icon: TriangleAlert, minRole: 'viewer' },
      { key: 'incidents', label: 'nav.incidents', path: '/incidents', icon: AlertTriangle, minRole: 'viewer' },
      // Hidden governance items
      { key: 'dataClassification', label: 'nav.dataClassification', path: '/governance/data-classification', icon: Tag, minRole: 'viewer', hidden: true },
      { key: 'trainings', label: 'nav.trainings', path: '/governance/trainings', icon: GraduationCap, minRole: 'viewer', hidden: true },
      { key: 'committee', label: 'nav.committee', path: '/governance/committee', icon: Users, minRole: 'rssi', hidden: true },
      { key: 'decisions', label: 'nav.decisions', path: '/governance/decisions', icon: Gavel, minRole: 'rssi', hidden: true },
      { key: 'raci', label: 'nav.raci', path: '/governance/raci', icon: GitCommitHorizontal, minRole: 'rssi', hidden: true },
      { key: 'vendors', label: 'nav.vendors', path: '/governance/vendors', icon: UsersRound, minRole: 'viewer', hidden: true },
      { key: 'calendar', label: 'nav.calendar', path: '/governance/calendar', icon: Calendar, minRole: 'viewer', hidden: true },
      // Hidden risk items
      { key: 'runbook', label: 'nav.runbook', path: '/runbook', icon: BookOpen, minRole: 'analyst', hidden: true },
      { key: 'alertRunbooks', label: 'nav.alertRunbooks', path: '/alert-runbooks', icon: ClipboardList, minRole: 'analyst', hidden: true },
      { key: 'mitre', label: 'nav.mitre', path: '/mitre', icon: Target, minRole: 'viewer', hidden: true },
    ],
  },
  {
    key: 'dataProtection',
    label: 'nav.dataProtection',
    icon: ShieldAlert,
    items: [
      { key: 'dpoDashboard', label: 'nav.dpoDashboard', path: '/governance/dpo-dashboard', icon: ShieldAlert, minRole: 'dpo' },
      { key: 'dpoProcessing', label: 'nav.dpoProcessing', path: '/dpo/processing', icon: FileText, minRole: 'dpo' },
      { key: 'dpoBreaches', label: 'nav.dpoBreaches', path: '/dpo/breaches', icon: AlertTriangle, minRole: 'dpo' },
      { key: 'dpoPia', label: 'nav.dpoPia', path: '/dpo/pia', icon: FileWarning, minRole: 'dpo' },
      { key: 'dpoRights', label: 'nav.dpoRights', path: '/dpo/rights', icon: ClipboardList, minRole: 'dpo' },
    ],
  },
  {
    key: 'compliance',
    label: 'nav.compliance',
    icon: CheckSquare,
    items: [
      { key: 'cartography', label: 'nav.cartography', path: '/cartography', icon: Map, minRole: 'viewer' },
      { key: 'compliance', label: 'nav.compliance', path: '/compliance', icon: CheckSquare, minRole: 'viewer' },
      { key: 'complianceInfra', label: 'nav.complianceInfra', path: '/compliance-infra', icon: Server, minRole: 'viewer' },
      { key: 'gdprAudit', label: 'nav.gdprAudit', path: '/gdpr-audit', icon: FileCheck, minRole: 'viewer', hidden: true },
      { key: 'gdprExtended', label: 'nav.gdprExtended', path: '/gdpr-extended', icon: FileSpreadsheet, minRole: 'viewer', hidden: true },
      { key: 'nis2', label: 'nav.nis2', path: '/nis2', icon: Scale, minRole: 'viewer', hidden: true },
      { key: 'dora', label: 'nav.dora', path: '/dora', icon: ShieldCheck, minRole: 'viewer', hidden: true },
      { key: 'iso27001', label: 'nav.iso27001', path: '/iso27001', icon: ShieldAlert, minRole: 'viewer', hidden: true },
      { key: 'aiAct', label: 'nav.aiAct', path: '/ai-act', icon: BrainCircuit, minRole: 'viewer', hidden: true },
      { key: 'soar', label: 'nav.soar', path: '/soar', icon: Bot, minRole: 'analyst', hidden: true },
      { key: 'threatIntel', label: 'nav.threatIntel', path: '/threat-intel', icon: Radio, minRole: 'viewer', hidden: true },
      { key: 'reporting', label: 'nav.reporting', path: '/reporting', icon: FileBarChart, minRole: 'viewer', hidden: true },
      { key: 'requirements', label: 'nav.requirements', path: '/requirements', icon: ClipboardCheck, minRole: 'viewer' },
      { key: 'practices', label: 'nav.practices', path: '/practices', icon: ShieldCheck, minRole: 'viewer' },
      { key: 'businessQuestionnaires', label: 'nav.businessQuestionnaires', path: '/business-questionnaires', icon: ClipboardList, minRole: 'viewer' },
      { key: 'actionPlan', label: 'nav.actionPlan', path: '/compliance/action-plan', icon: ClipboardList, minRole: 'viewer' },
      { key: 'complianceAlerts', label: 'nav.complianceAlerts', path: '/compliance/alerts', icon: AlertTriangle, minRole: 'viewer', hidden: true },
      { key: 'autoRules', label: 'nav.autoRules', path: '/compliance/auto-rules', icon: Settings, minRole: 'admin' },
      { key: 'crossMapping', label: 'nav.crossMapping', path: '/cross-mapping', icon: Shuffle, minRole: 'viewer', hidden: true },
      { key: 'nis2Countries', label: 'nav.nis2Countries', path: '/nis2-countries', icon: Globe, minRole: 'viewer', hidden: true },
      { key: 'frameworks', label: 'nav.frameworks', path: '/frameworks', icon: Layers, minRole: 'viewer', hidden: true },
      { key: 'notifications', label: 'nav.notifications', path: '/notifications', icon: Bell, minRole: 'analyst', hidden: true },
    ],
  },
  {
    key: 'ops',
    label: 'nav.ops',
    icon: Activity,
    items: [
      { key: 'events', label: 'nav.events', path: '/events', icon: Activity, minRole: 'viewer' },
      { key: 'alerts', label: 'nav.alerts', path: '/alerts', icon: AlertTriangle, minRole: 'viewer' },
      { key: 'actions', label: 'nav.actions', path: '/actions', icon: Zap, minRole: 'analyst' },
      { key: 'yaraMatches', label: 'nav.yaraMatches', path: '/yara-matches', icon: Crosshair, minRole: 'viewer' },
      { key: 'ruleSelection', label: 'nav.ruleSelection', path: '/ops/rule-selection', icon: Shield, minRole: 'analyst', hidden: true },
      { key: 'threatHunting', label: 'nav.threatHunting', path: '/threat-hunting', icon: Search, minRole: 'analyst', hidden: true },
      { key: 'actionPlans', label: 'nav.actionPlans', path: '/operations/action-plans', icon: ClipboardCheck, minRole: 'viewer' },
      { key: 'socDashboard', label: 'nav.socDashboard', path: '/dashboard', icon: LayoutDashboard, minRole: 'viewer' },
      { key: 'agentInventory', label: 'nav.agentInventory', path: '/inventory', icon: Monitor, minRole: 'viewer' },
      { key: 'cmdb', label: 'nav.cmdb', path: '/cmdb', icon: Database, minRole: 'admin' },
      { key: 'complianceMatrix', label: 'nav.complianceMatrix', path: '/compliance/matrix', icon: ClipboardList, minRole: 'viewer' },
      { key: 'opsPractices', label: 'nav.opsPractices', path: '/ops/practices', icon: ShieldCheck, minRole: 'viewer' },
    ],
  },
  {
    key: 'audit',
    label: 'nav.audit',
    icon: ClipboardCheck,
    items: [
      { key: 'auditProgram', label: 'nav.auditProgram', path: '/audit/program', icon: CalendarCheck, minRole: 'viewer' },
      { key: 'auditPending', label: 'nav.auditPending', path: '/audit/pending', icon: ClipboardList, minRole: 'viewer' },
      { key: 'auditHistory', label: 'nav.auditHistory', path: '/audit/history', icon: History, minRole: 'viewer' },
    ],
  },
  {
    key: 'crise',
    label: 'nav.crise',
    icon: Siren,
    items: [
      { key: 'crisis', label: 'nav.crisis', path: '/crisis', icon: Siren, minRole: 'rssi' },
      { key: 'crisisPlaybooks', label: 'nav.crisisPlaybooks', path: '/crisis/playbooks', icon: BookOpen, minRole: 'rssi' },
    ],
  },
  {
    key: 'admin',
    label: 'nav.admin',
    icon: Settings,
    items: [
      { key: 'insights', label: 'nav.insights', path: '/insights', icon: Lightbulb, minRole: 'analyst' },
      { key: 'users', label: 'nav.users', path: '/users', icon: Users, minRole: 'admin' },
      { key: 'agentPolicy', label: 'nav.agentPolicy', path: '/agent-policy', icon: UserCog, minRole: 'admin' },
      { key: 'policyAudit', label: 'nav.policyAudit', path: '/policy-audit', icon: ClipboardCheck, minRole: 'admin', hidden: true },
      { key: 'integrations', label: 'nav.integrations', path: '/integrations', icon: Link, minRole: 'admin', hidden: true },
      { key: 'maintenance', label: 'nav.maintenance', path: '/maintenance', icon: HardDrive, minRole: 'admin', hidden: true },
      { key: 'yara', label: 'nav.yara', path: '/yara', icon: Shield, minRole: 'analyst' },
      { key: 'sigma', label: 'nav.sigma', path: '/sigma', icon: Sigma, minRole: 'analyst' },
      { key: 'correlation', label: 'nav.correlation', path: '/correlation', icon: GitBranch, minRole: 'analyst', hidden: true },

      { key: 'agents', label: 'nav.agents', path: '/agents', icon: Monitor, minRole: 'viewer' },
      { key: 'deliverables', label: 'Livrables', path: '/admin/deliverables', icon: ClipboardList, minRole: 'admin' },
      { key: 'services', label: 'Services métier', path: '/admin/services', icon: Briefcase, minRole: 'admin' },
      { key: 'business-roles', label: 'Casquettes métier', path: '/admin/business-roles', icon: Briefcase, minRole: 'admin' },
      { key: 'modules', label: 'Modules', path: '/admin/modules', icon: Shield, minRole: 'admin' },
      { key: 'roles-permissions', label: 'Rôles & Accès', path: '/admin/roles-permissions', icon: Shield, minRole: 'admin' },
      { key: 'committees', label: 'Comités', path: '/admin/committees', icon: Users, minRole: 'admin' },
      { key: 'target-mappings', label: 'Mappage cibles', path: '/admin/target-mappings', icon: Crosshair, minRole: 'admin' },
      { key: 'settings', label: 'nav.settings', path: '/settings', icon: Settings, minRole: 'admin' },
    ],
  },
]

export default navConfig