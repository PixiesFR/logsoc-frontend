import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { homologationApi, usersApi } from '../../api'
import { Badge, Button, Input, Select, Tabs } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Trash2, CheckCircle, XCircle, Gavel, Users, FileCheck, ClipboardList } from 'lucide-react'

// ── Badge helpers ──

type HomoStatus = 'draft' | 'committee' | 'assessment' | 'documents' | 'commission' | 'decided' | 'expired'

const statusConfig: Record<HomoStatus, { variant: 'default' | 'warning' | 'info' | 'success' | 'danger'; label: string }> = {
  draft: { variant: 'default', label: 'Brouillon' },
  committee: { variant: 'warning', label: 'Comité' },
  assessment: { variant: 'info', label: 'Évaluation' },
  documents: { variant: 'info', label: 'Dossier' },
  commission: { variant: 'warning', label: 'Commission' },
  decided: { variant: 'success', label: 'Décidée' },
  expired: { variant: 'danger', label: 'Expirée' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as HomoStatus] ?? { variant: 'default' as const, label: status }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

type HomoLevel = 'simplifie' | 'intermediaire' | 'renforce'

const levelConfig: Record<HomoLevel, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  simplifie: { variant: 'success', label: 'Simplifié' },
  intermediaire: { variant: 'warning', label: 'Intermédiaire' },
  renforce: { variant: 'danger', label: 'Renforcé' },
}

function LevelBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null
  const cfg = levelConfig[level as HomoLevel] ?? { variant: 'default' as const, label: level }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

type HomoDecision = 'favorable' | 'reserve' | 'defavorable'

const decisionConfig: Record<HomoDecision, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  favorable: { variant: 'success', label: 'Favorable' },
  reserve: { variant: 'warning', label: 'Sous réserve' },
  defavorable: { variant: 'danger', label: 'Défavorable' },
}

