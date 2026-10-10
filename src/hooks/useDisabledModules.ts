import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api'
import { useAuthStore } from '../stores'

// Modules désactivés par l'admin (page Rôles & Accès, option B).
// Un module désactivé est masqué du menu pour tous (sauf superadmin,
// qui garde tout visible). Le superadmin voit aussi les modules désactivés
// car il peut les réactiver — mais le menu reste complet pour lui.
// Requête partagée: une seule requête pour tous les composants de nav.

export function useDisabledModules(): Set<string> {
  const user = useAuthStore((s) => s.user)
  const isSuperadmin = user?.role === 'superadmin'

  const { data } = useQuery({
    queryKey: ['modules-status'],
    queryFn: () => usersApi.getModulesStatus().then(r => r.data),
    staleTime: 60_000,
    enabled: !!user,
  })

  if (isSuperadmin) return new Set()
  const disabled = new Set<string>()
  for (const m of (data as any[] | undefined) ?? []) {
    if (!m.is_active) disabled.add(m.module)
  }
  return disabled
}

// Correspondance clé navConfig -> module backend (les entrées de nav non
// listées ici ne sont pas pilotées par les flags de module).
export const NAV_KEY_TO_MODULE: Record<string, string> = {
  events: 'events',
  alerts: 'alerts',
  cases: 'cases',
  agents: 'agents',
  yara: 'yara',
  sigma: 'sigma',
  correlation: 'correlation',
  'threat-intel': 'threat_intel',
  assets: 'assets',
  users: 'users',
  compliance: 'compliance',
  risks: 'risks',
  reporting: 'reporting',
  soar: 'soar',
  // Gouvernance: toutes les entrées de la section pilotées par le module governance
  policies: 'governance',
  govActionPlan: 'governance',
  govActionPlanRssi: 'governance',
  homologations: 'governance',
  govDocumentation: 'governance',
  dataClassification: 'governance',
  trainings: 'governance',
  committee: 'governance',
  decisions: 'governance',
  raci: 'governance',
  vendors: 'governance',
  calendar: 'governance',
  dpoDashboard: 'governance',
  gdprRegistries: 'governance',
  pia: 'governance',
}