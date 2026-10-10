import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Badge, EmptyState } from '../../components/ui'
import { usersApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from '../../i18n/useTranslation'

// Matrice Rôle d'accès × Module: read / write / delete / export.
// Source: role_permissions (Phase 1 RBAC) — administrable ici.
// Superadmin: implicitement full (non modifiable).
// Effet immédiat: require_permission relit la DB à chaque requête.

const ROLE_LABEL_KEYS: Record<string, string> = {
  superadmin: 'rolesPermissions.superadmin',
  admin: 'rolesPermissions.admin',
  soc_analyst: 'rolesPermissions.socAnalyst',
  auditor: 'Auditeur',
  dpo: 'DPO',
  rssi: 'RSSI',
  compliance_officer: 'rolesPermissions.complianceOfficer',
  viewer: 'rolesPermissions.viewer',
}

const MODULE_LABEL_KEYS: Record<string, string> = {
  events: 'nav.events',
  alerts: 'nav.alerts',
  cases: 'rolesPermissions.cases',
  agents: 'nav.agents',
  yara: 'nav.yara',
  sigma: 'nav.sigma',
  correlation: 'nav.correlation',
  threat_intel: 'nav.threatIntel',
  assets: 'nav.assets',
  users: 'nav.users',
  compliance: 'nav.compliance',
  governance: 'nav.governance',
  risks: 'rolesPermissions.risks',
  reporting: 'nav.reporting',
  soar: 'nav.soar',
}

const ACTIONS: { key: 'can_read' | 'can_write' | 'can_delete' | 'can_export'; labelKey: string }[] = [
  { key: 'can_read', labelKey: 'rolesPermissions.read' },
  { key: 'can_write', labelKey: 'rolesPermissions.write' },
  { key: 'can_delete', labelKey: 'rolesPermissions.delete' },
  { key: 'can_export', labelKey: 'Export' },
]

export function RolesPermissionsAdmin() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState('viewer')

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => usersApi.getRoles().then(r => r.data),
  })

  const roles: any[] = rolesData || []
  const current = roles.find((r: any) => r.role === selectedRole)
  const permissions: any[] = current?.permissions || []
  const isSuperadmin = selectedRole === 'superadmin'

  // Modules désactivés globalement (page Modules): lignes grisées dans la matrice
  const { data: modulesStatus } = useQuery({
    queryKey: ['modules-status'],
    queryFn: () => usersApi.getModulesStatus().then(r => r.data),
  })
  const disabledModules = new Set<string>()
  for (const m of (modulesStatus as any[] | undefined) ?? []) {
    if (!m.is_active) disabledModules.add(m.module)
  }

  const saveMutation = useMutation({
    mutationFn: ({ module, perm }: { module: string; perm: Record<string, boolean> }) =>
      usersApi.updateRoleModule(selectedRole, module, perm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || t('rolesPermissions.updateError')),
  })

  const toggle = (module: string, action: string, checked: boolean) => {
    const row = permissions.find((p: any) => p.module === module)
    if (!row) return
    const next: Record<string, boolean> = {
      can_read: row.can_read,
      can_write: row.can_write,
      can_delete: row.can_delete,
      can_export: row.can_export,
      [action]: checked,
    }
    saveMutation.mutate({ module, perm: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{t('rolesPermissions.title')}</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          Matrice des permissions par rôle d'accès et module — l'affinage par type de compte.
          Ne remplace pas l'activation globale : pour couper un module pour toute l organisation, utilisez la page « Modules ».
          Modifications à effet immédiat. Le superadmin possède implicitement toutes les permissions.
        </p>
      </div>

      {/* Sélecteur de rôle */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {roles.map((r: any) => (
          <button
            key={r.role}
            onClick={() => setSelectedRole(r.role)}
            style={{
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
              fontWeight: selectedRole === r.role ? 600 : 400,
              border: `1px solid ${selectedRole === r.role ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: selectedRole === r.role ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
            }}
          >
            {t(ROLE_LABEL_KEYS[r.role] || r.role)}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : permissions.length === 0 ? (
          <EmptyState title="Aucune permission définie pour ce rôle" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('rolesPermissions.module')}</th>
                  {ACTIONS.map(a => (
                    <th key={a.key} style={{ textAlign: 'center', padding: '10px 12px' }}>{a.labelKey.includes('.') ? t(a.labelKey) : a.labelKey}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p: any) => {
                  const isDisabledModule = disabledModules.has(p.module)
                  return (
                  <tr key={p.module} style={{ borderBottom: '1px solid var(--color-border)', opacity: isDisabledModule ? 0.45 : 1 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {t(MODULE_LABEL_KEYS[p.module] || p.module)}
                      {isDisabledModule && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          (module désactivé — voir page Modules)
                        </span>
                      )}
                    </td>
                    {ACTIONS.map(a => (
                      <td key={a.key} style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(p[a.key])}
                          disabled={isSuperadmin || saveMutation.isPending}
                          onChange={(e) => toggle(p.module, a.key, e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: isSuperadmin ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {isSuperadmin && (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <Badge variant="warning">{t('rolesPermissions.locked')}</Badge> Le superadmin possède implicitement toutes les permissions sur tous les modules.
          </div>
        )}
      </Card>
    </div>
  )
}