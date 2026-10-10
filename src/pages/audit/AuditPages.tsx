import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { practicesApi, usersApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { CalendarCheck, Clock, AlertCircle, ArrowLeft, ChevronDown, ChevronRight, Plus } from 'lucide-react'

// ═══ Programme d'audit ═══
export function AuditProgram() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-program'],
    queryFn: () => practicesApi.program().then(r => r.data),
  })

  if (isLoading) return <div style={{ padding: '2rem' }}>Chargement…</div>
  const items = data?.items || []

  const etatInfo: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    en_retard: { label: 'En retard', color: 'var(--color-danger)', icon: <AlertCircle size={12} /> },
    jamais_audite: { label: 'Jamais audité', color: 'var(--color-warning)', icon: <Clock size={12} /> },
    a_planifier: { label: 'À planifier', color: 'var(--color-info)', icon: <Clock size={12} /> },
    en_cours_saisie: { label: 'Saisie en cours', color: 'var(--color-accent)', icon: <Clock size={12} /> },
    clos_ponctuel: { label: 'Ponctuel clos', color: 'var(--color-success)', icon: <CalendarCheck size={12} /> },
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>Programme d'audit</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
        Cycle pluriannuel — chaque pratique avec sa périodicité et son échéancier.
      </p>

      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Pratique</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '90px' }}>Périodicité</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '110px' }}>Dernier audit</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '110px' }}>Prochain dû</th>
              <th style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '130px' }}>État</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => {
              const ei = etatInfo[p.etat] || etatInfo.a_planifier
              return (
                <tr key={p.practice_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.practice_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {p.last_verdict ? `verdict: ${p.last_verdict}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
                    {p.audit_frequency === 'annuel' ? 'Annuel' : p.audit_frequency === 'biennal' ? 'Biennal' : p.audit_frequency === 'ponctuel' ? 'Ponctuel' : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{p.last_audit_date || '—'}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{p.next_due || '—'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: ei.color }}>
                      {ei.icon} {ei.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══ Bouton Préparer un audit (choix de la pratique) ═══
function PrepareButton({ onSelect }: { onSelect: (practiceId: number) => void }) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['practices'],
    queryFn: () => practicesApi.list().then(r => r.data as { items: any[] }),
    enabled: open,
  })

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-accent)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Plus size={14} /> Préparer un audit
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, width: '320px', maxHeight: '300px', overflowY: 'auto', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', padding: '6px' }}>
          {(data?.items || []).map((p: any) => (
            <button key={p.id} onClick={() => { setOpen(false); onSelect(p.id) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {p.name}
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {p.exigences_count} exigences · {p.audit_frequency}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══ Cahiers en cours (avec préparation par sélection) ═══
export function AuditPending({ onOpenCahier }: { onOpenCahier?: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-pending'],
    queryFn: () => practicesApi.pending().then(r => r.data),
  })
  const [prepareFor, setPrepareFor] = useState<number | null>(null)

  if (prepareFor) return <AuditPrepare practiceId={prepareFor} onDone={() => setPrepareFor(null)} />

  if (isLoading) return <div style={{ padding: '2rem' }}>Chargement…</div>
  const items = data?.items || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Cahiers d'audit en cours</h1>
        <PrepareButton onSelect={(pid) => setPrepareFor(pid)} />
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
        Les audits en cours de saisie par les auditeurs.
      </p>

      {items.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
          Aucun cahier en cours. Cliquez « Préparer un audit » pour sélectionner les questions et désigner l'auditeur.
        </div>
      ) : items.map((a: any) => (
        <div key={a.id} onClick={() => onOpenCahier?.(a.id)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {a.practice_name} — {a.audit_date}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Auditeur: {a.auditor_name} · {a.saisis_count}/{a.perimeter_count} constats saisis
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {a.verdict === 'en_cours' ? 'saisie en cours' : a.verdict}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══ Préparation d'audit (sélection des questions) ═══
function AuditPrepare({ practiceId, onDone }: { practiceId: number; onDone: () => void }) {
  const { data: practice } = useQuery({
    queryKey: ['practice', practiceId],
    queryFn: () => practicesApi.get(practiceId).then(r => r.data),
  })
  const { data: users } = useQuery({
    queryKey: ['users-for-audit'],
    queryFn: () => usersApi.list().then(r => {
      const d = r.data as any
      const arr = Array.isArray(d) ? d : d.items || []
      return arr.filter((u: any) => {
        const caps = String(u.business_role ?? '').split('/').map((p: string) => p.trim()).filter(Boolean)
        return caps.includes('auditeur') || caps.includes('rssi') || u.role === 'admin'
      })
    }),
  })
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const practiceData = practice as any
  if (practiceData && !initialized) {
    // Par defaut: TOUTES les exigences selectionnees (l auditeur DECOCHE ce qu il retire)
    const s = new Set<number>()
    practiceData.exigences_par_livrable?.forEach((g: any) => g.items.forEach((i: any) => s.add(i.id)))
    setSelected(s)
    setInitialized(true)
  }

  const create = useMutation({
    mutationFn: (auditorId: number) => practicesApi.prepareAudit(practiceId, {
      auditor_user_id: auditorId,
      selected_requirement_ids: Array.from(selected),
    }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['audit-pending'] })
      toast('success', r.data.message)
      onDone()
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  if (!practiceData) return <div style={{ padding: '2rem' }}>Chargement…</div>

  return (
    <div>
      <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', marginBottom: '12px' }}>
        <ArrowLeft size={14} /> Annuler
      </button>

      <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
        Préparer l'audit — {practiceData.name}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
        Sélectionnez les questions à contrôler (exigences du référentiel). Par défaut toutes sont retenues — décochez celles à exclure.
      </p>
      <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '12px' }}>
        {selected.size} exigences sélectionnées
      </div>

      {practiceData.exigences_par_livrable.map((g: any) => {
        const isOpen = expanded[g.deliverable_id] ?? false
        return (
          <div key={g.deliverable_id} style={{ marginBottom: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setExpanded(p => ({ ...p, [g.deliverable_id]: !isOpen }))}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--color-bg-hover)', border: 'none', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {g.deliverable_name}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {g.items.filter((i: any) => selected.has(i.id)).length}/{g.count} retenues
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 12px' }}>
                {g.items.map((i: any) => (
                  <label key={i.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(i.id)}
                      onChange={(e) => setSelected(prev => {
                        const n = new Set(prev)
                        if (e.target.checked) n.add(i.id); else n.delete(i.id)
                        return n
                      })}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px' }}>{i.ref_id}</span>
                      {' '}{i.rule?.slice(0, 110)}{i.rule?.length > 110 ? '…' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {canEdit() && (
        <div style={{ marginTop: '16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Désigner l'auditeur et créer le cahier</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select id="prepare-auditor" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
              {(users || []).map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.username} ({u.business_role})</option>)}
            </select>
            <button
              onClick={() => {
                const sel = document.getElementById('prepare-auditor') as HTMLSelectElement
                if (sel && selected.size > 0) create.mutate(Number(sel.value))
                else toast('error', 'Sélectionnez au moins une exigence')
              }}
              disabled={create.isPending || selected.size === 0}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
              {create.isPending ? '…' : `Créer le cahier (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ Historique ═══
export function AuditHistory({ onOpenCahier }: { onOpenCahier?: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-history'],
    queryFn: () => practicesApi.history().then(r => r.data),
  })

  if (isLoading) return <div style={{ padding: '2rem' }}>Chargement…</div>
  const items = data?.items || []

  const verdictColor: Record<string, string> = {
    conforme: 'var(--color-success)',
    partiellement_conforme: 'var(--color-warning)',
    non_conforme: 'var(--color-danger)',
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>Historique des audits</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
        Les audits clos, leurs verdicts et les actions générées.
      </p>

      {items.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
          Aucun audit clos pour le moment.
        </div>
      ) : items.map((a: any) => (
        <div key={a.id} onClick={() => onOpenCahier?.(a.id)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {a.practice_name} — {a.audit_date}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Auditeur: {a.auditor_name} · {a.actions_generated ? 'actions générées' : 'aucune action'}
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: verdictColor[a.verdict] || 'var(--color-text-secondary)' }}>
            {a.verdict === 'conforme' ? 'Conforme' : a.verdict === 'partiellement_conforme' ? 'Partiellement conforme' : a.verdict === 'non_conforme' ? 'Non conforme' : a.verdict}
          </span>
        </div>
      ))}
    </div>
  )
}