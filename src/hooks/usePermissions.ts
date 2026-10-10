import { useAuthStore } from '../stores'

type Role = 'viewer' | 'analyst' | 'soc_analyst' | 'compliance_officer' | 'auditor' | 'rssi' | 'admin' | 'superadmin' | 'dpo'

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  soc_analyst: 1,
  compliance_officer: 2,
  auditor: 2,
  rssi: 3,
  dpo: 2,
  admin: 4,
  superadmin: 5,
}

function getLevel(role: string): number {
  return ROLE_HIERARCHY[role as Role] ?? -1
}

export function usePermissions() {
  const user = useAuthStore((s) => s.user)

  const role = user?.role ?? 'viewer'
  const level = getLevel(role)

  const hasRole = (required: string): boolean => {
    return level >= getLevel(required)
  }

  const canView = (minRole: string = 'viewer'): boolean => {
    return hasRole(minRole)
  }

  const canEdit = (minRole: string = 'analyst'): boolean => {
    // Auditor role is read-only — never allow edit
    if (role === 'auditor') return false
    return hasRole(minRole)
  }

  const isAdmin = level >= getLevel('admin')
  const isRssi = role === 'rssi' || role === 'admin' || role === 'superadmin'
  const isDpo = role === 'dpo' || role === 'admin' || role === 'superadmin'
  const isAuditor = role === 'auditor'
  // Governance roles: RSSI + DPO + admin can access governance pages
  const isGovernance = isRssi || isDpo

  return { role, hasRole, canView, canEdit, isAdmin, isRssi, isDpo, isAuditor, isGovernance }
}