function DecisionBadge({ decision }: { decision: string | null | undefined }) {
  if (!decision) return null
  const cfg = decisionConfig[decision as HomoDecision] ?? { variant: 'default' as const, label: decision }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

// ── Assessment matrix ──
const CRITICALITY_LABELS: Record<string, string> = {
  mineure: 'Mineure',
  moderee: 'Modérée',
  importante: 'Importante',
  critique: 'Critique',
}

const EXPOSURE_LABELS: Record<string, string> = {
  nulle: 'Nulle',
  faible: 'Faible',
  importante: 'Importante',
  totale: 'Totale',
}

const MATRIX: Record<string, Record<string, string>> = {
  mineure: { nulle: 'simplifie', faible: 'simplifie', importante: 'intermediaire', totale: 'intermediaire' },
  moderee: { nulle: 'simplifie', faible: 'intermediaire', importante: 'intermediaire', totale: 'renforce' },
  importante: { nulle: 'intermediaire', faible: 'intermediaire', importante: 'renforce', totale: 'renforce' },
  critique: { nulle: 'intermediaire', faible: 'renforce', importante: 'renforce', totale: 'renforce' },
}

// ── Typed data interfaces ──

interface HomoData {
  id: number
  service_id?: number
  service_name?: string
  service_label?: string
  status?: string
  level?: string
  criticality?: string
  exposure?: string
  decision?: string
  decision_comment?: string
  valid_from?: string
  valid_until?: string
  review_date?: string
  documents?: { id: number; label?: string; name?: string; status?: string }[]
  reservations?: { id: number; description?: string; due_date?: string; status?: string }[]
}

interface MemberData {
  id: number
  user_id?: number
  user_name?: string
  display_name?: string
  role?: string
}

// ── Component ──

export function HomologationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const homoId = Number(id)
  const { toast } = useToast()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('committee')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('membre')
  const [criticality, setCriticality] = useState('')
  const [exposure, setExposure] = useState('')
  const [decisionComment, setDecisionComment] = useState('')
  const [reservationDesc, setReservationDesc] = useState('')
  const [reservationDue, setReservationDue] = useState('')

  // Fetch homologation detail
  const { data: homo, isLoading } = useQuery({
    queryKey: ['homologations', homoId],
    queryFn: () => homologationApi.get(homoId).then((r) => r.data as HomoData),
    enabled: !isNaN(homoId),
  })

  // Fetch committee
  const { data: committee } = useQuery({
    queryKey: ['homologations', homoId, 'committee'],
    queryFn: () => homologationApi.listCommittee(homoId).then((r) => {
      const raw = r.data
      const items = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.items ?? []
      return items as MemberData[]
    }),
    enabled: !isNaN(homoId) && activeTab === 'committee',
  })

  // Fetch users for committee add
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => {
      const raw = r.data
      const items = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.items ?? []
      return items as { id: number; display_name?: string; username?: string }[]
    }),
    enabled: activeTab === 'committee',
  })

  const h: HomoData = homo ?? ({} as HomoData)
  const documents = h.documents ?? []
  const reservations = h.reservations ?? []
  const validatedCount = documents.filter((d) => d.status === 'validated').length

  // Mutations
  const addMemberMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homologationApi.addCommittee(homoId, data),
    onSuccess: () => {
      toast('success', 'Membre ajouté')
      qc.invalidateQueries({ queryKey: ['homologations', homoId, 'committee'] })
      setAddMemberUserId('')
      setAddMemberRole('membre')
    },
    onError: () => toast('error', 'Erreur lors de l\'ajout'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => homologationApi.removeCommittee(homoId, memberId),
    onSuccess: () => {
      toast('success', 'Membre retiré')
      qc.invalidateQueries({ queryKey: ['homologations', homoId, 'committee'] })
    },
    onError: () => toast('error', 'Erreur lors du retrait'),
  })

  const assessMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homologationApi.assess(homoId, data),
    onSuccess: () => {
      toast('success', 'Évaluation effectuée')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
    },
    onError: () => toast('error', 'Erreur lors de l\'évaluation'),
  })

  const validateDocMutation = useMutation({
    mutationFn: (docId: number) => homologationApi.validateDoc(homoId, docId),
    onSuccess: () => {
      toast('success', 'Document validé')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
    },
    onError: () => toast('error', 'Erreur lors de la validation'),
  })

  const rejectDocMutation = useMutation({
    mutationFn: (docId: number) => homologationApi.rejectDoc(homoId, docId),
    onSuccess: () => {
      toast('success', 'Document rejeté')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
    },
    onError: () => toast('error', 'Erreur lors du rejet'),
  })

  const decideMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homologationApi.decide(homoId, data),
    onSuccess: () => {
      toast('success', 'Décision enregistrée')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
    },
    onError: () => toast('error', 'Erreur lors de la décision'),
  })

  const addReservationMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homologationApi.addReservation(homoId, data),
    onSuccess: () => {
      toast('success', 'Réservation ajoutée')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
      setReservationDesc('')
      setReservationDue('')
    },
    onError: () => toast('error', 'Erreur lors de l\'ajout'),
  })

  const liftReservationMutation = useMutation({
    mutationFn: (resId: number) => homologationApi.liftReservation(homoId, resId),
    onSuccess: () => {
      toast('success', 'Réservation levée')
      qc.invalidateQueries({ queryKey: ['homologations', homoId] })
    },
    onError: () => toast('error', 'Erreur lors de la levée'),
  })

  const docStatusBadge = (status: string) => {
    if (status === 'validated') return <Badge variant="success">Validé</Badge>
    if (status === 'rejected') return <Badge variant="danger">Rejeté</Badge>
    return <Badge variant="warning">En attente</Badge>
  }

  const userOptions = (users ?? []).map((u) => ({
    label: u.display_name ?? u.username ?? `User #${u.id}`,
    value: String(u.id),
  }))

  const tabs = [
    { key: 'committee', label: 'Comité' },
    { key: 'level', label: 'Niveau' },
    { key: 'dossier', label: 'Dossier' },
    { key: 'commission', label: 'Commission' },
  ]

  if (isLoading) {
    return (
      <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
        Chargement…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/governance/homologations')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '14px', padding: 0 }}
          >
            ← Retour
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Homologation — {h.service_name ?? h.service_label ?? `Service #${h.service_id ?? ''}`}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <StatusBadge status={h.status ?? ''} />
          <LevelBadge level={h.level ?? null} />
          <DecisionBadge decision={h.decision ?? null} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Comité ── */}
      {activeTab === 'committee' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            <Users size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Membres du comité
          </h3>

          {/* Add member */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <Select
              label="Utilisateur"
              value={addMemberUserId}
              onChange={setAddMemberUserId}
              options={userOptions}
              placeholder="Sélectionner…"
            />
            <Select
              label="Rôle"
              value={addMemberRole}
              onChange={setAddMemberRole}
              options={[
                { label: 'Gérant / DG', value: 'gerant' },
                { label: 'Président du comité', value: 'president' },
                { label: 'RSSI', value: 'rssi' },
                { label: 'DPO', value: 'dpo' },
                { label: 'DSI / Responsable IT', value: 'dsi' },
                { label: 'Responsable métier', value: 'responsable_metier' },
                { label: 'Auditeur interne', value: 'auditeur' },
                { label: 'Expert sécurité', value: 'expert' },
                { label: 'Risk Manager', value: 'risk_manager' },
                { label: 'Compliance Officer', value: 'compliance' },
                { label: 'MOA / MOE', value: 'moe' },
                { label: 'Membre', value: 'membre' },
                { label: 'Rapporteur', value: 'rapporteur' },
              ]}
            />
            <Button
              onClick={() => {
                if (!addMemberUserId) return
                addMemberMutation.mutate({ user_id: Number(addMemberUserId), role: addMemberRole })
              }}
              disabled={!addMemberUserId || addMemberMutation.isPending}
            >
              Ajouter
            </Button>
          </div>

          {/* Members list */}
          {(committee ?? []).length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', padding: '20px', textAlign: 'center' }}>
              Aucun membre
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(committee ?? []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: 'var(--color-bg-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {m.user_name ?? m.display_name ?? `User #${m.user_id ?? ''}`}
                    </span>
                    <Badge variant="default" size="sm">{m.role ?? 'membre'}</Badge>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => removeMemberMutation.mutate(m.id)}
                    disabled={removeMemberMutation.isPending}
                  >
                    Retirer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Niveau ── */}
      {activeTab === 'level' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            <ClipboardList size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Évaluation du niveau
          </h3>

          {/* Current result */}
          {Boolean(h.level) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Niveau actuel :</span>
              <LevelBadge level={h.level ?? null} />
              {Boolean(h.criticality) && (
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Criticité : {CRITICALITY_LABELS[h.criticality ?? ''] ?? h.criticality ?? ''}
                </span>
              )}
              {Boolean(h.exposure) && (
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Exposition : {EXPOSURE_LABELS[h.exposure ?? ''] ?? h.exposure ?? ''}
                </span>
              )}
            </div>
          )}

          {/* Assessment form */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <Select
              label="Criticité"
              value={criticality}
              onChange={setCriticality}
              options={Object.entries(CRITICALITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              placeholder="Sélectionner…"
            />
            <Select
              label="Exposition"
              value={exposure}
              onChange={setExposure}
              options={Object.entries(EXPOSURE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              placeholder="Sélectionner…"
            />
            <Button
              onClick={() => {
                if (!criticality || !exposure) return
                assessMutation.mutate({ criticality, exposure })
              }}
              disabled={!criticality || !exposure || assessMutation.isPending}
            >
              {assessMutation.isPending ? 'Évaluation…' : 'Évaluer'}
            </Button>
          </div>

          {/* Matrix reference */}
          <div style={{ marginTop: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
              Matrice de référence ANSSI
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                borderCollapse: 'collapse',
                fontSize: '13px',
                width: '100%',
                maxWidth: '600px',
              }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid var(--color-border)', padding: '8px 12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                      Criticité \ Exposition
                    </th>
                    {Object.entries(EXPOSURE_LABELS).map(([k, l]) => (
                      <th key={k} style={{ border: '1px solid var(--color-border)', padding: '8px 12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(CRITICALITY_LABELS).map(([cKey, cLabel]) => (
                    <tr key={cKey}>
                      <td style={{ border: '1px solid var(--color-border)', padding: '8px 12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                        {cLabel}
                      </td>
                      {Object.keys(EXPOSURE_LABELS).map((eKey) => {
                        const lvl = MATRIX[cKey]?.[eKey] ?? ''
                        const cfg = levelConfig[lvl as HomoLevel]
                        const bg = cfg
                          ? cfg.variant === 'success' ? 'rgba(34,197,94,0.1)'
                            : cfg.variant === 'warning' ? 'rgba(234,179,8,0.1)'
                            : 'rgba(239,68,68,0.1)'
                          : 'transparent'
                        return (
                          <td
                            key={eKey}
                            style={{
                              border: '1px solid var(--color-border)',
                              padding: '8px 12px',
                              textAlign: 'center',
                              background: bg,
                              color: 'var(--color-text-primary)',
                              fontWeight: 500,
                            }}
                          >
                            {cfg?.label ?? lvl}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Dossier ── */}
      {activeTab === 'dossier' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            <FileCheck size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Documents requis
          </h3>

          {/* Progress */}
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Progression : {validatedCount}/{documents.length} documents validés
          </div>

          {documents.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', padding: '20px', textAlign: 'center' }}>
              Aucun document requis
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: 'var(--color-bg-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {doc.label ?? doc.name ?? `Document #${doc.id}`}
                    </span>
                    {docStatusBadge(doc.status ?? 'pending')}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<CheckCircle size={14} />}
                      onClick={() => validateDocMutation.mutate(doc.id)}
                      disabled={doc.status === 'validated' || validateDocMutation.isPending}
                    >
                      Valider
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<XCircle size={14} />}
                      onClick={() => rejectDocMutation.mutate(doc.id)}
                      disabled={doc.status === 'rejected' || rejectDocMutation.isPending}
                    >
                      Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Commission ── */}
      {activeTab === 'commission' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            <Gavel size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Décision de la commission
          </h3>

          {h.status === 'decided' ? (
            /* Decision already made */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Décision :</span>
                <DecisionBadge decision={h.decision ?? null} />
              </div>
              {h.valid_from && (
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  Validité du : {h.valid_from.slice(0, 10)}
                </div>
              )}
              {h.valid_until && (
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  Validité jusqu'au : {h.valid_until.slice(0, 10)}
                </div>
              )}
              {h.review_date && (
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  Prochaine révision : {h.review_date.slice(0, 10)}
                </div>
              )}
              {h.decision_comment && (
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', marginTop: '8px' }}>
                  <strong>Commentaire :</strong> {h.decision_comment}
                </div>
              )}
            </div>
          ) : (
            /* Decision form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button
                  variant="primary"
                  onClick={() => decideMutation.mutate({ decision: 'favorable', comment: decisionComment })}
                  disabled={decideMutation.isPending}
                >
                  Favorable
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => decideMutation.mutate({ decision: 'reserve', comment: decisionComment })}
                  disabled={decideMutation.isPending}
                >
                  Sous réserve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => decideMutation.mutate({ decision: 'defavorable', comment: decisionComment })}
                  disabled={decideMutation.isPending}
                >
                  Défavorable
                </Button>
              </div>
              <textarea
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Commentaire de la décision…"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Reservations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Réservations
            </h4>

            {reservations.length === 0 ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                Aucune réservation
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reservations.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      background: 'var(--color-bg-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {r.description ?? ''}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {r.due_date && (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            Échéance : {r.due_date.slice(0, 10)}
                          </span>
                        )}
                        <Badge variant={r.status === 'lifted' ? 'success' : 'warning'} size="sm">
                          {r.status === 'lifted' ? 'Levée' : 'En cours'}
                        </Badge>
                      </div>
                    </div>
                    {r.status !== 'lifted' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => liftReservationMutation.mutate(r.id)}
                        disabled={liftReservationMutation.isPending}
                      >
                        Lever
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add reservation */}
            {h.status === 'decided' && (h.decision === 'reserve' || h.decision === 'favorable') && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '12px 0' }}>
                <Input
                  label="Description"
                  value={reservationDesc}
                  onChange={setReservationDesc}
                  placeholder="Description de la réservation…"
                />
                <Input
                  label="Échéance (max 12 mois)"
                  value={reservationDue}
                  onChange={setReservationDue}
                  type="date"
                />
                <Button
                  onClick={() => {
                    if (!reservationDesc) return
                    addReservationMutation.mutate({ description: reservationDesc, due_date: reservationDue || undefined })
                  }}
                  disabled={!reservationDesc || addReservationMutation.isPending}
                >
                  Ajouter
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}