import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Badge, Modal, Button } from '../../components/ui'
import { usersApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from '../../i18n/useTranslation'

// Administration → Modules: interrupteurs GLOBAUX d'activation.
// Un module désactivé est refusé pour tous (503, sauf superadmin) et
// masqué du menu. Verrou d'accès, PAS un arrêt d'infrastructure
// (l'ingestion et les workers continuent).
// L'affinage par rôle d'accès se fait dans Rôles & Accès (matrice RBAC).

const MODULE_LABELS: Record<string, string> = {
  events: 'Événements',
  alerts: 'Alertes',
  cases: 'Dossiers / Cas',
  agents: 'Agents',
  yara: 'Règles YARA',
  sigma: 'Règles Sigma',
  correlation: 'Corrélation',
  threat_intel: 'Renseignement sur les menaces',
  assets: 'Assets / CMDB',
  users: 'Utilisateurs',
  compliance: 'Conformité',
  governance: 'Gouvernance',
  risks: 'Risques',
  reporting: 'Rapports',
  soar: 'SOAR / Automatisation',
}

// Description et dépendances de chaque module (observées dans le code).
// DEUX NIVEAUX (13/09, après incident cascade Agents → Gouvernance):
// - hard: le module est VIDE/sans objet si l'amont est coupé → cascade +
//   dialogue de confirmation à la désactivation
// - soft: le module fonctionne, données incomplètes seulement (ex: le CMDB
//   se nourrit des agents mais vit sans) → jamais dans la cascade, info
//   + avertissement orange si coupée
// dependencies = modules utilisés EN AMONT.
const MODULE_INFO: Record<string, { desc: string; hard: string[]; soft: string[] }> = {
  events: {
    desc: 'Flux brut des événements collectés par les agents (journaux système, réseau, fichiers). Source de tout le SIEM.',
    hard: [],
    soft: ['agents'],
  },
  alerts: {
    desc: 'Alertes de sécurité générées par les règles YARA, Sigma et la corrélation. File de traitement pour les analystes.',
    hard: ['yara', 'sigma', 'correlation', 'events'],
    soft: [],
  },
  cases: {
    desc: 'Dossiers d\'investigation: regroupent alertes, commentaires et liens pour suivre un incident de bout en bout.',
    hard: ['alerts'],
    soft: [],
  },
  agents: {
    desc: 'Gestion des agents LogSOC installés sur les machines: inventaire, statut, déploiement des configurations.',
    hard: [],
    soft: [],
  },
  yara: {
    desc: 'Règles YARA de détection de motifs (fichiers, processus, mémoire). Distribuées aux agents par YARA HQ.',
    hard: [],
    soft: ['agents'], // la distribution passe par les agents, mais les règles vivent sans
  },
  sigma: {
    desc: 'Règles Sigma de détection traduites en requêtes sur les événements (MITRE, sévérité, catégories).',
    hard: ['events'], // sans flux d'événements, les règles ne détectent rien
    soft: [],
  },
  correlation: {
    desc: 'Moteur de corrélation: croise les événements sur fenêtres glissantes pour générer des alertes composites.',
    hard: ['events'],
    soft: [],
  },
  threat_intel: {
    desc: 'Renseignement sur les menaces: indicateurs (IOCs), acteurs, flux et bulletins pour qualifier les détections.',
    hard: [],
    soft: [],
  },
  assets: {
    desc: 'Cartographie des actifs (CMDB): machines, criticité, environnement. Support des exigences techniques et de l\'homologation.',
    hard: [],
    soft: ['agents'], // se nourrit des agents (inventaire auto) mais vit avec saisie manuelle
  },
  users: {
    desc: 'Gestion des comptes, rôles d\'accès, casquettes métier, services et MFA. Verrouillé: ne peut pas être désactivé.',
    hard: [],
    soft: [],
  },
  compliance: {
    desc: 'Contrôles de conformité et scores par référentiel (ANSSI, NIS2, ISO…) sur l\'infrastructure.',
    hard: [],
    soft: ['assets'], // scores moins précis sans CMDB, mais les contrôles existent
  },
  governance: {
    desc: 'Gouvernance SI: livrables, exigences, plan d\'action, documentation signée, homologations, dashboards RSSI/DPO.',
    hard: [],
    soft: ['assets'], // vit sans CMDB (documents, signatures, actions)
  },
  risks: {
    desc: 'Cartographie des risques: identification, scoring, plans de traitement et suivi.',
    hard: [],
    soft: [],
  },
  reporting: {
    desc: 'Dashboards et rapports consolidés (activité, conformité, incidents) pour le pilotage.',
    hard: ['events', 'alerts'], // sans flux ni alertes, les dashboards SIEM sont vides
    soft: ['compliance'],
  },
  soar: {
    desc: 'Automatisation des réponses (SOAR): playbooks, exécutions, approbations et intégrations.',
    hard: ['alerts'],
    soft: ['cases'],
  },
}

export function ModulesAdmin() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  // Dialogue de confirmation bidirectionnel (13/09):
  // - désactivation d'un module AVEC modules aval dépendants -> proposer cascade
  // - activation d'un module dont les DÉPENDANCES amont sont off -> proposer
  //   de les activer aussi. Jamais de cascade silencieuse.
  const [confirmAction, setConfirmAction] = useState<{
    module: string
    isActive: boolean
    dependents: string[]   // modules aval impactés (désactivation)
    missingDeps: string[]  // dépendances amont off (activation)
  } | null>(null)

  const { data: modulesStatus, isLoading } = useQuery({
    queryKey: ['modules-status'],
    queryFn: () => usersApi.getModulesStatus().then(r => r.data),
  })

  const { data: rolesData } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => usersApi.getRoles().then(r => r.data),
  })

  // Nombre de rôles (hors superadmin) ayant la lecture sur chaque module
  const readersByModule: Record<string, number> = {}
  for (const r of (rolesData as any[] | undefined) ?? []) {
    if (r.role === 'superadmin') continue
    for (const p of r.permissions || []) {
      if (p.can_read) readersByModule[p.module] = (readersByModule[p.module] || 0) + 1
    }
  }

  const toggleMutation = useMutation({
    mutationFn: ({ module, isActive }: { module: string; isActive: boolean }) =>
      usersApi.setModuleActive(module, isActive),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['modules-status'] })
      toast('success', vars.isActive
        ? `Module « ${MODULE_LABELS[vars.module] || vars.module} » activé`
        : `Module « ${MODULE_LABELS[vars.module] || vars.module} » désactivé`)
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const rows: any[] = modulesStatus ?? []
  const isActiveOf = (m: string): boolean => rows.find((x: any) => x.module === m)?.is_active ?? true

  // Demandes de bascule: ouvre le dialogue si dépendances concernées,
  // sinon applique directement. Jamais de cascade silencieuse.
  const requestToggle = (module: string) => {
    const next = !isActiveOf(module)
    if (!next) {
      // désactivation: modules AVAL qui dépendent de celui-ci (récursif)
      const dependents = collectDependents(module, new Set([module]))
      if (dependents.length > 0) {
        setConfirmAction({ module, isActive: false, dependents, missingDeps: [] })
        return
      }
    } else {
      // activation: dépendances AMONT désactivées (récursif)
      const missing = collectMissingDeps(module, new Set())
      if (missing.length > 0) {
        setConfirmAction({ module, isActive: true, dependents: [], missingDeps: missing })
        return
      }
    }
    toggleMutation.mutate({ module, isActive: next })
  }

  // modules aval dépendant DUR de `module` (fermeture transitive sur hard uniquement),
  // actifs seulement — les soft ne déclenchent JAMAIS la cascade
  const collectDependents = (module: string, seen: Set<string>): string[] => {
    const out: string[] = []
    for (const [m, info] of Object.entries(MODULE_INFO)) {
      if (seen.has(m)) continue
      if (info.hard.includes(module) && isActiveOf(m)) {
        seen.add(m)
        out.push(m)
        out.push(...collectDependents(m, seen))
      }
    }
    return [...new Set(out)]
  }

  // dépendances AMONT désactivées de `module` — hard pour l'activation
  // (les soft coupées sont tolérées: données incomplètes seulement)
  const collectMissingDeps = (module: string, seen: Set<string>): string[] => {
    const info = MODULE_INFO[module]
    if (!info) return []
    const out: string[] = []
    for (const d of info.hard) {
      if (seen.has(d)) continue
      seen.add(d)
      if (!isActiveOf(d)) out.push(d)
      out.push(...collectMissingDeps(d, seen))
    }
    return [...new Set(out)]
  }

  // Application après confirmation: cascade = module + tous les collectés
  const applyConfirmed = (withCascade: boolean) => {
    if (!confirmAction) return
    const targets = new Set<string>([confirmAction.module])
    if (withCascade) {
      const extras = confirmAction.isActive ? confirmAction.missingDeps : confirmAction.dependents
      extras.forEach((m) => targets.add(m))
    }
    targets.forEach((m) => toggleMutation.mutate({ module: m, isActive: confirmAction.isActive }))
    setConfirmAction(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{t('modulesAdmin.modules')}</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          Activation globale des modules de la plateforme. Un module désactivé est refusé pour tous les
          utilisateurs (sauf superadmin) et masqué du menu — l'ingestion technique continue en arrière-plan.
          Pour affiner les accès par type de compte, utilisez « Rôles &amp; Accès ».
        </p>
      </div>

      <Card>
        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((m) => {
              const isUsers = m.module === 'users'
              const label = MODULE_LABELS[m.module] || m.module
              return (
                <div key={m.module} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                  borderRadius: '8px',
                  background: m.is_active ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
                  border: `1px solid ${m.is_active ? 'var(--color-success)' : 'var(--color-border)'}`,
                  opacity: isUsers ? 0.6 : 1,
                }}>
                  <input
                    type="checkbox"
                    checked={m.is_active}
                    disabled={isUsers || toggleMutation.isPending}
                    onChange={() => requestToggle(m.module)}
                    style={{ width: '17px', height: '17px', cursor: isUsers ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                    title={isUsers ? t('modulesAdmin.usersLocked') : undefined}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {MODULE_INFO[m.module]?.desc}
                    </div>
                    {(MODULE_INFO[m.module]?.hard?.length ?? 0) > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                        ⤷ requiert&nbsp;: {MODULE_INFO[m.module].hard.map((d: string) => MODULE_LABELS[d] || d).join(', ')}
                        {MODULE_INFO[m.module].hard.some((d: string) => !isActiveOf(d)) && (
                          <span style={{ color: 'var(--color-danger, red)', marginLeft: '6px' }}>⚠ dépendance requise désactivée — module sans objet</span>
                        )}
                      </div>
                    )}
                    {(MODULE_INFO[m.module]?.soft?.length ?? 0) > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px', opacity: 0.85 }}>
                        utilise aussi&nbsp;: {MODULE_INFO[m.module].soft.map((d: string) => MODULE_LABELS[d] || d).join(', ')}
                        {MODULE_INFO[m.module].soft.some((d: string) => !isActiveOf(d)) && (
                          <span style={{ color: 'var(--color-warning, orange)', marginLeft: '6px' }}>⚠ données incomplètes</span>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                      {m.is_active
                        ? `${readersByModule[m.module] || 0} rôle(s) avec accès en lecture`
                        : t('modulesAdmin.disabledNote')}
                    </div>
                  </div>
                  <Badge variant={m.is_active ? 'success' : 'default'}>{m.is_active ? 'Activé' : t('modulesAdmin.disabled')}</Badge>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          ⚠ Verrou d'accès uniquement : les agents et l'ingestion continuent de fonctionner.
          L'ordre d'évaluation est : activation du module → puis permissions du rôle (Rôles &amp; Accès).
        </div>
      </Card>

      {/* Dialogue de confirmation: jamais de cascade silencieuse */}
      <Modal open={confirmAction !== null} onClose={() => setConfirmAction(null)} title={
        confirmAction?.isActive ? t('modulesAdmin.enableModule') : 'Désactiver le module'
      }>
        {confirmAction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!confirmAction.isActive ? (
              <>
                <div style={{ fontSize: '14px' }}>
                  Vous allez désactiver <strong>« {MODULE_LABELS[confirmAction.module] || confirmAction.module} »</strong>.
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--color-warning-bg, rgba(234,179,8,0.1))', fontSize: '13px' }}>
                  ⚠ <strong>{confirmAction.dependents.length} module(s)</strong> en dépendent fortement et seront impactés&nbsp;:
                  <div style={{ marginTop: '4px', fontWeight: 500 }}>{confirmAction.dependents.map((m) => MODULE_LABELS[m] || m).join(', ')}</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Ces modules perdront leur objet (flux/alertes vides). Les modules qui ne font qu'utiliser ses données (CMDB, Gouvernance, Conformité) ne sont PAS touchés — ils afficheront au plus des données incomplètes.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px' }}>
                  Vous allez activer <strong>« {MODULE_LABELS[confirmAction.module] || confirmAction.module} »</strong>.
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--color-warning-bg, rgba(234,179,8,0.1))', fontSize: '13px' }}>
                  ⚠ Ce module requiert <strong>{confirmAction.missingDeps.length} dépendance(s)</strong> actuellement désactivée(s)&nbsp;:
                  <div style={{ marginTop: '4px', fontWeight: 500 }}>{confirmAction.missingDeps.map((m) => MODULE_LABELS[m] || m).join(', ')}</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Sans elles, le module fonctionnera mais affichera des données incomplètes.
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '4px' }}>
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>{t('modulesAdmin.cancel')}</Button>
              <Button variant="secondary" onClick={() => applyConfirmed(false)}>
                {confirmAction.isActive ? 'Activer seul' : 'Désactiver seul'}
              </Button>
              <Button variant="danger" onClick={() => applyConfirmed(true)}>
                {confirmAction.isActive
                  ? `Activer + dépendances (${confirmAction.missingDeps.length})`
                  : `Tout désactiver (${confirmAction.dependents.length + 1})`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}