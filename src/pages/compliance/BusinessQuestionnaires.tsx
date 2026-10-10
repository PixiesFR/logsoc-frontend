import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Badge, Modal } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { practicesApi } from '../../api'
import { useAuthStore } from '../../stores'
import { ClipboardList, Send, CheckCircle, FileText } from 'lucide-react'

/**
 * Directions métier (13/09) — questionnaires de validation des services.
 * Deux domaines: RGPD (créé/clôturé par le DPO) et Homologation (RSSI) —
 * chacun son domaine. Le service répond, le créateur du domaine clôture.
 * Les membres du service voient et répondent à LEURS questionnaires.
 */

const QTYPE_LABELS: Record<string, string> = {
  rgpd_processing: 'Inventaire RGPD',
  essential_activities: 'Activités essentielles',
}

const STATUS_VARIANTS: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  brouillon: 'default',
  envoye: 'info',
  repondu: 'warning',
  valide: 'success',
}

export function BusinessQuestionnaires() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const role = user?.role || ''
  const isDpo = role === 'dpo'
  const isRssi = role === 'rssi'
  const isStrong = ['admin', 'superadmin'].includes(role)

  const { data, isLoading } = useQuery({
    queryKey: ['business-questionnaires'],
    queryFn: () => practicesApi.questionnaires.list().then(r => r.data as {
      items: { id: number; service_id: number; service_name: string; qtype: string; title: string; status: string; answered: number; total_questions: number }[]
    }),
  })

  const [selected, setSelected] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const createMutation = useMutation({
    mutationFn: (d: { service_id: number; qtype: string }) => practicesApi.questionnaires.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-questionnaires'] })
      toast('success', 'Questionnaire créé')
      setShowCreate(false)
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const sendMutation = useMutation({
    mutationFn: (id: number) => practicesApi.questionnaires.send(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-questionnaires'] })
      toast('success', 'Questionnaire envoyé au service')
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const validateMutation = useMutation({
    mutationFn: (id: number) => practicesApi.questionnaires.validate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-questionnaires'] })
      toast('success', 'Questionnaire clôturé')
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  // Droits de création: DPO (rgpd), RSSI (homologation), admin
  const canCreate = isDpo || isRssi || isStrong

  if (isLoading) return <div style={{ padding: '2rem' }}>Chargement…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Directions métier</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Questionnaires de validation des services — RGPD (DPO) et activités essentielles homologation (RSSI), chacun son domaine.
          </p>
        </div>
        {canCreate && <Button onClick={() => setShowCreate(true)}>+ Nouveau questionnaire</Button>}
      </div>

      {(data?.items ?? []).length === 0 ? (
        <Card>
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <ClipboardList size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>Aucun questionnaire — créez-en un pour un service pour lancer la validation.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data!.items.map((q) => (
            <Card key={q.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
                <div style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => setSelected(q.id)}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{q.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {QTYPE_LABELS[q.qtype] || q.qtype} · {q.answered}/{q.total_questions} réponses
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Badge variant={STATUS_VARIANTS[q.status] || 'default'} size="sm">{q.status}</Badge>
                  {q.status === 'brouillon' && (isDpo || isRssi || isStrong) && (
                    <Button variant="secondary" size="sm" onClick={() => sendMutation.mutate(q.id)}>
                      <Send size={13} /> Envoyer
                    </Button>
                  )}
                  {q.status === 'repondu' && (
                    ((q.qtype === 'rgpd_processing' && (isDpo || isStrong)) ||
                     (q.qtype === 'essential_activities' && (isRssi || isStrong))) ? (
                      <Button size="sm" onClick={() => validateMutation.mutate(q.id)}>
                        <CheckCircle size={13} /> Clôturer
                      </Button>
                    ) : null
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setSelected(q.id)}>
                    <FileText size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected !== null && (
        <QuestionnaireDetail id={selected} onClose={() => setSelected(null)} />
      )}

      {showCreate && (
        <CreateQuestionnaireModal
          onClose={() => setShowCreate(false)}
          onCreate={(d) => createMutation.mutate(d)}
          pending={createMutation.isPending}
          onlyRgpd={isDpo && !isStrong && !isRssi}
          onlyHomolog={isRssi && !isStrong && !isDpo}
        />
      )}
    </div>
  )
}


function CreateQuestionnaireModal({ onClose, onCreate, pending, onlyRgpd, onlyHomolog }:
  { onClose: () => void; onCreate: (d: { service_id: number; qtype: string }) => void; pending: boolean; onlyRgpd: boolean; onlyHomolog: boolean }) {
  const { data: services } = useQuery({
    queryKey: ['services-all'],
    queryFn: () => import('../../api').then(m => m.api.get('/api/v1/services')),
  })
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [qtype, setQtype] = useState(onlyRgpd ? 'rgpd_processing' : onlyHomolog ? 'essential_activities' : 'rgpd_processing')

  const items = ((services as any)?.data?.items ?? (services as any)?.data ?? []) as { id: number; name: string }[]

  return (
    <Modal open onClose={onClose} title="Nouveau questionnaire">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600 }}>Type</label>
          <select
            value={qtype}
            onChange={(e) => setQtype(e.target.value)}
            disabled={onlyRgpd || onlyHomolog}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
          >
            {(!onlyHomolog) && <option value="rgpd_processing">Inventaire RGPD (8 questions — DPO)</option>}
            {(!onlyRgpd) && <option value="essential_activities">Activités essentielles homologation (5 questions — RSSI)</option>}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600 }}>Service</label>
          <select
            value={serviceId ?? ''}
            onChange={(e) => setServiceId(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
          >
            <option value="">— choisir un service</option>
            {items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          Le questionnaire est créé en brouillon avec les questions standard du domaine.
          Vous pourrez l'envoyer au service ensuite (il apparaîtra dans la vue de ses membres).
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => serviceId && onCreate({ service_id: serviceId, qtype })} disabled={!serviceId || pending}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  )
}


function QuestionnaireDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['questionnaire', id],
    queryFn: () => practicesApi.questionnaires.get(id).then(r => r.data as {
      title: string; status: string; qtype: string; service_name: string
      questions: { id: number; text: string; qtype: string; prefill: string | null; required: boolean; answer: string | null }[]
    }),
  })
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const submitMutation = useMutation({
    mutationFn: () => practicesApi.questionnaires.submit(id, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questionnaire', id] })
      qc.invalidateQueries({ queryKey: ['business-questionnaires'] })
      toast('success', 'Réponses enregistrées')
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  if (isLoading || !data) return <Modal open onClose={onClose} title="…"><div>Chargement…</div></Modal>

  const isOpen = data.status === 'envoye' || data.status === 'repondu'

  return (
    <Modal open onClose={onClose} title={data.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {QTYPE_LABELS[data.qtype]} · Service {data.service_name} · statut {data.status}
        </div>
        {data.questions.map((qq, i) => (
          <div key={qq.id}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>
              {i + 1}. {qq.text}
              {qq.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
            </label>
            {qq.qtype === 'booleen' ? (
              <select
                value={answers[qq.id] ?? qq.answer ?? ''}
                disabled={!isOpen}
                onChange={(e) => setAnswers({ ...answers, [qq.id]: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
              >
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            ) : (
              <textarea
                value={answers[qq.id] ?? qq.answer ?? ''}
                disabled={!isOpen}
                placeholder={qq.prefill || 'Votre réponse…'}
                onChange={(e) => setAnswers({ ...answers, [qq.id]: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
              />
            )}
          </div>
        ))}
        {isOpen && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              Enregistrer les réponses
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}