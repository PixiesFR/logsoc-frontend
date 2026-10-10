import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grcBridgeApi } from '../../api'
import { Badge, Modal } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { ContextInfoIcon } from '../../components/ui/ContextInfoIcon'
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer'
import { AssistancePanel } from '../../components/ui/AssistancePanel'
import { DocumentEditor } from '../../components/ui/DocumentEditor'
import { useTranslation } from '../../i18n/useTranslation'
import { FileText, BookOpen, Eye, CheckCircle, Sparkles, Layers, FileEdit, XCircle } from 'lucide-react'

const FRAMEWORK_LABELS: Record<string, string> = {
  ANSSI: 'ANSSI', RGPD: 'RGPD', NIS2: 'NIS2', DORA: 'DORA', ISO27001: 'ISO 27001', Interne: 'Interne', Custom: 'Autre',
}

const FRAMEWORK_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  ANSSI: 'info', RGPD: 'warning', NIS2: 'danger', DORA: 'danger', ISO27001: 'default', Interne: 'default', Custom: 'default',
}

const DRIVER_ORDER = [
  'Stratégie & Alignement',
  'Cadre & Organisation',
  'Conformité & Sécurité',
  'Pilotage & Performance',
]

// Classification de confidentialité
const CLASSIFICATION_LABELS: Record<string, string> = {
  public: 'Public',
  interne: 'Interne',
  confidentiel: 'Confidentiel',
  secret: 'Secret',
}

const CLASSIFICATION_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  public: 'success',
  interne: 'info',
  confidentiel: 'warning',
  secret: 'danger',
}

const CLASSIFICATION_ORDER = ['secret', 'confidentiel', 'interne', 'public']

// Niveau d'obligation
const OBLIGATION_LABELS: Record<string, string> = {
  obligatoire: 'Obligatoire',
  recommande: 'Recommandé',
  envisionne: 'Envisagé',
}

const OBLIGATION_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  obligatoire: 'danger',
  recommande: 'warning',
  envisionne: 'default',
}

const OBLIGATION_ORDER = ['obligatoire', 'recommande', 'envisionne']

// Niveau de pyramide
const PYRAMID_LABELS: Record<number, string> = {
  1: 'Politique',
  2: 'Opérationnel',
}

interface Deliverable {
  id: number
  deliverable_name: string
  description: string
  driver: string
  sub_category: string
  pyramid_level: number
  realization_role: string
  verification_role: string
  validation_role: string
  regulatory_framework: string
  obligation_level: string
  classification_level: string
  is_active: boolean
  is_not_applicable?: boolean
}

interface DocStats {
  deliverable_id: number
  deliverable_name: string
  regulatory_framework: string
  realization_role: string
  driver: string
  sub_category: string
  pyramid_level: number
  total: number
  requirements: number
  information: number
  definition: number
  conforme: number
  en_cours: number
  non_traitee: number
  non_conforme: number
  non_applicable: number
  score_pct: number
}

interface SourceModalState {
  open: boolean
  text: string
  docName: string
  loading: boolean
  columnNames: string[]
}

