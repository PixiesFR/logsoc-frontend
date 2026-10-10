import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { targetMappingApi } from '../../api'
import { Badge, Button } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Crosshair, Zap, ShieldOff, CheckCircle2, Clock } from 'lucide-react'

interface TargetMapping {
  target_text: string
  asset_id: number | null
  asset_name: string | null
  asset_type: string | null
  match_rule: string | null
  is_ignored: boolean
  requirement_count: number
  resolved_assets: string[]
  capability: string | null
}

type FilterKey = 'all' | 'resolved' | 'pending' | 'ignored'

export function TargetMappings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['target-mappings'],
    queryFn: () => targetMappingApi.list().then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ target, asset_id, is_ignored }: { target: string; asset_id: number | null; is_ignored: boolean }) =>
      targetMappingApi.update(target, { asset_id, is_ignored }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['target-mappings'] }),
    onError: () => toast('error', 'Erreur lors de la mise à jour'),
  })

  const applyMutation = useMutation({
    mutationFn: () => targetMappingApi.apply(),
    onSuccess: (res: any) => {
      const d = res.data
      const detail = Object.entries(d.per_asset || {})
        .map(([name, n]: any) => `${name}: ${n}`)
        .join(', ')
      toast('success', `${d.links_created} lien(s) créé(s)${detail ? ` — ${detail}` : ''}${d.links_existing ? `, ${d.links_existing} existant(s)` : ''}`)
      qc.invalidateQueries({ queryKey: ['target-mappings'] })
    },
    onError: () => toast('error', "Erreur lors de l'application"),
  })

  const items: TargetMapping[] = (data?.items || []) as TargetMapping[]

  const isResolved = (m: TargetMapping) =>
    !m.is_ignored && (m.resolved_assets.length > 0 || !!m.asset_name)

  const resolvedCount = items.filter(isResolved).length
  const ignoredCount = items.filter((m) => m.is_ignored).length
  const pendingCount = items.length - resolvedCount - ignoredCount

  const filtered = items.filter((m) => {
    if (search && !m.target_text.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'resolved') return isResolved(m)
    if (filter === 'pending') return !isResolved(m) && !m.is_ignored
    if (filter === 'ignored') return m.is_ignored
    return true
  })

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Crosshair size={22} />
            Mappage cibles → assets
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Résolution automatique : capacités CMDB → dictionnaire → règles de champs. Cette page est la vue de contrôle.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Zap size={16} />}
          onClick={() => applyMutation.mutate()}
          disabled={applyMutation.isPending}
        >
          {applyMutation.isPending ? 'Application…' : 'Appliquer les rattachements'}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {([
          ['all', `Tous (${items.length})`],
          ['resolved', `Résolus (${resolvedCount})`],
          ['pending', `En attente (${pendingCount})`],
          ['ignored', `Ignorés (${ignoredCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              border: `1px solid ${filter === key ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: filter === key ? 'var(--color-bg-hover)' : 'transparent',
              color: filter === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <input
          placeholder="Rechercher une cible…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '8px 12px', fontSize: '13px', borderRadius: '8px',
            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
            color: 'var(--color-text-primary)', outline: 'none', width: '240px',
          }}
        />
      </div>

      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 1.6fr 0.9fr 0.9fr', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          <span>Cible (IA)</span>
          <span style={{ textAlign: 'right' }}>Exig.</span>
          <span>Résolution automatique</span>
          <span>Capacité</span>
          <span>Actions</span>
        </div>
        <div style={{ maxHeight: 'calc(96vh - 320px)', overflowY: 'auto' }}>
          {isLoading && <div style={{ padding: '24px', color: 'var(--color-text-secondary)' }}>Chargement…</div>}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: '24px', color: 'var(--color-text-secondary)' }}>Aucun target dans cette catégorie.</div>
          )}
          {filtered.map((m) => (
            <div key={m.target_text} style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 1.6fr 0.9fr 0.9fr', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.target_text}>
                {m.target_text}
              </span>
              <span style={{ textAlign: 'right' }}>
                <Badge variant={m.requirement_count > 20 ? 'danger' : m.requirement_count > 0 ? 'info' : 'default'} size="sm">
                  {m.requirement_count}
                </Badge>
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                {m.is_ignored ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '12px' }}>
                    <ShieldOff size={12} /> Ignoré
                  </span>
                ) : m.asset_name ? (
                  <>
                    <Badge variant="warning" size="sm">{m.asset_name}</Badge>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>override</span>
                  </>
                ) : m.resolved_assets.length > 0 ? (
                  m.resolved_assets.map((name) => (
                    <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: '10px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 500 }}>
                      <CheckCircle2 size={11} /> {name}
                    </span>
                  ))
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '12px' }}>
                    <Clock size={12} /> En attente
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.capability ?? ''}>
                {m.capability ?? '—'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {m.asset_name && (
                  <button
                    onClick={() => updateMutation.mutate({ target: m.target_text, asset_id: null, is_ignored: false })}
                    title="Retirer l'override manuel (revenir à la résolution auto)"
                    style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', fontSize: '11px', cursor: 'pointer' }}
                  >
                    ↺ Auto
                  </button>
                )}
                {!m.is_ignored && (
                  <button
                    onClick={() => updateMutation.mutate({ target: m.target_text, asset_id: null, is_ignored: true })}
                    title="Ignorer ce target (aucun lien)"
                    style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Ignorer
                  </button>
                )}
                {m.is_ignored && (
                  <button
                    onClick={() => updateMutation.mutate({ target: m.target_text, asset_id: null, is_ignored: false })}
                    title="Réactiver la résolution auto"
                    style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Réactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        Les assets affichés viennent des <strong>capacités déclarées en CMDB</strong> (redondance native : tous les assets partageant la capacité).
        Pour changer la résolution, modifiez les capacités de l'asset dans la CMDB — l'override manuel reste possible via l'API.
      </p>
    </div>
  )
}