import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicesApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { ShieldCheck, CheckCircle2, Clock, XCircle, FileText, Server, ClipboardList, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'

// ─── Facette badge ───
function FacetteBadge({ value }: { value: string | null | undefined }) {
  const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    publie: { icon: <CheckCircle2 size={12} />, label: 'Publié', color: 'var(--color-success)' },
    present: { icon: <CheckCircle2 size={12} />, label: 'Déployé', color: 'var(--color-success)' },
    conforme: { icon: <CheckCircle2 size={12} />, label: 'Conforme', color: 'var(--color-success)' },
    deployee: { icon: <ShieldCheck size={12} />, label: 'Déployée', color: 'var(--color-success)' },
    verifie: { icon: <ShieldCheck size={12} />, label: 'Vérifiée', color: 'var(--color-success)' },
    en_redaction: { icon: <Clock size={12} />, label: 'En rédaction', color: 'var(--color-warning)' },
    en_cours: { icon: <Clock size={12} />, label: 'En cours', color: 'var(--color-warning)' },
    partiellement_conforme: { icon: <Clock size={12} />, label: 'Partiel', color: 'var(--color-warning)' },
    aucun: { icon: <XCircle size={12} />, label: 'Aucun', color: 'var(--color-text-secondary)' },
    non_couverte: { icon: <XCircle size={12} />, label: 'Non couverte', color: 'var(--color-danger)' },
    a_corriger: { icon: <XCircle size={12} />, label: 'À corriger', color: 'var(--color-danger)' },
    non_conforme: { icon: <XCircle size={12} />, label: 'Non conf.', color: 'var(--color-danger)' },
  }
  const m = map[value || ''] || { icon: <XCircle size={12} />, label: '—', color: 'var(--color-text-secondary)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: m.color }}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── Page Liste ───
function PracticesList({ onOpen }: { onOpen: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['practices'],
    queryFn: () => practicesApi.list().then(r => r.data as { items: any[] }),
  })
  const [family, setFamily] = useState('')

  if (isLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement…</div>
  const items = (data?.items || []).filter((p: any) => !family || p.family === family)
  const families = Array.from(new Set((data?.items || []).map((p: any) => p.family)))

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Pratiques de sécurité
        </h1>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>{items.length} pratiques</span>
        <select value={family} onChange={e => setFamily(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px' }}>
          <option value="">Toutes familles</option>
          {families.map((f: string) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Pratique</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'center', width: '80px' }}>Exig.</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '110px' }}>Politique</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '110px' }}>Réalisation</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '130px' }}>Audit</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '130px' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => (
              <tr key={p.id} onClick={() => onOpen(p.id)}
                style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{p.family}</div>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.exigences_count}</td>
                <td style={{ padding: '10px 8px' }}><FacetteBadge value={p.politique} /></td>
                <td style={{ padding: '10px 8px' }}><FacetteBadge value={p.realisation} /></td>
                <td style={{ padding: '10px 8px' }}><FacetteBadge value={p.audit} /></td>
                <td style={{ padding: '10px 8px' }}><FacetteBadge value={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Cockpit d'une pratique ───
function PracticeCockpit({ id, onBack, onOpenAudit }: { id: number; onBack: () => void; onOpenAudit: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['practice', id],
    queryFn: () => practicesApi.get(id).then(r => r.data),
  })
  // Déclarations terrain (13/09): l'équipe a déclaré l'état par asset
  const { data: terrain } = useQuery({
    queryKey: ['practice-assets', id],
    queryFn: () => practicesApi.assets(id).then(r => r.data),
    enabled: id > 0,
  })
  const terrainByAsset = new Map<number, { status: string; updated_by: string; updated_at: string }>(
    ((terrain as any)?.items ?? []).map((i: any) => [i.asset_id, i])
  )
  const [tab, setTab] = useState<'exigences' | 'realisation' | 'audits'>('exigences')



  if (isLoading || !data) return <div style={{ padding: '2rem' }}>Chargement…</div>

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '12px' }}>
        <ArrowLeft size={14} /> Pratiques
      </button>

      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{data.name}</h1>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{data.family} — {data.description}</div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <span>{data.exigences_count} exigences</span>
          <span>·</span>
          <span>{data.politique.livrables.length} livrables</span>
          <span>·</span>
          <FacetteBadge value={data.politique.status} />
          <FacetteBadge value={data.realisation.status} />
        </div>
      </div>



      {/* État d'audit — LECTURE SEULE (la création de cahier se fait dans le menu Audit) */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}>
        <ClipboardList size={14} style={{ color: 'var(--color-text-secondary)' }} />
        {data.audits && data.audits.length > 0 ? (
          <span style={{ color: 'var(--color-text-primary)' }}>
            Dernier audit : <strong>{data.audits[0].audit_date}</strong> — {data.audits[0].auditor_name}
            <span style={{ marginLeft: '8px', color: data.audits[0].verdict === 'conforme' ? 'var(--color-success)' : data.audits[0].verdict === 'non_conforme' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
              ({data.audits[0].verdict === 'en_cours' ? 'saisie en cours' : data.audits[0].verdict?.replace(/_/g, ' ')})
            </span>
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Jamais auditée — la préparation des cahiers se fait dans le menu <strong>Audit</strong>.
          </span>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
        {([
          ['exigences', 'Exigences par livrable', data.exigences_count],
          ['realisation', 'Réalisation', data.realisation.assets.length],
          ['audits', 'Audits', data.audits.length],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key as any)}
            style={{
              padding: '8px 12px', background: tab === key ? 'var(--color-bg-hover)' : 'transparent',
              color: tab === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', borderBottom: tab === key ? '2px solid var(--color-accent)' : '2px solid transparent',
              cursor: 'pointer', fontSize: '13px',
            }}>
            {label} ({count})
          </button>
        ))}
      </div>

      {tab === 'exigences' && (
        <div>
          {data.exigences_par_livrable.map((g: any) => (
            <div key={g.deliverable_id} style={{ marginBottom: '12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', background: 'var(--color-bg-hover)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={13} /> {g.deliverable_name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{g.count} exigences</span>
              </div>
              <div style={{ padding: '0 12px' }}>
                {g.items.slice(0, 5).map((i: any) => (
                  <div key={i.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 600 }}>{i.ref_id}</span>
                    {' '}{i.rule?.slice(0, 120)}{i.rule?.length > 120 ? '…' : ''}
                  </div>
                ))}
                {g.items.length > 5 && (
                  <div style={{ padding: '6px 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    + {g.items.length - 5} autres exigences
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'realisation' && (
        <div>
          {data.realisation.assets.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Aucun asset CMDB lié à cette pratique. Les capacités correspondantes n'ont pas encore été posées sur des assets.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {data.realisation.assets.map((a: any, i: number) => {
                const decl = terrainByAsset.get(a.asset_id ?? a.id)
                return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px' }}>
                  <Server size={12} /> {a.asset_name}
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{a.capability}</span>
                  {decl && (
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '1px 8px', borderRadius: '999px',
                      color: decl.status === 'conforme' ? 'var(--color-success)' : decl.status === 'non_conforme' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                      background: 'var(--color-bg-secondary)',
                    }} title={`Déclaré par ${decl.updated_by} le ${decl.updated_at?.slice(0, 10)} — saisie terrain (Opérations)`}>
                      terrain: {decl.status === 'conforme' ? '✓ conforme' : decl.status === 'non_conforme' ? '✗ non conforme' : 'N/A'}
                    </span>
                  )}
                </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'audits' && (
        <div>
          {data.audits.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Aucun audit — la pratique n'a jamais été vérifiée.
            </div>
          ) : (
            data.audits.map((a: any) => (
              <div key={a.id} onClick={() => onOpenAudit(a.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Audit du {a.audit_date} — {a.auditor_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {a.status === 'clos' ? 'Clos' : 'En cours'}{a.actions_generated ? ' · actions générées' : ''}
                  </div>
                </div>
                <FacetteBadge value={a.verdict} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Cahier d'audit ───
function AuditCahier({ auditId, onBack }: { auditId: number; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['practice-audit', auditId],
    queryFn: () => practicesApi.getAudit(auditId).then(r => r.data),
  })
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [findings, setFindings] = useState<Record<number, string>>({})
  const [verdict, setVerdict] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [initialized, setInitialized] = useState(false)

  const audit = data
  const isEditable = canEdit() && audit?.status !== 'clos' && !audit?.actions_generated

  if (isLoading || !audit) return <div style={{ padding: '2rem' }}>Chargement…</div>

  // init findings depuis les constats existants
  if (!initialized) {
    const f: Record<number, string> = {}
    audit.cahier.forEach((g: any) => g.items.forEach((i: any) => { if (i.finding) f[i.requirement_id] = i.finding }))
    Object.assign(findings, f)
    setVerdict(audit.verdict && audit.verdict !== 'en_cours' ? audit.verdict : '')
    setInitialized(true)
  }

  const totals = { conforme: 0, non_conforme: 0, n_a: 0, restant: 0 }
  audit.cahier.forEach((g: any) => g.items.forEach((i: any) => {
    const f = findings[i.requirement_id]
    if (f === 'conforme') totals.conforme++
    else if (f === 'non_conforme') totals.non_conforme++
    else if (f === 'n_a') totals.n_a++
    else totals.restant++
  }))

  const save = useMutation({
    mutationFn: () => practicesApi.updateAudit(auditId, {
      findings: Object.entries(findings).map(([k, v]) => ({ requirement_id: Number(k), finding: v })),
      verdict: verdict || 'partiellement_conforme',
    }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['practice-audit', auditId] })
      toast('success', r.data.message)
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const generate = useMutation({
    mutationFn: () => practicesApi.generateActions(auditId),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['practice-audit', auditId] })
      toast('success', r.data.message)
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const setFinding = (reqId: number, value: string) => {
    setFindings(prev => ({ ...prev, [reqId]: value }))
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '12px' }}>
        <ArrowLeft size={14} /> Retour
      </button>

      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Cahier d'audit — {audit.audit_date}
        </h1>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Auditeur: {audit.auditor_name} · {audit.cahier.reduce((s: number, g: any) => s + g.count, 0)} exigences
          {audit.status === 'clos' && <span style={{ color: 'var(--color-warning)', marginLeft: '8px' }}>· CLOS{audit.actions_generated ? ' (actions générées)' : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--color-success)' }}>✓ {totals.conforme} conformes</span>
          <span style={{ color: 'var(--color-danger)' }}>✗ {totals.non_conforme} non conformes</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>— {totals.n_a} N/A</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>⏳ {totals.restant} à saisir</span>
        </div>
      </div>

      {/* Constats par document */}
      {audit.cahier.map((g: any) => {
        const isOpen = expanded[g.deliverable_id] ?? false
        const gCounts = { c: 0, nc: 0, na: 0, rest: 0 }
        g.items.forEach((i: any) => {
          const f = findings[i.requirement_id]
          if (f === 'conforme') gCounts.c++
          else if (f === 'non_conforme') gCounts.nc++
          else if (f === 'n_a') gCounts.na++
          else gCounts.rest++
        })
        return (
          <div key={g.deliverable_id} style={{ marginBottom: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setExpanded(p => ({ ...p, [g.deliverable_id]: !isOpen }))}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--color-bg-hover)', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {g.deliverable_name}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {g.count} · ✓{gCounts.c} ✗{gCounts.nc} —{gCounts.na} ⏳{gCounts.rest}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 12px' }}>
                {g.items.map((i: any) => (
                  <div key={i.requirement_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px' }}>{i.ref_id}</span>
                      {' '}{i.rule?.slice(0, 130)}{i.rule?.length > 130 ? '…' : ''}
                    </div>
                    {isEditable ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(['conforme', 'non_conforme', 'n_a'] as const).map(f => (
                          <button key={f} onClick={() => setFinding(i.requirement_id, f)}
                            style={{
                              padding: '2px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer',
                              border: `1px solid ${findings[i.requirement_id] === f
                                ? (f === 'conforme' ? 'var(--color-success)' : f === 'non_conforme' ? 'var(--color-danger)' : 'var(--color-border)')
                                : 'var(--color-border)'}`,
                              background: findings[i.requirement_id] === f
                                ? (f === 'conforme' ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : f === 'non_conforme' ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : 'var(--color-bg-hover)')
                                : 'transparent',
                              color: findings[i.requirement_id] === f
                                ? (f === 'conforme' ? 'var(--color-success)' : f === 'non_conforme' ? 'var(--color-danger)' : 'var(--color-text-primary)')
                                : 'var(--color-text-secondary)',
                              fontWeight: findings[i.requirement_id] === f ? 600 : 400,
                            }}>
                            {f === 'conforme' ? '✓ Conforme' : f === 'non_conforme' ? '✗ Non conforme' : '— N/A'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: findings[i.requirement_id]
                        ? (findings[i.requirement_id] === 'non_conforme' ? 'var(--color-danger)' : findings[i.requirement_id] === 'conforme' ? 'var(--color-success)' : 'var(--color-text-secondary)')
                        : 'var(--color-text-secondary)' }}>
                        {findings[i.requirement_id] === 'conforme' ? '✓ Conforme' : findings[i.requirement_id] === 'non_conforme' ? '✗ Non conforme' : findings[i.requirement_id] === 'n_a' ? '— N/A' : 'non saisi'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Verdict + actions */}
      {isEditable && (
        <div style={{ marginTop: '16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Verdict global</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {(['conforme', 'partiellement_conforme', 'non_conforme'] as const).map(v => (
              <button key={v} onClick={() => setVerdict(v)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  border: `1px solid ${verdict === v ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: verdict === v ? 'var(--color-bg-hover)' : 'transparent',
                  color: verdict === v ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: verdict === v ? 600 : 400,
                }}>
                {v === 'conforme' ? 'Conforme' : v === 'partiellement_conforme' ? 'Partiellement conforme' : 'Non conforme'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => save.mutate()} disabled={save.isPending}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
              {save.isPending ? '…' : 'Enregistrer les constats'}
            </button>
            <button onClick={() => generate.mutate()} disabled={generate.isPending || totals.non_conforme === 0}
              title={totals.non_conforme === 0 ? 'Aucune exigence non conforme à corriger' : `Créer ${totals.non_conforme} actions correctives`}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px' }}>
              {generate.isPending ? '…' : `Générer les actions correctives (${totals.non_conforme})`}
            </button>
          </div>
        </div>
      )}

      {/* Rapport signé — visible dès que l'audit est clos */}
      {audit.status === 'clos' && (
        <ReportPanel auditId={auditId} audit={audit} />
      )}

      {/* Re-audit: actions correctives des audits précédents de cette pratique */}
      {audit.status !== 'clos' && <PreviousActionsPanel practiceId={audit.practice_id} excludeAuditId={auditId} />}
    </div>
  )
}

// ─── Panneau rapport signé: générer → signer (RSSI) → informer direction ───
function ReportPanel({ auditId, audit }: { auditId: number; audit: any }) {
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showHash, setShowHash] = useState(false)

  const refresh = () => qc.invalidateQueries({ queryKey: ['practice-audit', auditId] })

  const genReport = useMutation({
    mutationFn: () => practicesApi.generateReport(auditId),
    onSuccess: (r: any) => { refresh(); toast('success', r.data.message) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const signReport = useMutation({
    mutationFn: () => practicesApi.signReport(auditId),
    onSuccess: (r: any) => { refresh(); toast('success', `Rapport signé par ${r.data.signed_by}`) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const notify = useMutation({
    mutationFn: () => practicesApi.notifyDirection(auditId),
    onSuccess: (r: any) => { refresh(); toast('success', r.data.message) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const signed = !!audit.report_signed
  const generated = !!audit.report_path || signed
  const notified = !!audit.direction_notified_at

  const steps = [
    { done: generated, label: '1. Rapport généré' },
    { done: signed, label: '2. Signé par le RSSI' },
    { done: notified, label: '3. Direction informée' },
  ]

  return (
    <div style={{ marginTop: '16px', background: 'var(--color-bg-secondary)', border: `1px solid ${signed ? 'var(--color-success)' : 'var(--color-border)'}`, borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Rapport d'audit signé
          {signed && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-success)' }}>✓ preuve verrouillée</span>}
        </div>
        {/* progression */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          {steps.map((s, i) => (
            <span key={i} style={{ color: s.done ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
              {s.done ? '●' : '○'} {s.label.replace(/^\d\.\s/, '')}
            </span>
          ))}
        </div>
      </div>

      {signed && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
          Signé par <b style={{ color: 'var(--color-text-primary)' }}>{audit.report_signed_by}</b>
          {' '}le {new Date(audit.report_signed_at).toLocaleString('fr-FR')}
          {notified && <> · Direction informée le {new Date(audit.direction_notified_at).toLocaleString('fr-FR')}</>}
          {' '}· <a href="#" onClick={(e) => { e.preventDefault(); setShowHash(!showHash) }}
            style={{ color: 'var(--color-accent)', fontSize: '11px' }}>
            {showHash ? 'masquer' : 'empreinte SHA-256'}
          </a>
          {showHash && <code style={{ display: 'block', marginTop: '4px', fontSize: '10px', wordBreak: 'break-all', color: 'var(--color-text-secondary)' }}>{audit.report_sha256}</code>}
        </div>
      )}

      {canEdit() && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!signed && (
            <button onClick={() => genReport.mutate()} disabled={genReport.isPending}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-accent)', background: generated ? 'transparent' : 'var(--color-accent)', color: generated ? 'var(--color-accent)' : '#fff', cursor: 'pointer', fontSize: '12px' }}>
              {genReport.isPending ? '…' : generated ? '↻ Régénérer le PDF' : 'Générer le rapport PDF'}
            </button>
          )}
          {!signed && (
            <button onClick={() => signReport.mutate()} disabled={signReport.isPending || !generated}
              title="Le rapport d'audit est signé par le RSSI"
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-success)', background: 'transparent', color: 'var(--color-success)', cursor: 'pointer', fontSize: '12px' }}>
              {signReport.isPending ? '…' : '✍ Signer (RSSI)'}
            </button>
          )}
          {signed && !notified && (
            <button onClick={() => notify.mutate()} disabled={notify.isPending}
              title="Email d'information avec le rapport signé en pièce jointe — aucune validation attendue"
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '12px' }}>
              {notify.isPending ? '…' : '✉ Informer la direction (email)'}
            </button>
          )}
          {generated && (
            <a href={practicesApi.reportUrl(auditId, signed)} target="_blank" rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', textDecoration: 'none', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}>
              ⬇ Télécharger le rapport {signed ? 'signé' : '(non signé)'}
            </a>
          )}
        </div>
      )}
      {!canEdit() && generated && (
        <a href={practicesApi.reportUrl(auditId, signed)} target="_blank" rel="noreferrer"
          style={{ fontSize: '12px', color: 'var(--color-accent)' }}>
          ⬇ Télécharger le rapport {signed ? 'signé' : '(non signé)'}
        </a>
      )}
    </div>
  )
}

// ─── Re-audit: actions correctives de l'audit précédent ─────────────────────
function PreviousActionsPanel({ practiceId, excludeAuditId }: { practiceId: number; excludeAuditId: number }) {
  const { data } = useQuery({
    queryKey: ['practice-previous-actions', practiceId, excludeAuditId],
    queryFn: () => practicesApi.previousActions(practiceId, excludeAuditId).then(r => r.data),
  })
  const items: any[] = data?.items || []
  if (!items.length) return null
  const done = items.filter((i: any) => i.done).length
  return (
    <div style={{ marginTop: '16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-primary)' }}>
        Actions correctives des audits précédents <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--color-text-secondary)' }}>({done}/{items.length} terminées — à vérifier lors du re-audit)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
        {items.map((a: any) => (
          <div key={a.action_id} style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'baseline' }}>
            <span style={{ color: a.done ? 'var(--color-success)' : 'var(--color-warning)', minWidth: '14px' }}>{a.done ? '✓' : '⏳'}</span>
            <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>{a.title}</span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
              ACT-{String(a.action_id).padStart(4, '0')} · {a.status}
              {a.target_date ? ` · échéance ${a.target_date}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page principale (routing interne) ───
export function Practices() {
  const [view, setView] = useState<{ mode: 'list' } | { mode: 'cockpit'; id: number } | { mode: 'audit'; id: number }>({ mode: 'list' })

  return (
    <div style={{ padding: '0' }}>
      {view.mode === 'list' && <PracticesList onOpen={(id) => setView({ mode: 'cockpit', id })} />}
      {view.mode === 'cockpit' && (
        <PracticeCockpit id={view.id} onBack={() => setView({ mode: 'list' })} onOpenAudit={(id) => setView({ mode: 'audit', id })} />
      )}
      {view.mode === 'audit' && (
        <AuditCahier auditId={view.id} onBack={() => setView({ mode: 'cockpit', id: (window as any).__lastPracticeId ?? 0 })} />
      )}
    </div>
  )
}