export function GovernanceDocumentation() {
  const { t } = useTranslation()
  const [selectedDeliverable, setSelectedDeliverable] = useState<string | null>(null)
  const [selectedFramework, setSelectedFramework] = useState<string>('')
  const [selectedClassification, setSelectedClassification] = useState<string>('')
  const [selectedObligation, setSelectedObligation] = useState<string>('')
  const [selectedDocStatus, setSelectedDocStatus] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('driver')
  const [sourceModal, setSourceModal] = useState<SourceModalState>({ open: false, text: '', docName: '', loading: false, columnNames: [] })
  const [showAssistance, setShowAssistance] = useState(false)
  const [modalTab, setModalTab] = useState<'requirements' | 'document'>('requirements')
  const [selectedDelivId, setSelectedDelivId] = useState<number | null>(null)
  const { toast } = useToast()
  const qc = useQueryClient()
  const notApplicableMutation = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) => grcBridgeApi.toggleNotApplicable(id, value),
    onSuccess: () => { toast('success', 'Statut mis à jour'); qc.invalidateQueries({ queryKey: ['grc-deliverables'] }) },
    onError: () => toast('error', 'Erreur'),
  })

  // Fetch deliverables from API (with metadata: pilot, driver, sub_category)
  const { data: delivData } = useQuery<any>({
    queryKey: ['grc-deliverables', selectedFramework],
    queryFn: async () => {
      const params: Record<string, string | boolean> = { active_only: true }
      if (selectedFramework) params.framework = selectedFramework
      const resp = await grcBridgeApi.deliverables(params)
      return resp.data
    },
  })

  // Fetch governance action plan data (for requirement counts)
  const { data: reqData, isLoading } = useQuery<any>({
    queryKey: ['gov-documentation', selectedFramework],
    queryFn: async () => {
      const params: Record<string, string | number> = {}
      if (selectedFramework) params.regulatory_framework = selectedFramework
      const resp = await grcBridgeApi.governanceActionPlan(params)
      return resp.data
    },
  })

  // Merge deliverables with requirement counts + apply filters + sort
  const docStats = useMemo<DocStats[]>(() => {
    if (!delivData?.items) return []
    const reqCounts: Record<string, { total: number; requirements: number; information: number; definition: number; conforme: number; en_cours: number; non_traitee: number; non_conforme: number; non_applicable: number }> = {}

    if (reqData?.items) {
      for (const item of reqData.items) {
        const did = item.deliverable_id || 0
        const fw = item.regulatory_framework || 'Custom'
        const key = `${did}|${fw}`
        if (!reqCounts[key]) {
          reqCounts[key] = { total: 0, requirements: 0, information: 0, definition: 0, conforme: 0, en_cours: 0, non_traitee: 0, non_conforme: 0, non_applicable: 0 }
        }
        const rc = reqCounts[key]
        rc.total++
        if (item.entry_type === 'requirement') rc.requirements++
        else if (item.entry_type === 'information') rc.information++
        else if (item.entry_type === 'definition') rc.definition++
        const s = item.compliance_status || 'Non_traitee'
        if (s === 'Conforme') rc.conforme++
        else if (s === 'En_cours') rc.en_cours++
        else if (s === 'Non_traitee') rc.non_traitee++
        else if (s === 'Non_conforme') rc.non_conforme++
        else if (s === 'Non_applicable') rc.non_applicable++
      }
    }

    let result = delivData.items.map((d: Deliverable): DocStats => {
      const key = `${d.id}|${d.regulatory_framework}`
      const rc = reqCounts[key] || { total: 0, requirements: 0, information: 0, definition: 0, conforme: 0, en_cours: 0, non_traitee: 0, non_conforme: 0, non_applicable: 0 }
      const score = rc.requirements > 0 ? Math.round((rc.conforme / rc.requirements) * 1000) / 10 : 0
      return {
        deliverable_id: d.id,
        deliverable_name: d.deliverable_name,
        regulatory_framework: d.regulatory_framework,
        realization_role: d.realization_role || '—',
        driver: d.driver,
        sub_category: d.sub_category,
        pyramid_level: d.pyramid_level,
        ...rc,
        score_pct: score,
      }
    })

    // Apply classification filter
    if (selectedClassification) {
      result = result.filter((d: DocStats & { classification_level?: string }) => {
        const deliv = delivData.items.find((dd: Deliverable) => dd.id === d.deliverable_id && dd.regulatory_framework === d.regulatory_framework)
        return deliv?.classification_level === selectedClassification
      })
    }

    // Apply obligation filter
    if (selectedObligation) {
      result = result.filter((d: DocStats) => {
        const deliv = delivData.items.find((dd: Deliverable) => dd.id === d.deliverable_id && dd.regulatory_framework === d.regulatory_framework)
        return deliv?.obligation_level === selectedObligation
      })
    }

    // Apply document status filter — CUMULATIF: un statut selectionne inclut
    // tous les statuts superieurs du cycle de vie (un doc publie a bien ete
    // redige/valide/signe). "none" (sans document) et "rejected" restent exacts.
    if (selectedDocStatus) {
      // Ordre du cycle de vie
      const DOC_STATUS_ORDER = ['generated', 'editing', 'saved', 'to_validate', 'pdf_ready', 'published']
      result = result.filter((d: DocStats) => {
        const deliv = delivData.items.find((dd: Deliverable) => dd.id === d.deliverable_id && dd.regulatory_framework === d.regulatory_framework)
        const ds = (deliv as any)?.doc_status
        if (selectedDocStatus === 'none') return !ds
        if (selectedDocStatus === 'rejected') return ds === 'rejected'
        if (!ds) return false
        // Cumulatif: index du statut recherche et du statut du document
        const minIdx = DOC_STATUS_ORDER.indexOf(selectedDocStatus)
        const docIdx = DOC_STATUS_ORDER.indexOf(ds)
        if (minIdx === -1) return ds === selectedDocStatus
        // rejeté = sorti du circuit, jamais "superieur"
        if (docIdx === -1) return false
        return docIdx >= minIdx
      })
    }

    // Sort
    result.sort((a: DocStats, b: DocStats) => {
      const aDeliv = delivData.items.find((dd: Deliverable) => dd.id === a.deliverable_id && dd.regulatory_framework === a.regulatory_framework)
      const bDeliv = delivData.items.find((dd: Deliverable) => dd.id === b.deliverable_id && dd.regulatory_framework === b.regulatory_framework)
      if (!aDeliv || !bDeliv) return 0

      if (sortBy === 'classification') {
        const ac = CLASSIFICATION_ORDER.indexOf(aDeliv.classification_level || 'interne')
        const bc = CLASSIFICATION_ORDER.indexOf(bDeliv.classification_level || 'interne')
        if (ac !== bc) return ac - bc
      } else if (sortBy === 'obligation') {
        const ao = OBLIGATION_ORDER.indexOf(aDeliv.obligation_level || 'recommande')
        const bo = OBLIGATION_ORDER.indexOf(bDeliv.obligation_level || 'recommande')
        if (ao !== bo) return ao - bo
      } else if (sortBy === 'pyramid') {
        if (aDeliv.pyramid_level !== bDeliv.pyramid_level) return aDeliv.pyramid_level - bDeliv.pyramid_level
      } else if (sortBy === 'name') {
        return a.deliverable_name.localeCompare(b.deliverable_name)
      }

      // Default: sort by driver, then sub_category, then name
      const da = DRIVER_ORDER.indexOf(a.driver)
      const db = DRIVER_ORDER.indexOf(b.driver)
      if (da !== db) return da - db
      if (a.sub_category !== b.sub_category) return a.sub_category.localeCompare(b.sub_category)
      return a.deliverable_name.localeCompare(b.deliverable_name)
    })

    return result
  }, [delivData, reqData, selectedClassification, selectedObligation, selectedDocStatus, sortBy])

  // Group by driver
  const groupedByDriver = useMemo(() => {
    const groups: Record<string, DocStats[]> = {}
    for (const doc of docStats) {
      if (!groups[doc.driver]) groups[doc.driver] = []
      groups[doc.driver].push(doc)
    }
    return groups
  }, [docStats])

  // Documents sélectionnés — détails
  const selectedDocs = useMemo(() => {
    if (!selectedDeliverable || !reqData?.items) return []
    return reqData.items.filter((i: any) => {
      const key = `${i.deliverable_id || 0}|${i.regulatory_framework || 'Custom'}`
      return key === selectedDeliverable
    })
  }, [selectedDeliverable, reqData])

  const handleViewSource = async (reqId: number, docName: string) => {
    setSourceModal({ open: true, text: '', docName, loading: true, columnNames: [] })
    try {
      const resp = await grcBridgeApi.source(reqId)
      const d = resp.data
      let text = d.source_text || d.text || ''
      const columnNames = d.column_names || []
      if (text.startsWith('|') && !text.match(/^\|\s*[-:]+\s*\|/m)) {
        const headers = columnNames.length > 0
          ? columnNames
          : ['ref_id', 'entry_type', 'rule', 'target', 'grc_category', 'deliverable_type', 'actor', 'control_frequency', 'criticality']
        const headerLine = '| ' + headers.join(' | ') + ' |'
        const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |'
        text = headerLine + '\n' + separatorLine + '\n' + text
      }
      setSourceModal({ open: true, text, docName, loading: false, columnNames })
    } catch (e) {
      setSourceModal({ open: true, text: 'Erreur lors du chargement', docName, loading: false, columnNames: [] })
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('nav.govDocumentation')}</h1>
      <p style={{ color: 'var(--color-muted, #888)', marginBottom: '1.5rem' }}>
        Liste des documents à produire — exigences (actions), informations (matières premières pour la rédaction), définitions (glossaire)
      </p>

      {/* Filtres */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }} className="filter-bar">
        <select value={selectedFramework} onChange={(e) => setSelectedFramework(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Tous cadres réglementaires</option>
          {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={selectedClassification} onChange={(e) => setSelectedClassification(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Toutes classifications</option>
          {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={selectedObligation} onChange={(e) => setSelectedObligation(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Toutes obligations</option>
          {Object.entries(OBLIGATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={selectedDocStatus} onChange={(e) => setSelectedDocStatus(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
          title="Filtre cumulatif : affiche les documents ayant atteint au moins ce stade (ex: « À valider » inclut en signature et publiés)">
          <option value="">Tous statuts document</option>
          <option value="none">Sans document</option>
          <option value="generated">Au moins rédigé</option>
          <option value="editing">Au moins en édition</option>
          <option value="to_validate">Au moins à valider</option>
          <option value="pdf_ready">Au moins en signature</option>
          <option value="published">Publié (signé)</option>
          <option value="rejected">Rejetés</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="driver">Trier par: Moteur</option>
          <option value="classification">Trier par: Classification</option>
          <option value="obligation">Trier par: Obligation</option>
          <option value="pyramid">Trier par: Niveau pyramide</option>
          <option value="name">Trier par: Nom</option>
        </select>
      </div>

      {/* Liste des documents en tableau groupé par driver (ou tri personnalisé) */}
      {isLoading && !delivData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Chargement...</div>
      ) : docStats.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Aucun document à produire</div>
      ) : sortBy === 'driver' ? (
        <div>
          {DRIVER_ORDER.filter(d => groupedByDriver[d]?.length > 0).map(driver => (
            <div key={driver} style={{ marginBottom: '1.5rem' }}>
              {/* Driver header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                paddingBottom: '0.4rem',
                borderBottom: '2px solid var(--color-border)',
              }}>
                <Layers size={18} style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{driver}</span>
                <Badge variant="default" size="sm">{groupedByDriver[driver].length} document{groupedByDriver[driver].length > 1 ? 's' : ''}</Badge>
              </div>

              {/* Tableau des documents */}
              <DocTable docs={groupedByDriver[driver]} delivData={delivData} selectedDeliverable={selectedDeliverable} onSelect={setSelectedDeliverable} setSelectedDelivId={setSelectedDelivId} onToggleNotApplicable={(id, val) => notApplicableMutation.mutate({ id, value: val })} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <DocTable docs={docStats} delivData={delivData} selectedDeliverable={selectedDeliverable} onSelect={setSelectedDeliverable} setSelectedDelivId={setSelectedDelivId} onToggleNotApplicable={(id, val) => notApplicableMutation.mutate({ id, value: val })} />
        </div>
      )}

      {/* Détail du document sélectionné */}
      {selectedDeliverable && (
        <Modal open={true} onClose={() => { setSelectedDeliverable(null); setShowAssistance(false); setModalTab('requirements') }}
            title={`Cadre normatif et règles obligatoires — ${docStats.find(d => `${d.deliverable_id}|${d.regulatory_framework}` === selectedDeliverable)?.deliverable_name || selectedDeliverable}`}
            size="xl">
            <div style={{ height: 'calc(96vh - 80px)', display: 'flex', flexDirection: 'column' }}>
              {/* Onglets */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.75rem', flexShrink: 0 }} className="modal-tabs">
                <button
                  onClick={() => setModalTab('requirements')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: modalTab === 'requirements' ? 'var(--color-bg-hover)' : 'transparent',
                    color: modalTab === 'requirements' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: 'none', cursor: 'pointer',
                    borderBottom: modalTab === 'requirements' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                  }}
                >
                  <CheckCircle size={14} /> Exigences
                </button>
                <button
                  onClick={() => setModalTab('document')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: modalTab === 'document' ? 'var(--color-bg-hover)' : 'transparent',
                    color: modalTab === 'document' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: 'none', cursor: 'pointer',
                    borderBottom: modalTab === 'document' ? '2px solid var(--color-primary)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                  }}
                >
                  <FileEdit size={14} /> Document
                </button>
              </div>

              {/* Contenu: Exigences */}
              {modalTab === 'requirements' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {/* Bouton Assistance IA */}
                  <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowAssistance(!showAssistance)}
                      style={{
                        padding: '6px 14px',
                        background: showAssistance ? 'var(--color-accent)' : 'transparent',
                        color: showAssistance ? '#fff' : 'var(--color-accent)',
                        border: '1px solid var(--color-accent)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Sparkles size={14} />
                      {showAssistance ? "Masquer l'assistance" : 'Assistance IA'}
                    </button>
                  </div>

                  {/* Panel d'assistance IA */}
                  {showAssistance && (() => {
                    const doc = docStats.find(d => `${d.deliverable_id}|${d.regulatory_framework}` === selectedDeliverable)
                    if (!doc) return null
                    const reqs = selectedDocs
                      .filter((i: any) => i.entry_type === 'requirement')
                      .map((i: any) => i.rule || '')
                      .filter((r: string) => r)
                    return (
                      <div style={{
                        marginBottom: '1rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'var(--color-bg-secondary)',
                        height: '450px',
                      }} className="assist-panel">
                        <AssistancePanel
                          framework={doc.regulatory_framework}
                          deliverableName={doc.deliverable_name}
                          requirements={reqs}
                          onClose={() => setShowAssistance(false)}
                        />
                      </div>
                    )
                  })()}

                  {/* Onglets: requirements / information / definition */}
                  {!showAssistance && <DocumentDetail items={selectedDocs} onViewSource={handleViewSource} />}
                </div>
              )}

              {/* Contenu: Document OnlyOffice */}
              {modalTab === 'document' && selectedDelivId && (
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: '8px' }} className="onlyoffice-container">
                  <DocumentEditor deliverableId={selectedDelivId} deliverableName={docStats.find(d => `${d.deliverable_id}|${d.regulatory_framework}` === selectedDeliverable)?.deliverable_name || 'Document'} />
                </div>
              )}
            </div>
          </Modal>
      )}

      {/* Modal source */}
      {sourceModal.open && (
        <Modal open={sourceModal.open} onClose={() => setSourceModal({ ...sourceModal, open: false })} title={`Source — ${sourceModal.docName}`}>
          {sourceModal.loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div> : <MarkdownRenderer content={sourceModal.text} />}
        </Modal>
      )}
    </div>
  )
}

// Sous-composant: tableau de documents avec classification + obligation
function DocTable({ docs, delivData, selectedDeliverable, onSelect, setSelectedDelivId, onToggleNotApplicable }: {
  docs: DocStats[]
  delivData: any
  selectedDeliverable: string | null
  onSelect: (key: string) => void
  setSelectedDelivId: (id: number) => void
  onToggleNotApplicable: (id: number, value: boolean) => void
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
          <th style={{ padding: '0.5rem 0.6rem', width: '22%' }}>Document</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '8%' }}>Cadre</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '12%' }}>Sous-catégorie</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '12%' }}>Pilote</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '9%', textAlign: 'center' }}>Classification</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '9%', textAlign: 'center' }}>Obligation</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '6%', textAlign: 'center' }}>Niv.</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '5%', textAlign: 'center' }}>Exig.</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '8%', textAlign: 'center' }}>Score</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '9%', textAlign: 'center' }}>Doc</th>
          <th style={{ padding: '0.5rem 0.6rem', width: '7%', textAlign: 'center' }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc) => {
          const key = `${doc.deliverable_id}|${doc.regulatory_framework}`
          const isActive = selectedDeliverable === key
          const deliv = delivData?.items?.find((dd: Deliverable) => dd.id === doc.deliverable_id && dd.regulatory_framework === doc.regulatory_framework)
          const cls = deliv?.classification_level || 'interne'
          const obl = deliv?.obligation_level || 'recommande'
          const pyr = deliv?.pyramid_level || 1
          return (
            <tr
              key={key}
              onClick={() => {
                const key = `${doc.deliverable_id}|${doc.regulatory_framework}`
                onSelect(key)
                setSelectedDelivId(doc.deliverable_id)
              }}
              style={{
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                background: isActive ? 'var(--color-bg-hover)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-hover)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <td style={{ padding: '0.5rem 0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={15} style={{ color: 'var(--color-primary, #3b82f6)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{doc.deliverable_name}</span>
                </div>
              </td>
              <td style={{ padding: '0.5rem 0.6rem' }}>
                <Badge variant={FRAMEWORK_BADGE[doc.regulatory_framework] || 'default'} size="sm">
                  {FRAMEWORK_LABELS[doc.regulatory_framework] || doc.regulatory_framework}
                </Badge>
              </td>
              <td style={{ padding: '0.5rem 0.6rem', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                {doc.sub_category}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem' }}>
                {doc.realization_role || '—'}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                <Badge variant={CLASSIFICATION_BADGE[cls] || 'default'} size="sm">
                  {CLASSIFICATION_LABELS[cls] || cls}
                </Badge>
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                <Badge variant={OBLIGATION_BADGE[obl] || 'default'} size="sm">
                  {OBLIGATION_LABELS[obl] || obl}
                </Badge>
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                {PYRAMID_LABELS[pyr] || `N${pyr}`}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 600 }}>
                {doc.requirements || '—'}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                {doc.requirements > 0 ? (
                  <span style={{ fontWeight: 600, color: doc.score_pct >= 80 ? 'var(--color-success)' : doc.score_pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                    {doc.score_pct}%
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-muted)' }}>—</span>
                )}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                {(() => {
                  const ds = (deliv as any)?.doc_status
                  const dv = (deliv as any)?.doc_version
                  const dval = (deliv as any)?.doc_validation
                  const dsigs = (deliv as any)?.doc_signatures
                  if (!ds) return <span style={{ color: 'var(--color-muted)' }}>—</span>
                  const DOC_STATUS_META: Record<string, { label: string; variant: string }> = {
                    generated: { label: 'Rédigé', variant: 'info' },
                    editing: { label: 'Édition', variant: 'info' },
                    saved: { label: 'Édition', variant: 'info' },
                    to_validate: { label: 'À valider', variant: 'warning' },
                    pdf_ready: { label: dval ? `Sign. ${dval}` : 'Signature', variant: 'warning' },
                    signed: { label: 'Signé', variant: 'success' },
                    published: { label: 'Publié', variant: 'success' },
                    rejected: { label: 'Rejeté', variant: 'danger' },
                  }
                  const meta = DOC_STATUS_META[ds] || { label: ds, variant: 'default' }
                  const tooltip = `Document v${dv}${dsigs ? ` — ${dsigs} signature(s)` : ''}${dval ? ` — direction ${dval}` : ''}`
                  return (
                    <Badge variant={meta.variant as any} size="sm">
                      <span title={tooltip}>{meta.label}</span>
                    </Badge>
                  )
                })()}
              </td>
              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                {deliv && obl !== 'obligatoire' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const msg = deliv.is_not_applicable
                        ? `Marquer ce livrable comme à fournir ?`
                        : `Confirmer : "${doc.deliverable_name}" ne sera pas fourni ?`
                      if (confirm(msg)) {
                        onToggleNotApplicable(deliv.id, !deliv.is_not_applicable)
                      }
                    }}
                    title={deliv.is_not_applicable ? 'Marquer comme fourni' : 'Ne sera pas fourni'}
                    style={{
                      padding: '3px 8px',
                      background: deliv.is_not_applicable ? 'var(--color-danger, #ef4444)' : 'transparent',
                      color: deliv.is_not_applicable ? '#fff' : 'var(--color-danger, #ef4444)',
                      border: '1px solid var(--color-danger, #ef4444)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <XCircle size={12} />
                    {deliv.is_not_applicable ? 'Fourni' : 'Non fourni'}
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// Sous-composant pour afficher les exigences/informations/définitions
function DocumentDetail({ items, onViewSource }: { items: any[]; onViewSource: (id: number, docName: string) => void }) {
  const [tab, setTab] = useState<'requirement' | 'information' | 'definition'>('requirement')
  const filtered = items.filter(i => i.entry_type === tab)

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
        {[
          { key: 'requirement', label: 'Exigences', icon: CheckCircle },
          { key: 'information', label: 'Informations', icon: BookOpen },
          { key: 'definition', label: 'Définitions', icon: FileText },
        ].map(({ key, label, icon: Icon }) => {
          const count = items.filter(i => i.entry_type === key).length
          return (
            <button key={key} onClick={() => setTab(key as any)}
              style={{
                padding: '0.5rem 1rem', background: tab === key ? 'var(--color-bg-hover)' : 'transparent',
              color: tab === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
              }}>
              <Icon size={14} /> {label} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-muted)' }}>Aucune entrée</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.4rem' }}>Réf</th>
              <th style={{ padding: '0.4rem' }}>Texte</th>
              {tab === 'requirement' && <th style={{ padding: '0.4rem' }}>Criticité</th>}
              {tab === 'requirement' && <th style={{ padding: '0.4rem' }}>Statut</th>}
              <th style={{ padding: '0.4rem' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.4rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.ref_id || '—'}</td>
                <td style={{ padding: '0.4rem', maxWidth: '500px' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {item.rule}
                    {tab === 'requirement' && <ContextInfoIcon reqId={item.id} />}
                  </div>
                  {item.target && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>Cible: {item.target}</div>}
                </td>
                {tab === 'requirement' && (
                  <td style={{ padding: '0.4rem' }}>
                    {item.criticality && <Badge variant={item.criticality === 'Critique' ? 'danger' : item.criticality === 'Majeure' ? 'warning' : 'default'}>{item.criticality}</Badge>}
                  </td>
                )}
                {tab === 'requirement' && (
                  <td style={{ padding: '0.4rem', fontSize: '0.8rem' }}>{item.compliance_status?.replace(/_/g, ' ') || '—'}</td>
                )}
                <td style={{ padding: '0.4rem' }}>
                  <button onClick={() => onViewSource(item.id, item.document_name)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }}>
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}