import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicesApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { ShieldCheck, ChevronDown, ChevronRight, Server } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * Bonnes pratiques SI (menu Opérations) — la vue de COMPLÉTION terrain.
 * Une ligne par pratique technique: état agrégé, en dépliant les ASSETS
 * support avec déclaration de statut (conforme/non conforme/N-A) —
 * saisie rapide par l'équipe (1 par paire, pas exigence par exigence).
 * La déclaration terrain est INDEPENDANTE du détail des exigences
 * (elle ne modifie pas les compliance_status documentaires).
 */

const STATUS_LABELS: Record<string, string> = {
  conforme: '✓ Conforme',
  non_conforme: '✗ Non conforme',
  non_applicable: '— N/A',
}

export function OpsPractices() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['practices'],
    queryFn: () => practicesApi.list().then(r => r.data as { items: any[] }),
  })
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  // Assets de la pratique dépliée
  const [openPracticeId, setOpenPracticeId] = useState<number | null>(null)
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['practice-assets', openPracticeId],
    queryFn: () => practicesApi.assets(openPracticeId!).then(r => r.data),
    enabled: openPracticeId !== null,
  })

  const declareMutation = useMutation({
    mutationFn: ({ practiceId, assetId, status }: { practiceId: number; assetId: number; status: string }) =>
      practicesApi.declareAsset(practiceId, assetId, status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['practice-assets', vars.practiceId] })
      toast('success', t('opsPractices.declared'))
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <div style={{ padding: '2rem' }}>Chargement…</div>
  const items = (data?.items || []).filter((p: any) => p.family === 'Technique' || p.family === 'Physique')

  const toggle = (id: number) => {
    const next = !(expanded[id] ?? false)
    setExpanded(prev => ({ ...prev, [id]: next }))
    setOpenPracticeId(next ? id : null)
  }

  const selStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-primary)', cursor: 'pointer',
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
        Bonnes pratiques SI — complétion terrain
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
        Déclarez l'état de chaque pratique sur vos assets — saisie rapide pour l'équipe technique.
        La déclaration ne modifie pas le détail des exigences (conformité documentaire), elle atteste l'état opérationnel.
      </p>

      {items.map((p: any) => {
        const isOpen = expanded[p.id] ?? false
        return (
          <div key={p.id} style={{ marginBottom: '10px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            <button onClick={() => toggle(p.id)}
              style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <ShieldCheck size={15} color="var(--color-text-secondary)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.name}</span>
              </span>
              <span style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{p.exigences_count} exigences</span>
                <span style={{ color: p.realisation === 'present' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {p.realisation === 'present' ? '✓ déployée' : '◦ non déployée'}
                </span>
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--color-border)' }}>
                {/* Résumé facettes */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-text-secondary)', margin: '10px 0' }}>
                  <span>Politique: {p.politique === 'publie' ? '✓ publiée' : p.politique === 'en_redaction' ? '⏳ en rédaction' : '✗ aucun livrable'}</span>
                  <span>·</span>
                  <span>Réalisation: {p.realisation === 'present' ? '✓ assets liés' : 'aucun asset (capacités non posées sur le CMDB)'}</span>
                  <span>·</span>
                  <span>Dernier audit: {p.audit_date || 'jamais'}</span>
                </div>

                {/* Assets + déclarations terrain */}
                {openPracticeId === p.id && (
                  assetsLoading ? (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '8px 0' }}>Chargement des assets…</div>
                  ) : (assetsData?.items || []).length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '8px 0', fontStyle: 'italic' }}>
                      Aucun asset CMDB lié — les capacités correspondantes ne sont pas encore posées sur des assets
                      (enrichissez le CMDB pour activer la déclaration sur cette pratique).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '4px 0' }}>
                        Déclaration terrain par asset ({assetsData.total}) :
                      </div>
                      {assetsData.items.map((a: any) => (
                        <div key={a.asset_id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                          background: 'var(--color-bg-tertiary)', borderRadius: '8px',
                        }}>
                          <Server size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{a.asset_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              {a.capabilities.join(', ')}
                              {a.updated_by && ` · déclaré par ${a.updated_by}${a.updated_at ? ` le ${a.updated_at.slice(0, 10)}` : ''}`}
                            </div>
                          </div>
                          <select
                            value={a.status ?? ''}
                            onChange={(e) => e.target.value && declareMutation.mutate({
                              practiceId: p.id, assetId: a.asset_id, status: e.target.value,
                            })}
                            style={{ ...selStyle, fontWeight: a.status ? 500 : 400, color: a.status === 'conforme' ? 'var(--color-success)' : a.status === 'non_conforme' ? 'var(--color-danger)' : 'inherit' }}
                          >
                            <option value="">— à déclarer</option>
                            <option value="conforme">{STATUS_LABELS.conforme}</option>
                            <option value="non_conforme">{STATUS_LABELS.non_conforme}</option>
                            <option value="non_applicable">{STATUS_LABELS.non_applicable}</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )
                )}
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '10px' }}>
                  Le détail des exigences et la conformité documentaire restent dans le cockpit (menu Conformité).
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}