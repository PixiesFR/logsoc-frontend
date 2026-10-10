import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { homologationApi, businessServicesApi, committeesApi } from '../../api'
import { Badge, Button, Modal, Select } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Plus } from 'lucide-react'

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

// ── Component ──

export function Homologations() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedCommitteeId, setSelectedCommitteeId] = useState('')

  // Fetch list
  const { data: homologations, isLoading } = useQuery({
    queryKey: ['homologations'],
    queryFn: () => homologationApi.list().then((r) => r.data),
  })

  // Fetch business services for dropdown
  const { data: services } = useQuery({
    queryKey: ['business-services'],
    queryFn: () => businessServicesApi.list().then((r) => r.data),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homologationApi.create(data),
    onSuccess: () => {
      toast('success', 'Homologation créée')
      qc.invalidateQueries({ queryKey: ['homologations'] })
      setShowCreate(false)
      setSelectedServiceId('')
      setSelectedCommitteeId('')
    },
    onError: () => toast('error', 'Erreur lors de la création'),
  })

  const items = (Array.isArray(homologations) ? homologations : (homologations as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const serviceItems = (Array.isArray(services) ? services : (services as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const serviceOptions = serviceItems.map((s) => ({
    label: String(s.name ?? s.label ?? `Service #${s.id}`),
    value: String(s.id),
  }))

  // Fetch committees
  const { data: committees } = useQuery({
    queryKey: ['committees-for-homologation'],
    queryFn: () => committeesApi.list().then(r => r.data),
  })
  const committeeItems = (Array.isArray(committees) ? committees : (committees as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const committeeOptions = committeeItems.map((c) => ({
    label: String(c.name ?? ''), value: String(c.id),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Homologations
        </h1>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Nouvelle homologation
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px' }}>
          Aucune homologation
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((h) => (
            <div
              key={String(h.id)}
              onClick={() => navigate(`/governance/homologations/${h.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                background: 'var(--color-bg-secondary)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
              <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {String(h.service_name ?? h.service_label ?? `Service #${h.service_id ?? ''}`)}
              </span>
              <StatusBadge status={String(h.status ?? '')} />
              <LevelBadge level={h.level as string | null | undefined} />
              <DecisionBadge decision={h.decision as string | null | undefined} />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {h.valid_until ? String(h.valid_until).slice(0, 10) : '—'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {h.review_date ? String(h.review_date).slice(0, 10) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setSelectedServiceId('') }}
        title="Nouvelle homologation"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setSelectedServiceId('') }}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!selectedServiceId) return
                createMutation.mutate({ service_id: Number(selectedServiceId), committee_id: selectedCommitteeId ? Number(selectedCommitteeId) : undefined })
              }}
              disabled={!selectedServiceId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label="Service métier"
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            options={serviceOptions}
            placeholder="Sélectionner un service…"
            required
          />
          <Select
            label="Comité (Codir/Comex)"
            value={selectedCommitteeId}
            onChange={setSelectedCommitteeId}
            options={committeeOptions}
            placeholder="Sélectionner un comité…"
          />
        </div>
      </Modal>
    </div>
  )
}