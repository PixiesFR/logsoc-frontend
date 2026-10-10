import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { policyDocumentsApi, grcBridgeApi } from '../../api'
import { Card, Badge, Select, Table, Button, Modal, Input, ConfirmDialog, MarkdownRenderer } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuthStore } from '../../stores'
import { useToast } from '../../components/ui/Toast'
import { FileText, Upload, Download, Sparkles, CheckCircle, Trash2, Edit2, Loader2, Wand2, ChevronLeft, ChevronRight, Clock, BookOpen, FileDown, Eye, Pencil, RefreshCw } from 'lucide-react'
import { PolicyDocumentEditor } from '../../components/ui/PolicyDocumentEditor'

function categoryBadgeVariant(cat: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (cat) {
    case 'pssi': return 'info'
    case 'charter': return 'success'
    case 'data_gov': return 'warning'
    case 'backup': return 'danger'
    case 'iam': return 'default'
    case 'reference': return 'info'
    case 'governance': return 'info'
    default: return 'default'
  }
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'approved': return 'success'
    case 'draft': return 'default'
    case 'obsolete': return 'danger'
    case 'reference': return 'info'
    default: return 'default'
  }
}

function actionTypeIcon(actionType: string) {
  switch (actionType) {
    case 'imported': return <Upload size={14} />
    case 'analyzed': return <Sparkles size={14} />
    case 'downloaded': return <Download size={14} />
    case 'deleted': return <Trash2 size={14} />
    case 'edited': return <Edit2 size={14} />
    case 'reviewed_dsi': return <CheckCircle size={14} />
    case 'reviewed_direction': return <CheckCircle size={14} />
    default: return <Clock size={14} />
  }
}

function actionTypeLabel(actionType: string): string {
  const labels: Record<string, string> = {
    imported: 'Import',
    analyzed: 'Analyse IA',
    downloaded: 'Telechargement',
    deleted: 'Suppression',
    edited: 'Modification',
    reviewed_dsi: 'Validation DSI',
    reviewed_direction: 'Validation Direction',
  }
  return labels[actionType] || actionType
}

// Wizard category definitions (mirror of backend ANSSI_STEPS keys)
const WIZARD_CATEGORIES = [
  { value: 'pssi', labelKey: 'policies.wizardCategoryPssi' },
  { value: 'charter', labelKey: 'policies.wizardCategoryCharter' },
  { value: 'data_gov', labelKey: 'policies.wizardCategoryDataGov' },
  { value: 'backup', labelKey: 'policies.wizardCategoryBackup' },
  { value: 'iam', labelKey: 'policies.wizardCategoryIam' },
] as const

const SIZE_OPTIONS = [
  { value: 'TPE', label: 'TPE (<10)' },
  { value: 'PME', label: 'PME (10-250)' },
  { value: 'ETI', label: 'ETI (250-5000)' },
  { value: 'Grande entreprises', label: 'Grande entreprise (>5000)' },
]

const SECTOR_OPTIONS = [
  { value: 'Sante', label: 'Sante' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Industrie', label: 'Industrie' },
  { value: 'Public', label: 'Public' },
  { value: 'Services', label: 'Services' },
  { value: 'Autre', label: 'Autre' },
]

const MATURITY_OPTIONS = [
  { value: 'debutant', labelKey: 'policies.beginner' },
  { value: 'intermediaire', labelKey: 'policies.intermediate' },
  { value: 'avance', labelKey: 'policies.advanced' },
]

const COMPLIANCE_OPTIONS = ['NIS2', 'DORA', 'ISO27001', 'RGPD', 'HDS', 'PCI-DSS', 'SOC2']

interface WizardStepData {
  step: number
  title: string
  content: string
}

type UploadProgressStep = 'idle' | 'importing' | 'extracting' | 'analyzing' | 'finalizing' | 'done' | 'error'

export function Policies() {
  const { t } = useTranslation()
  const { isAdmin, isRssi, role } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const canUpload = isAdmin || isRssi
  const canAnalyze = isAdmin || isRssi || role === 'compliance_officer'
  const expertMode = useAuthStore((s) => s.expertMode)

  const closeAndRefresh = () => {
    qc.invalidateQueries({ queryKey: ['policyDocuments'] })
    qc.invalidateQueries({ queryKey: ['policyDocument'] })
    qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisProgress'] })
    qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisResults'] })
    qc.invalidateQueries({ queryKey: ['policyDocumentAudit'] })
  }

  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [docNameSearch, setDocNameSearch] = useState('')
  const [activePolicyTab, setActivePolicyTab] = useState<'documents' | 'references'>('documents')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showEditor, setShowEditor] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [analyzing, setAnalyzing] = useState<number | null>(null)

  // Reference import progress
  const [uploadProgress, setUploadProgress] = useState<UploadProgressStep>('idle')

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0) // 0 = company info, 1..N = steps, N+1 = review
  const [wizardCategory, setWizardCategory] = useState('')
  const [wizardSteps, setWizardSteps] = useState<WizardStepData[]>([])
  const [wizardGenerating, setWizardGenerating] = useState(false)
  const [wizardFinalizing, setWizardFinalizing] = useState(false)

  // Company info
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState('PME')
  const [companySector, setCompanySector] = useState('Services')
  const [companySites, setCompanySites] = useState(1)
  const [companySystems, setCompanySystems] = useState('')
  const [companyCompliance, setCompanyCompliance] = useState<string[]>([])
  const [companyMaturity, setCompanyMaturity] = useState('intermediaire')
  const [wizardDocName, setWizardDocName] = useState('')
  const [wizardDocVersion, setWizardDocVersion] = useState('')

  // Upload form
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('other')
  const [formDeliverableId, setFormDeliverableId] = useState<string>('')
  const [formVersion, setFormVersion] = useState('1.0')
  const [formDescription, setFormDescription] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [skipAnalysis, setSkipAnalysis] = useState(false)
  const [formOrganism, setFormOrganism] = useState('ANSSI')
  const [formCountry, setFormCountry] = useState('FR')
  const [inlineEditDesc, setInlineEditDesc] = useState(false)
  const [inlineDescValue, setInlineDescValue] = useState('')

  // Edit form
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('other')
  const [editVersion, setEditVersion] = useState('1.0')
  const [editStatus, setEditStatus] = useState('draft')
  const [editDescription, setEditDescription] = useState('')

  // Page-by-page analysis state
  const [showPageResults, setShowPageResults] = useState(false)
  const [showViewAnalysis, setShowViewAnalysis] = useState(false)
  const [viewAnalysis, setViewAnalysis] = useState<unknown>('')
  const [launchingAnalysis, setLaunchingAnalysis] = useState(false)

  // Documents tab: exclude references
  const docListParams: Record<string, string> = { exclude_reference: 'true' }
  if (categoryFilter) docListParams.category = categoryFilter
  if (statusFilter) docListParams.status = statusFilter

  const refParams: Record<string, string> = { status: 'reference' }
  if (categoryFilter) refParams.category = categoryFilter

  // Always fetch both lists so tab counters are correct
  const { data: documentsList, isLoading: docsLoading } = useQuery({
    queryKey: ['policyDocuments', 'docs', categoryFilter, statusFilter],
    queryFn: () => policyDocumentsApi.list(docListParams).then((r) => r.data),
  })

  // Fetch active deliverables for upload dropdown (not not-applicable)
  const { data: deliverablesForUpload } = useQuery({
    queryKey: ['deliverables-for-upload'],
    queryFn: () => grcBridgeApi.deliverables({ active_only: 'true' }).then((r) => r.data),
  })

  const { data: referencesList, isLoading: refsLoading } = useQuery({
    queryKey: ['policyDocuments', 'refs', categoryFilter],
    queryFn: () => policyDocumentsApi.list(refParams).then((r) => r.data),
  })

  // Active tab determines which list to display
  const documents = activePolicyTab === 'references' ? referencesList : documentsList
  const isLoading = activePolicyTab === 'references' ? refsLoading : docsLoading

  const { data: detail } = useQuery({
    queryKey: ['policyDocument', selectedId],
    queryFn: () => policyDocumentsApi.get(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  // Fetch audit trail for selected document
  const { data: auditTrail } = useQuery({
    queryKey: ['policyDocumentAudit', selectedId],
    queryFn: () => policyDocumentsApi.getAudit(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  // Page-by-page analysis progress (polling when analyzing) — always called, enabled controls execution
  const { data: analysisProgress } = useQuery({
    queryKey: ['policyDocumentAnalysisProgress', selectedId],
    queryFn: () => policyDocumentsApi.analysisProgress(selectedId!).then((r) => r.data as Record<string, unknown>),
    enabled: selectedId !== null,
    refetchInterval: (query) => {
      const data = query.state.data as Record<string, unknown> | undefined
      return data?.status === 'analyzing' ? 3000 : false
    },
  })

  // Page-by-page analysis results (full)
  const { data: analysisResults } = useQuery({
    queryKey: ['policyDocumentAnalysisResults', selectedId],
    queryFn: () => policyDocumentsApi.analysisResults(selectedId!).then((r) => r.data as Record<string, unknown>[]),
    enabled: selectedId !== null,
  })

  // Fetch wizard steps when category changes
  const { data: wizardStepDefs } = useQuery({
    queryKey: ['wizardSteps', wizardCategory],
    queryFn: () => policyDocumentsApi.wizardSteps(wizardCategory).then((r) => r.data),
    enabled: !!wizardCategory,
  })

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => policyDocumentsApi.upload(formData),
    onSuccess: () => {
      if (activePolicyTab === 'references') {
        toast('success', t('policies.importSuccess') || 'Referentiel importe. Analyse en cours en arriere-plan.')
      } else {
        toast('success', t('policies.uploadSuccess'))
      }
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      setShowUpload(false)
      resetUploadForm()
      setUploadProgress('idle')
    },
    onError: () => {
      setUploadProgress('error')
      toast('error', t('policies.uploadError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => policyDocumentsApi.delete(id),
    onSuccess: () => {
      toast('success', t('policies.uploadSuccess'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      setDeleteId(null)
      if (selectedId) setSelectedId(null)
    },
    onError: () => toast('error', t('policies.uploadError')),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => policyDocumentsApi.approve(id),
    onSuccess: () => {
      toast('success', t('policies.approveSuccess'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      qc.invalidateQueries({ queryKey: ['policyDocument'] })
    },
    onError: () => toast('error', t('policies.uploadError')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; body: Record<string, unknown> }) =>
      policyDocumentsApi.update(data.id, data.body),
    onSuccess: () => {
      toast('success', t('policies.uploadSuccess'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      qc.invalidateQueries({ queryKey: ['policyDocument'] })
      setShowEdit(false)
    },
    onError: () => toast('error', t('policies.uploadError')),
  })

  const reviewDsiMutation = useMutation({
    mutationFn: (id: number) => policyDocumentsApi.reviewDsi(id),
    onSuccess: () => {
      toast('success', t('policies.reviewedByDsi'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      qc.invalidateQueries({ queryKey: ['policyDocument'] })
    },
    onError: () => toast('error', t('policies.uploadError')),
  })

  const reviewDirectionMutation = useMutation({
    mutationFn: (id: number) => policyDocumentsApi.reviewDirection(id),
    onSuccess: () => {
      toast('success', t('policies.reviewedByDirection'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      qc.invalidateQueries({ queryKey: ['policyDocument'] })
    },
    onError: () => toast('error', t('policies.uploadError')),
  })

  function resetUploadForm() {
    setFormName('')
    setFormCategory('other')
    setFormVersion('1.0')
    setFormDescription('')
    setFormFile(null)
    setSkipAnalysis(false)
    setFormOrganism('ANSSI')
    setFormCountry('FR')
  }

  function resetWizard() {
    setWizardStep(0)
    setWizardCategory('')
    setWizardSteps([])
    setWizardGenerating(false)
    setWizardFinalizing(false)
    setCompanyName('')
    setCompanySize('PME')
    setCompanySector('Services')
    setCompanySites(1)
    setCompanySystems('')
    setCompanyCompliance([])
    setCompanyMaturity('intermediaire')
    setWizardDocName('')
    setWizardDocVersion('')
  }

  function handleUpload() {
    if (activePolicyTab === 'references') {
      // Reference import: only description + file, status=reference
      if (!formFile) return
      if (!formDescription.trim()) {
        toast('error', t('policies.descriptionRequired') || 'La description est obligatoire')
        return
      }
      const fd = new FormData()
      fd.append('name', formFile.name)
      fd.append('category', 'reference')
      fd.append('version', '1.0')
      fd.append('status', 'reference')
      fd.append('description', formDescription)
      fd.append('file', formFile)
      fd.append('organism', formOrganism)
      fd.append('country', formCountry)
      if (skipAnalysis) fd.append('skip_analysis', 'true')
      // Upload returns instantly, page-by-page analysis runs in background
      uploadMutation.mutate(fd)
    } else {
      // Standard document upload
      if (!formDeliverableId || !formFile) return
      const fd = new FormData()
      fd.append('name', formName)
      fd.append('category', formDeliverableId ? 'governance' : formCategory)
      fd.append('version', formVersion)
      fd.append('description', formDescription)
      fd.append('file', formFile)
      if (formDeliverableId) fd.append('deliverable_id', formDeliverableId)
      uploadMutation.mutate(fd)
    }
  }

  function handleAnalyze(id: number) {
    setAnalyzing(id)
    policyDocumentsApi.analyze(id)
      .then(() => {
        toast('success', t('policies.analyzeSuccess'))
        qc.invalidateQueries({ queryKey: ['policyDocument', id] })
        qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      })
      .catch(() => toast('error', t('policies.analyzeError')))
      .finally(() => setAnalyzing(null))
  }

  function handleDownload(id: number, fileName: string) {
    policyDocumentsApi.download(id).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch(() => toast('error', t('policies.downloadError') || 'Erreur de telechargement'))
  }

  function handleLaunchPageAnalysis(id: number) {
    setLaunchingAnalysis(true)
    policyDocumentsApi.analyzePages(id)
      .then(() => {
        toast('success', t('policies.analysisInProgress') || 'Analyse en cours...')

        qc.invalidateQueries({ queryKey: ['policyDocuments'] })
        qc.invalidateQueries({ queryKey: ['policyDocument', id] })
        qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisProgress', id] })
        qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisResults', id] })
      })
      .catch(() => toast('error', t('policies.analyzeError')))
      .finally(() => setLaunchingAnalysis(false))
  }

  function handleDownloadAnalysis(id: number, fileName: string) {
    policyDocumentsApi.analysisDownload(id).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = (fileName || 'analysis').replace(/\.[^.]+$/, '') + '_analysis.md'
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch(() => toast('error', t('policies.downloadError') || 'Erreur de telechargement'))
  }

  function openEdit(d: Record<string, unknown>) {
    setEditName(String(d.name ?? ''))
    setEditCategory(String(d.category ?? 'other'))
    setEditVersion(String(d.version ?? '1.0'))
    setEditStatus(String(d.status ?? 'draft'))
    setEditDescription(String(d.description ?? ''))
    setShowEdit(true)
  }

  // Wizard: generate content for current step
  const handleWizardGenerate = useCallback(async (improve = false) => {
    if (!wizardCategory) return
    const currentStepDef = wizardStepDefs as Array<{ step: number; title: string; description: string }> | undefined
    if (!currentStepDef) return
    const stepIndex = wizardStep - 1
    const stepDef = currentStepDef[stepIndex]
    if (!stepDef) return

    setWizardGenerating(true)
    try {
      const companyInfo = {
        name: companyName,
        size: companySize,
        sector: companySector,
        sites: companySites,
        systems: companySystems,
        compliance: companyCompliance,
        maturity: companyMaturity,
      }
      const currentContent = wizardSteps[stepIndex]?.content || ''
      const previousSteps = wizardSteps.slice(0, stepIndex).map((s) => ({
        step: s.step,
        title: s.title,
        content: s.content,
      }))

      const payload: Record<string, unknown> = {
        category: wizardCategory,
        step: stepDef.step,
        company_info: companyInfo,
        current_content: improve ? currentContent : '',
        previous_steps: previousSteps,
      }

      const _res = await policyDocumentsApi.wizardGenerate(payload)
      const generated = (_res.data as Record<string, unknown>).generated_content as string || ''

      setWizardSteps((prev) => {
        const copy = [...prev]
        copy[stepIndex] = { step: stepDef.step, title: stepDef.title, content: generated }
        return copy
      })
    } catch {
      toast('error', t('policies.analyzeError'))
    } finally {
      setWizardGenerating(false)
    }
  }, [wizardCategory, wizardStep, wizardStepDefs, companyName, companySize, companySector, companySites, companySystems, companyCompliance, companyMaturity, wizardSteps, toast, t])

  // Wizard: finalize document
  const handleWizardFinalize = useCallback(async () => {
    if (!wizardCategory || !wizardDocName) return
    setWizardFinalizing(true)
    try {
      const companyInfo = {
        name: companyName,
        size: companySize,
        sector: companySector,
        sites: companySites,
        systems: companySystems,
        compliance: companyCompliance,
        maturity: companyMaturity,
      }
      const usedIA = wizardSteps.some(s => s.content.length > 0)
      await policyDocumentsApi.wizardFinalize({
        category: wizardCategory,
        name: wizardDocName,
        company_info: companyInfo,
        steps: wizardSteps.map((s) => ({ step: s.step, title: s.title, content: s.content })),
        generated_by_ia: usedIA,
      })
      toast('success', t('policies.wizardSuccess'))
      qc.invalidateQueries({ queryKey: ['policyDocuments'] })
      setShowWizard(false)
      resetWizard()
    } catch {
      toast('error', t('policies.uploadError'))
    } finally {
      setWizardFinalizing(false)
    }
  }, [wizardCategory, wizardDocName, wizardSteps, companyName, companySize, companySector, companySites, companySystems, companyCompliance, companyMaturity, toast, t, qc])

  const allItems = (Array.isArray(documents) ? documents : []) as Record<string, unknown>[]
  const items = docNameSearch
    ? allItems.filter(d => String(d.name || '').toLowerCase().includes(docNameSearch.toLowerCase()))
    : allItems
  const doc = detail as Record<string, unknown> | null

  const categoryOptions = [
    { label: t('common.all'), value: '' },
    { label: t('policies.pssi'), value: 'pssi' },
    { label: t('policies.charter'), value: 'charter' },
    { label: t('policies.dataGov'), value: 'data_gov' },
    { label: t('policies.backup'), value: 'backup' },
    { label: t('policies.iam'), value: 'iam' },
    { label: t('policies.other'), value: 'other' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('policies.draft'), value: 'draft' },
    { label: t('policies.approved'), value: 'approved' },
    { label: t('policies.obsolete'), value: 'obsolete' },
  ]

  const columns = [
    { key: 'name', label: t('governance.policies.title_field') },
    ...(activePolicyTab === 'references' ? [{ key: 'description', label: 'Description' }] : []),
    { key: 'category', label: t('policies.category'), width: '140px' },
    { key: 'version', label: t('policies.version'), width: '80px' },
    { key: 'status', label: t('policies.status'), width: '120px' },
    ...(activePolicyTab === 'references' ? [{ key: 'analysis', label: t('policies.pageAnalysis') || 'Analyse', width: '120px' }] : []),
    { key: 'file_size', label: t('policies.fileSize'), width: '100px' },
    { key: 'created_at', label: t('common.date') || 'Date', width: '140px' },
  ]

  // Compute wizard total steps
  const totalWizardSteps = wizardStepDefs ? (wizardStepDefs as Array<unknown>).length : 0
  const totalWizardPages = totalWizardSteps + 2

  // Pre-fill document name with codification when entering review step
  useEffect(() => {
    if (wizardStep === totalWizardSteps + 1 && totalWizardSteps > 0 && !wizardDocName) {
      const categoryCode = wizardCategory.toUpperCase()
      const orgName = companyName.replace(/[^a-zA-Z0-9]/g, '')
      const usedIA = wizardSteps.some(s => s.content.length > 0)
      const suffix = usedIA ? '-IA' : ''
      const version = usedIA ? 'V-01-IA' : 'V-01'
      setWizardDocName(`${categoryCode}-${orgName}${suffix}`)
      setWizardDocVersion(version)
    }
  }, [wizardStep, totalWizardSteps, wizardDocName, wizardCategory, companyName, wizardSteps])

  // Current step content
  const currentStepIndex = wizardStep - 1
  const currentStepDef = (wizardStepDefs as Array<{ step: number; title: string; description: string }> | undefined)?.[currentStepIndex]
  const currentStepContent = wizardSteps[currentStepIndex]?.content || ''

  // Audit trail entries
  const auditEntries = (Array.isArray(auditTrail) ? auditTrail : []) as Record<string, unknown>[]

  // Progress bar width based on upload step
  function getProgressWidth(step: UploadProgressStep): string {
    switch (step) {
      case 'idle': return '0%'
      case 'importing': return '15%'
      case 'extracting': return '35%'
      case 'analyzing': return '65%'
      case 'finalizing': return '90%'
      case 'done': return '100%'
      case 'error': return '0%'
      default: return '0%'
    }
  }

  function getProgressLabel(step: UploadProgressStep): string {
    switch (step) {
      case 'importing': return t('policies.importing') || 'Import en cours...'
      case 'extracting': return t('policies.extracting') || 'Extraction du texte...'
      case 'analyzing': return t('policies.analyzingRef') || 'Analyse IA en cours...'
      case 'finalizing': return t('policies.finalizing') || 'Finalisation...'
      case 'done': return t('policies.importSuccess') || 'Referentiel importe et analyse'
      case 'error': return t('policies.uploadError') || 'Erreur'
      default: return ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('policies.title')}
        </h1>
        {canUpload && activePolicyTab === 'documents' && (
          <Button icon={<Upload size={16} />} onClick={() => setShowUpload(true)}>
            {t('policies.upload')}
          </Button>
        )}
        {canUpload && activePolicyTab === 'references' && (
          <Button icon={<Upload size={16} />} onClick={() => { setUploadProgress('idle'); setShowUpload(true) }}>
            {t('policies.uploadRef') || 'Importer un referentiel'}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setActivePolicyTab('documents')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activePolicyTab === 'documents' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activePolicyTab === 'documents' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            fontWeight: activePolicyTab === 'documents' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {t('policies.documents') || 'Bibliothèque'} ({(documentsList as unknown[] | undefined)?.length ?? 0})
        </button>
        <button
          onClick={() => setActivePolicyTab('references')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activePolicyTab === 'references' ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activePolicyTab === 'references' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            fontWeight: activePolicyTab === 'references' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {t('policies.references') || 'Referentiels'} ({(referencesList as unknown[] | undefined)?.length ?? 0})
        </button>
      </div>

      {activePolicyTab === 'references' && (
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} label={t('policies.category')} />
        </div>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={docNameSearch}
          onChange={e => setDocNameSearch(e.target.value)}
          style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '250px' }}
        />
      </div>
      )}
      {activePolicyTab === 'documents' && (
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} label={t('policies.category')} />
        </div>
        <div style={{ minWidth: '180px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('policies.status')} />
        </div>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={docNameSearch}
          onChange={e => setDocNameSearch(e.target.value)}
          style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '250px' }}
        />
      </div>
      )}

      {items.length === 0 && !isLoading ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
        }}>
          <FileText size={48} style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>
            {t('policies.title')}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('policies.noAnalysis')}
          </p>
        </div>
      ) : (
        <Table
          columns={columns}
          data={items}
          loading={isLoading}
          emptyMessage={t('governance.policies.noPolicies')}
          renderCell={(col, row) => {
            if (col.key === 'category') {
              return <Badge variant={categoryBadgeVariant(String(row.category))}>{t(`policies.${row.category}`) || String(row.category)}</Badge>
            }
            if (col.key === 'status') {
              return <Badge variant={statusBadgeVariant(String(row.status))}>{t(`policies.${row.status}`) || String(row.status)}</Badge>
            }
            if (col.key === 'file_size') {
              if (String(row.status) === 'reference') return '—'
              const size = Number(row.file_size) || 0
              return size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : size > 0 ? `${(size / 1024).toFixed(1)} KB` : '—'
            }
            if (col.key === 'analysis') {
              if (Boolean(row.skip_analysis)) return <Badge variant="default">IA Non Requis</Badge>
              const aStatus = String(row.analysis_status ?? 'not_started')
              if (aStatus === 'analyzing') return <Badge variant="info">En cours</Badge>
              if (aStatus === 'pending') return <Badge variant="warning">En file</Badge>
              if (aStatus === 'done') return (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <Badge variant="success">Termine</Badge>
                  {Boolean(row.needs_review) && <span title="Le format du prompt a change"><Badge variant="warning">A revoir</Badge></span>}
                </div>
              )
              if (aStatus === 'partial') return (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <Badge variant="warning">Partiel</Badge>
                  {Boolean(row.needs_review) && <span title="Le format du prompt a change"><Badge variant="warning">A revoir</Badge></span>}
                </div>
              )
              if (aStatus === 'error') return <Badge variant="danger">Erreur</Badge>
              if (aStatus === 'paused') return <Badge variant="default">Interrompu</Badge>
              return <Badge variant="default">Non demarree</Badge>
            }
            if (col.key === 'description') {
              const desc = String(row.description ?? '')
              if (inlineEditDesc && Number(row.id) === selectedId && expertMode) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '300px' }}>
                    <textarea
                      value={inlineDescValue}
                      onChange={(e) => setInlineDescValue(e.target.value)}
                      rows={2}
                      autoFocus
                      style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={(e) => {
                        e.stopPropagation()
                        policyDocumentsApi.update(Number(row.id), { description: inlineDescValue })
                          .then(() => { toast('success', 'Description mise a jour'); setInlineEditDesc(false); window.location.reload() })
                          .catch(() => toast('error', 'Erreur'))
                      }}>OK</button>
                      <button style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditDesc(false) }}>X</button>
                    </div>
                  </div>
                )
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '300px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{desc || '—'}</span>
                  {expertMode && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '2px', flexShrink: 0 }} title="Editer la description" onClick={(e) => { e.stopPropagation(); setInlineDescValue(desc); setInlineEditDesc(true); setSelectedId(Number(row.id)) }}>
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              )
            }
            if (col.key === 'name') {
              return (
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: 0, font: 'inherit', textAlign: 'left' }}
                  onClick={() => setSelectedId(Number(row.id))}
                >
                  {String(row.name)}
                </button>
              )
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* ─── Wizard Modal (full-screen) ─── */}
      {showWizard && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { setShowWizard(false); resetWizard(); closeAndRefresh() }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
            style={{
              background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '12px',
              width: '95vw', maxWidth: '1100px', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                {t('policies.wizardTitle')}
              </h2>
              <button onClick={() => { setShowWizard(false); resetWizard() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                ✕
              </button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', padding: '12px 24px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
              {Array.from({ length: totalWizardPages }).map((_, idx) => {
                const isCurrent = wizardStep === idx
                const isCompleted = wizardStep > idx
                let label = idx === 0 ? t('policies.wizardStep0') : idx === totalWizardPages - 1 ? t('policies.wizardReview') : `${t('policies.wizardStep')} ${idx}/${totalWizardSteps}`
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 600,
                      background: isCurrent ? 'var(--color-accent)' : isCompleted ? 'var(--color-success)' : 'var(--color-bg-secondary)',
                      color: isCurrent || isCompleted ? '#fff' : 'var(--color-text-secondary)',
                      border: `1px solid ${isCurrent ? 'var(--color-accent)' : isCompleted ? 'var(--color-success)' : 'var(--color-border)'}`,
                    }}>{isCompleted ? '✓' : idx + 1}</div>
                    <span style={{ fontSize: '12px', color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
                    {idx < totalWizardPages - 1 && <div style={{ width: '24px', height: '2px', background: 'var(--color-border)', margin: '0 4px' }} />}
                  </div>
                )
              })}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* Step 0: Company Info */}
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('policies.wizardStep0')}</h3>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('policies.wizardCategory')}</label>
                    <Select value={wizardCategory} onChange={(v) => {
                      setWizardCategory(v)
                      setWizardSteps([])
                      setWizardStep(0)
                    }} options={[
                      { label: '—', value: '' },
                      ...WIZARD_CATEGORIES.map(c => ({ label: t(c.labelKey), value: c.value })),
                    ]} />
                  </div>

                  <Input label={t('policies.companyName')} value={companyName} onChange={setCompanyName} required />
                  <Select label={t('policies.companySize')} value={companySize} onChange={setCompanySize} options={SIZE_OPTIONS} />
                  <Select label={t('policies.companySector')} value={companySector} onChange={setCompanySector} options={SECTOR_OPTIONS} />
                  <Input label={t('policies.companySites')} value={String(companySites)} onChange={(v) => setCompanySites(Number(v) || 1)} />
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('policies.companySystems')}</label>
                    <textarea
                      value={companySystems}
                      onChange={(e) => setCompanySystems(e.target.value)}
                      rows={2}
                      placeholder="Active Directory, Linux, Cloud..."
                      style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('policies.compliance')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {COMPLIANCE_OPTIONS.map((c) => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={companyCompliance.includes(c)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCompanyCompliance([...companyCompliance, c])
                              } else {
                                setCompanyCompliance(companyCompliance.filter((x) => x !== c))
                              }
                            }}
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Select label={t('policies.maturity')} value={companyMaturity} onChange={setCompanyMaturity} options={MATURITY_OPTIONS.map(o => ({ ...o, label: t(o.labelKey) }))} />
                </div>
              )}

              {/* Steps 1..N: Content Steps */}
              {wizardStep >= 1 && wizardStep <= totalWizardSteps && currentStepDef && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
                      {t('policies.wizardStep')} {wizardStep}/{totalWizardSteps} : {currentStepDef.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{currentStepDef.description}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      icon={wizardGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      onClick={() => handleWizardGenerate(false)}
                      disabled={wizardGenerating}
                    >
                      {wizardGenerating ? t('policies.generating') : t('policies.generate')}
                    </Button>
                    {currentStepContent && (
                      <Button
                        variant="secondary"
                        icon={wizardGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        onClick={() => handleWizardGenerate(true)}
                        disabled={wizardGenerating}
                      >
                        {wizardGenerating ? t('policies.generating') : t('policies.improve')}
                      </Button>
                    )}
                  </div>

                  <textarea
                    value={currentStepContent}
                    onChange={(e) => {
                      const copy = [...wizardSteps]
                      copy[currentStepIndex] = { ...copy[currentStepIndex], content: e.target.value }
                      if (!copy[currentStepIndex]) {
                        copy[currentStepIndex] = { step: currentStepDef.step, title: currentStepDef.title, content: e.target.value }
                      }
                      setWizardSteps(copy)
                    }}
                    rows={14}
                    placeholder="Saisissez le contenu ou generez-le avec l'IA..."
                    style={{
                      padding: '12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none',
                      width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6',
                    }}
                  />
                </div>
              )}

              {/* Final Step: Review */}
              {wizardStep === totalWizardSteps + 1 && totalWizardSteps > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('policies.wizardReview')}</h3>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <Input label={t('policies.wizardDocName')} value={wizardDocName} onChange={setWizardDocName} required />
                    </div>
                    <div style={{ width: '160px' }}>
                      <Input label={t('policies.wizardDocVersion')} value={wizardDocVersion} onChange={setWizardDocVersion} required />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {wizardSteps.map((s, idx) => {
                      return (
                        <Card key={idx}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                            {t('policies.wizardStep')} {s.step}/{totalWizardSteps} : {s.title}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                            {s.content || '(vide)'}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--color-border)' }}>
              <Button
                variant="secondary"
                icon={<ChevronLeft size={16} />}
                onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
                disabled={wizardStep === 0}
              >
                {t('policies.wizardPrevious')}
              </Button>

              {wizardStep < totalWizardSteps + 1 ? (
                <Button
                  icon={<ChevronRight size={16} />}
                  onClick={() => {
                    if (wizardStep === 0 && !wizardCategory) {
                      toast('error', t('policies.wizardSelectCategory'))
                      return
                    }
                    if (wizardStep === 0 && wizardStepDefs) {
                      const defs = wizardStepDefs as Array<{ step: number; title: string; description: string }>
                      const initialized = defs.map(d => ({
                        step: d.step,
                        title: d.title,
                        content: wizardSteps.find(ws => ws.step === d.step)?.content || '',
                      }))
                      setWizardSteps(initialized)
                    }
                    setWizardStep(wizardStep + 1)
                  }}
                  disabled={wizardStep === 0 && !wizardCategory}
                >
                  {t('policies.wizardNext')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={wizardFinalizing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  onClick={handleWizardFinalize}
                  disabled={wizardFinalizing || !wizardDocName}
                >
                  {wizardFinalizing ? t('policies.generating') : t('policies.wizardFinalize')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <Modal open={showUpload} onClose={() => { setShowUpload(false); resetUploadForm(); setUploadProgress('idle'); closeAndRefresh() }} title={activePolicyTab === 'references' ? (t('policies.uploadRef') || 'Importer un referentiel') : t('policies.upload')} size="lg">
          {activePolicyTab === 'references' && uploadProgress !== 'idle' ? (
            /* Progress display for reference import */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '32px 0' }}>
              {uploadProgress !== 'error' && uploadProgress !== 'done' && (
                <Loader2 size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
              )}
              {uploadProgress === 'done' && (
                <CheckCircle size={40} style={{ color: 'var(--color-success)' }} />
              )}
              {uploadProgress === 'error' && (
                <span style={{ color: 'var(--color-danger)', fontSize: '16px' }}>{t('policies.uploadError')}</span>
              )}
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {getProgressLabel(uploadProgress)}
              </div>
              {/* Progress bar */}
              <div style={{ width: '100%', maxWidth: '400px', height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: getProgressWidth(uploadProgress),
                  height: '100%',
                  background: uploadProgress === 'error' ? 'var(--color-danger)' : 'var(--color-accent)',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {uploadProgress !== 'error' && uploadProgress !== 'done' && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  {t('policies.analyzingRef') || 'Analyse IA en cours...'}
                  <br />
                  <span style={{ fontSize: '12px' }}>Cela peut prendre 1 a 3 minutes</span>
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activePolicyTab === 'references' ? (
                /* Simplified upload for references: only description + file */
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.policies.content') || 'Description'} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      placeholder="Description obligatoire du référentiel..."
                      style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('policies.upload')}</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.doc"
                      onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                      style={{ fontSize: '14px' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={skipAnalysis}
                      onChange={(e) => setSkipAnalysis(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    {t('policies.skipAnalysis') || 'Ne pas lancer l\'analyse IA apres l\'import'}
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Organisme *</label>
                      <input
                        type="text"
                        value={formOrganism}
                        onChange={(e) => setFormOrganism(e.target.value)}
                        placeholder="ANSSI, BSI, ENISA..."
                        style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Pays *</label>
                      <select value={formCountry} onChange={(e) => setFormCountry(e.target.value)} style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>
                        <option value="FR">France</option>
                        <option value="DE">Allemagne</option>
                        <option value="UK">Royaume-Uni</option>
                        <option value="ES">Espagne</option>
                        <option value="IT">Italie</option>
                        <option value="BE">Belgique</option>
                        <option value="NL">Pays-Bas</option>
                        <option value="LU">Luxembourg</option>
                        <option value="PT">Portugal</option>
                        <option value="IE">Irlande</option>
                        <option value="DK">Danemark</option>
                        <option value="SE">Suede</option>
                        <option value="NO">Norvege</option>
                        <option value="FI">Finlande</option>
                        <option value="PL">Pologne</option>
                        <option value="AT">Autriche</option>
                        <option value="CH">Suisse</option>
                        <option value="CZ">Republique Tcheque</option>
                        <option value="RO">Roumanie</option>
                        <option value="BG">Bulgarie</option>
                        <option value="HR">Croatie</option>
                        <option value="EE">Estonie</option>
                        <option value="LV">Lettonie</option>
                        <option value="LT">Lituanie</option>
                        <option value="SI">Slovenie</option>
                        <option value="SK">Slovaquie</option>
                        <option value="HU">Hongrie</option>
                        <option value="EL">Grece</option>
                        <option value="CY">Chypre</option>
                        <option value="MT">Malte</option>
                      </select>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    L'IA extraira automatiquement le titre, la version et les points cles du document.
                  </p>
                </>
              ) : (
                /* Standard upload for documents */
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Livrable associé</label>
                    <select
                      value={formDeliverableId}
                      onChange={(e) => {
                        setFormDeliverableId(e.target.value)
                        const selected = (deliverablesForUpload as any)?.items?.find((d: any) => String(d.id) === e.target.value)
                        if (selected) {
                          setFormName(selected.deliverable_name)
                          setFormDescription(selected.description || '')
                        }
                      }}
                      style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="">— Sélectionner un livrable —</option>
                      {((deliverablesForUpload as any)?.items || [])
                        .filter((d: any) => !d.is_not_applicable)
                        .map((d: any) => (
                          <option key={d.id} value={d.id}>{d.deliverable_name} ({d.regulatory_framework})</option>
                        ))}
                    </select>
                  </div>
                  <Input label={t('policies.version')} value={formVersion} onChange={setFormVersion} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.policies.content')}</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('policies.upload')}</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.doc"
                      onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                      style={{ fontSize: '14px' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          {activePolicyTab === 'references' && uploadProgress !== 'idle' ? null : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => { setShowUpload(false); resetUploadForm(); setUploadProgress('idle'); closeAndRefresh() }}>{t('common.cancel')}</Button>
              <Button
                onClick={handleUpload}
                disabled={
                  activePolicyTab === 'references'
                    ? !formFile || uploadMutation.isPending
                    : !formDeliverableId || !formFile || uploadMutation.isPending
                }
              >
                {uploadMutation.isPending ? '...' : (activePolicyTab === 'references' ? (t('policies.uploadRef') || 'Importer') : t('policies.upload'))}
              </Button>
            </div>
          )}
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedId !== null && doc && (
        <Modal open={selectedId !== null} onClose={() => { setSelectedId(null); setShowEditor(true); closeAndRefresh() }} title={String(doc.name ?? '')} size={showEditor ? 'xxl' : 'lg'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: showEditor ? 'calc(96vh - 80px)' : 'auto' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge variant={categoryBadgeVariant(String(doc.category))}>{t(`policies.${doc.category}`) || String(doc.category)}</Badge>
              <Badge variant={statusBadgeVariant(String(doc.status))}>{t(`policies.${doc.status}`) || String(doc.status)}</Badge>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('policies.version')}: {String(doc.version ?? '1.0')}
              </span>
              {Boolean(doc.generated_by_ia) && (
                <Badge variant="info">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Sparkles size={12} /> {t('policies.generatedByAI')}</span>
                </Badge>
              )}
              {doc.revision != null && (
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('policies.revision')}: {String(doc.revision)}
                </span>
              )}
              {(String(doc.category) !== 'reference' && Number(doc.file_size) > 0) && (
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('policies.fileSize')}: {Number(doc.file_size) > 1024 * 1024 ? `${(Number(doc.file_size) / (1024 * 1024)).toFixed(1)} MB` : `${(Number(doc.file_size) / 1024).toFixed(1)} KB`}
                </span>
              )}
            </div>

            {/* Review Status (non-reference documents) */}
            {String(doc.category) !== 'reference' && Boolean(doc.review_status) && (
              <Card>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                  {t('policies.reviewStatus')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {String(doc.review_status) === 'pending_review' && (
                    <Badge variant="warning">{t('policies.pendingReview')}</Badge>
                  )}
                  {String(doc.review_status) === 'reviewed_dsi' && (
                    <Badge variant="info">{t('policies.reviewedByDsi')}</Badge>
                  )}
                  {String(doc.review_status) === 'approved' && (
                    <Badge variant="success">{t('policies.reviewedByDirection')}</Badge>
                  )}
                  {Boolean(doc.reviewed_dsi_at) && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      DSI: #{String(doc.reviewed_by_dsi ?? '')} — {String(doc.reviewed_dsi_at ?? '')}
                    </span>
                  )}
                  {Boolean(doc.reviewed_direction_at) && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Direction: #{String(doc.reviewed_by_direction ?? '')} — {String(doc.reviewed_direction_at ?? '')}
                    </span>
                  )}
                </div>
              </Card>
            )}

            {(doc.description || expertMode) && !(showEditor && String(doc.category) !== 'reference' && Number(doc.file_size) > 0) ? (
              <Card>
                {inlineEditDesc && expertMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      value={inlineDescValue}
                      onChange={(e) => setInlineDescValue(e.target.value)}
                      rows={3}
                      autoFocus
                      style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="primary" onClick={() => {
                        policyDocumentsApi.update(Number(doc.id), { description: inlineDescValue })
                          .then(() => {
                            toast('success', 'Description mise a jour')
                            setInlineEditDesc(false)
                            window.location.reload()
                          })
                          .catch(() => toast('error', 'Erreur'))
                      }}>{t('common.save') || 'Enregistrer'}</Button>
                      <Button variant="secondary" onClick={() => setInlineEditDesc(false)}>{t('common.cancel') || 'Annuler'}</Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap', flex: 1 }}>{String(doc.description) || (expertMode ? 'Aucune description' : '—')}</p>
                    {expertMode && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '4px', flexShrink: 0 }} title="Editer la description" onClick={() => { setInlineDescValue(String(doc.description ?? '')); setInlineEditDesc(true) }}>
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                )}
              </Card>
            ) : null}

            {doc.approved_by ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                {t('policies.approvedBy')}: #{String(doc.approved_by)} — {String(doc.approved_at ?? '')}
              </div>
            ) : null}

            {/* OnlyOffice Editor Section — split view when open */}
            {String(doc.category) !== 'reference' && Number(doc.file_size) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button
                    onClick={() => setShowEditor(!showEditor)}
                    style={{
                      padding: '4px 12px',
                      background: showEditor ? 'var(--color-accent)' : 'var(--color-card)',
                      color: showEditor ? '#fff' : 'var(--color-text)',
                      border: `1px solid ${showEditor ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {showEditor ? <Eye size={14} /> : <Pencil size={14} />}
                    {showEditor ? 'Masquer le document' : 'Afficher le document'}
                  </button>
                </div>
                {showEditor && (
                  <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
                    {/* Left: OnlyOffice editor */}
                    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }} className="onlyoffice-container">
                      <PolicyDocumentEditor
                        docId={Number(doc.id)}
                        docName={String(doc.name ?? 'Document')}
                        canEdit={canUpload || role === 'dpo'}
                      />
                    </div>
                    {/* Right: Analysis & actions */}
                    <div style={{ width: '400px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Description / Cadre normatif */}
                      {doc.description ? (
                        <Card>
                          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{String(doc.description as string)}</p>
                        </Card>
                      ) : null}
                      {/* AI Analysis */}
                      <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('policies.analysisResult')}</h3>
                        </div>
                        {Boolean(doc.ai_analysis) && (
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => { setViewAnalysis(doc.ai_analysis); setShowViewAnalysis(true) }}>
                              {t('policies.viewAnalysis') || 'Visualiser'}
                            </Button>
                            <Button size="sm" variant="secondary" icon={<FileDown size={14} />} onClick={() => handleDownloadAnalysis(Number(doc.id), String(doc.file_name || 'analysis'))}>
                              {t('policies.downloadAnalysis') || 'Télécharger'}
                            </Button>
                          </div>
                        )}
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('policies.noAnalysis')}</p>
                      </Card>

                      {/* Review status */}
                      {String(doc.category) !== 'reference' && Boolean(doc.review_status) && (
                        <Card>
                          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{t('policies.reviewStatus')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {String(doc.review_status) === 'pending_review' && <Badge variant="warning">{t('policies.pendingReview')}</Badge>}
                            {String(doc.review_status) === 'reviewed_dsi' && <Badge variant="info">{t('policies.reviewedByDsi')}</Badge>}
                            {String(doc.review_status) === 'approved' && <Badge variant="success">{t('policies.reviewedByDirection')}</Badge>}
                          </div>
                        </Card>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Number(doc.file_size) > 0 && (
                          <Button variant="secondary" icon={<Download size={16} />} onClick={() => handleDownload(Number(doc.id), String(doc.file_name))}>
                            {t('policies.download')}
                          </Button>
                        )}
                        {canUpload && String(doc.category) !== 'reference' && (
                          <Button variant="secondary" icon={<Upload size={16} />} onClick={() => {
                            // Find deliverable_id from doc name and open upload pre-selected
                            const deliv = (deliverablesForUpload as any)?.items?.find((d: any) => d.deliverable_name === String(doc.name))
                            if (deliv) {
                              setFormDeliverableId(String(deliv.id))
                              setFormName(deliv.deliverable_name)
                              setFormDescription(deliv.description || '')
                            }
                            setShowUpload(true)
                          }}>
                            Remplacer le document
                          </Button>
                        )}
                        {canUpload && String(doc.category) !== 'reference' && doc.review_status === 'pending_review' && (isAdmin || isRssi) && (
                          <Button variant="secondary" icon={<CheckCircle size={16} />} onClick={() => reviewDsiMutation.mutate(Number(doc.id))} disabled={reviewDsiMutation.isPending}>
                            {reviewDsiMutation.isPending ? '...' : t('policies.validateDsi')}
                          </Button>
                        )}
                        {canUpload && String(doc.category) !== 'reference' && doc.review_status === 'reviewed_dsi' && isAdmin && (
                          <Button variant="primary" icon={<CheckCircle size={16} />} onClick={() => reviewDirectionMutation.mutate(Number(doc.id))} disabled={reviewDirectionMutation.isPending}>
                            {reviewDirectionMutation.isPending ? '...' : t('policies.validateDirection')}
                          </Button>
                        )}
                        {canUpload && String(doc.status) !== 'reference' && String(doc.status) === 'draft' && !doc.review_status && (
                          <Button variant="primary" icon={<CheckCircle size={16} />} onClick={() => approveMutation.mutate(Number(doc.id))} disabled={approveMutation.isPending}>
                            {t('policies.approve')}
                          </Button>
                        )}
                        {canUpload && String(doc.status) !== 'reference' && (
                          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteId(Number(doc.id))}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis Section — only shown when editor is NOT open (single column mode) */}
            <div style={{ display: (showEditor && String(doc.category) !== 'reference' && Number(doc.file_size) > 0) ? 'none' : 'block' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('policies.analysisResult')}</h3>
                </div>
                {Boolean(doc.ai_analysis) && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => { setViewAnalysis(doc.ai_analysis); setShowViewAnalysis(true) }}>
                      {t('policies.viewAnalysis') || 'Visualiser l\'analyse'}
                    </Button>
                    <Button size="sm" variant="secondary" icon={<FileDown size={14} />} onClick={() => handleDownloadAnalysis(Number(doc.id), String(doc.file_name || 'analysis'))}>
                      {t('policies.downloadAnalysis') || 'Telecharger'}
                    </Button>
                  </div>
                )}
              </div>
              {analyzing === selectedId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{t('policies.analyzing')}</span>
                </div>
              ) : doc.ai_analysis ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('policies.noAnalysis')}</p>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('policies.noAnalysis')}</p>
              )}
            </Card>

            {/* Page-by-page analysis section (references only) */}
            {String(doc.status) === 'reference' && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                    {t('policies.pageAnalysis') || 'Analyse page par page'}
                  </h3>
                </div>

                {(() => {
                  const progress = analysisProgress as Record<string, unknown> | undefined
                  const totalPages = Number(progress?.total_pages ?? 0)
                  const analyzedPages = Number(progress?.analyzed_pages ?? 0)
                  const skippedPages = Number(progress?.skipped_pages ?? 0)
                  const errorPages = Number(progress?.error_pages ?? 0)
                  const currentPage = Number(progress?.current_page ?? 0)
                  const _pages = Array.isArray(progress?.pages) ? progress.pages as Record<string, unknown>[] : []
                  const _analyzingCount = _pages.filter((p) => String(p?.status) === 'analyzing').length
                  const analysisStatus = String(progress?.status ?? 'not_started')
                  const queuePosition = Number(progress?.queue_position ?? -1)
                  const queueSize = Number(progress?.queue_size ?? 0)
                  const pct = totalPages > 0 ? Math.round(((analyzedPages + skippedPages + errorPages) / totalPages) * 100) : 0

                  return (
                    <>
                      {/* Status badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        {analysisStatus === 'not_started' && (
                          <Badge variant="default">{t('policies.notStarted') || 'Non demarree'}</Badge>
                        )}
                        {analysisStatus === 'analyzing' && (
                          <Badge variant="info">
                            <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite', marginRight: '4px' }} />
                            {t('policies.analysisInProgress') || 'Analyse en cours...'}
                          </Badge>
                        )}
                        {analysisStatus === 'pending' && queuePosition > 0 && (
                          <Badge variant="warning">
                            {t('policies.inQueue') || 'En file d\'attente'} ({queuePosition}/{queueSize})
                          </Badge>
                        )}
                        {analysisStatus === 'done' && (
                          <Badge variant="success">{t('policies.analysisComplete') || 'Analyse terminee'}</Badge>
                        )}
                        {analysisStatus === 'partial' && (
                          <Badge variant="warning">Analyse partielle</Badge>
                        )}
                        {analysisStatus === 'error' && (
                          <Badge variant="danger">Analyse en erreur</Badge>
                        )}

                        {totalPages > 0 && (
                          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            {_analyzingCount > 1
                              ? `Pages ${currentPage}-${currentPage + _analyzingCount - 1} / ${totalPages} (batch de ${_analyzingCount})`
                              : t('policies.pageProgress', { current: currentPage, total: totalPages }) || `Page ${currentPage} / ${totalPages}`}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {totalPages > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ width: '100%', height: '8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: errorPages > 0 ? 'var(--color-warning)' : 'var(--color-accent)',
                              borderRadius: '4px',
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            <span>{analyzedPages} {t('policies.pagesAnalyzed') || 'pages analysees'}</span>
                            {skippedPages > 0 && <span>{skippedPages} {t('policies.pagesSkipped') || 'pages ignorees'}</span>}
                            {errorPages > 0 && <span style={{ color: 'var(--color-danger)' }}>{errorPages} {t('policies.pagesError') || 'pages en erreur'}</span>}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(analysisStatus === 'not_started' || analysisStatus === 'pending' || analysisStatus === 'paused' || !progress) && canAnalyze && (
                          <Button
                            icon={launchingAnalysis ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            onClick={() => handleLaunchPageAnalysis(Number(doc.id))}
                            disabled={launchingAnalysis}
                          >
                            {t('policies.launchAnalysis') || 'Lancer l\'analyse'}
                          </Button>
                        )}
                        {analysisStatus === 'analyzing' && canAnalyze && (
                          <Button
                            variant="danger"
                            icon={<Loader2 size={16} className="animate-spin" />}
                            onClick={() => {
                              policyDocumentsApi.stopAnalysis(Number(doc.id))
                                .then(() => {
                                  toast('success', t('policies.analysisStopped') || 'Analyse arretee')
                                  qc.invalidateQueries({ queryKey: ['policyDocuments'] })
                                  qc.invalidateQueries({ queryKey: ['policyDocument', selectedId] })
                                  qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisProgress', selectedId] })
                                  qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisResults', selectedId] })
                                })
                                .catch(() => toast('error', 'Erreur'))
                            }}
                          >
                            {t('policies.stopAnalysis') || 'Arreter l\'analyse'}
                          </Button>
                        )}
                        {analysisStatus === 'done' && canAnalyze && (
                          <Button
                            variant="secondary"
                            icon={launchingAnalysis ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            onClick={() => handleLaunchPageAnalysis(Number(doc.id))}
                            disabled={launchingAnalysis}
                          >
                            {t('policies.reAnalyze') || 'Relancer l\'analyse'}
                          </Button>
                        )}
                        {analysisStatus === 'partial' && canAnalyze && (
                          <Button
                            variant="secondary"
                            icon={launchingAnalysis ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            onClick={() => handleLaunchPageAnalysis(Number(doc.id))}
                            disabled={launchingAnalysis}
                          >
                            {t('policies.reAnalyze') || 'Relancer l\'analyse'}
                          </Button>
                        )}
                        {(analysisStatus === 'done' || analysisStatus === 'partial' || analyzedPages > 0) && (
                          <Button
                            variant="secondary"
                            icon={<Eye size={16} />}
                            onClick={() => setShowPageResults(true)}
                          >
                            {t('policies.viewByPage') || 'Voir par page'}
                          </Button>
                        )}
                        {analysisStatus === 'done' && !doc.ai_analysis && canAnalyze && (
                          <Button
                            variant="primary"
                            icon={<Sparkles size={16} />}
                            onClick={() => {
                              policyDocumentsApi.compileAnalysis(Number(doc.id))
                                .then(() => {
                                  toast('success', 'Resultats compiles')
                                  window.location.reload()
                                })
                                .catch(() => toast('error', 'Erreur lors de la compilation'))
                            }}
                          >
                            {t('policies.compileResults') || 'Compiler les resultats'}
                          </Button>
                        )}
                        {(analysisStatus === 'done' || analysisStatus === 'partial') && !Boolean(doc.requirements_parsed) && canAnalyze && (
                          <Button
                            variant="primary"
                            icon={<FileText size={16} />}
                            onClick={() => {
                              policyDocumentsApi.parseRequirements(Number(doc.id))
                                .then((r) => {
                                  const data = r.data as Record<string, unknown>
                                  toast('success', String(data.message || 'Exigences integrees'))
                                  window.location.reload()
                                })
                                .catch(() => toast('error', 'Erreur lors de l\'integration'))
                            }}
                          >
                            {t('policies.parseRequirements') || 'Integrer les exigences'}
                          </Button>
                        )}
                      </div>
                    </>
                  )
                })()}
              </Card>
            )}

            {/* Audit Trail / History Section */}
            {auditEntries.length > 0 && (
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('policies.history') || 'Historique des actions'}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditEntries.map((entry: Record<string, unknown>) => (
                    <div key={String(entry.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ color: 'var(--color-accent)', marginTop: '2px' }}>
                        {actionTypeIcon(String(entry.action_type))}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {actionTypeLabel(String(entry.action_type))}
                          {Boolean(entry.username) && (
                            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> par {String(entry.username)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {String(entry.timestamp ?? '')}
                        </div>
                        {Boolean(entry.details) ? (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                            {String(entry.details as string)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              {Number(doc.file_size) > 0 && (
                <Button variant="secondary" icon={<Download size={16} />} onClick={() => handleDownload(Number(doc.id), String(doc.file_name))}>
                  {t('policies.download')}
                </Button>
              )}
              {String(doc.status) === 'reference' && (!doc.file_size || Number(doc.file_size) === 0) && (
                (() => {
                  const desc = String(doc.description ?? '')
                  const urlMatch = desc.match(/https:\/\/[^\s)]+/)
                  return urlMatch ? (
                    <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer">
                      <Button variant="primary" icon={<Download size={16} />}>
                        {t('policies.accessDoc') || 'Acceder au document'}
                      </Button>
                    </a>
                  ) : null
                })()
              )}
              {canAnalyze && String(doc.category) !== 'reference' && (
                <Button
                  icon={<Sparkles size={16} />}
                  onClick={() => handleAnalyze(Number(doc.id))}
                  disabled={analyzing === selectedId}
                >
                  {analyzing === selectedId ? t('policies.analyzing') : t('policies.analyze')}
                </Button>
              )}
              {/* Review workflow buttons (non-reference) */}
              {canUpload && String(doc.category) !== 'reference' && doc.review_status === 'pending_review' && (isAdmin || isRssi) && (
                <Button
                  variant="secondary"
                  icon={<CheckCircle size={16} />}
                  onClick={() => reviewDsiMutation.mutate(Number(doc.id))}
                  disabled={reviewDsiMutation.isPending}
                >
                  {reviewDsiMutation.isPending ? '...' : t('policies.validateDsi')}
                </Button>
              )}
              {canUpload && String(doc.category) !== 'reference' && doc.review_status === 'reviewed_dsi' && isAdmin && (
                <Button
                  variant="primary"
                  icon={<CheckCircle size={16} />}
                  onClick={() => reviewDirectionMutation.mutate(Number(doc.id))}
                  disabled={reviewDirectionMutation.isPending}
                >
                  {reviewDirectionMutation.isPending ? '...' : t('policies.validateDirection')}
                </Button>
              )}
              {canUpload && String(doc.status) !== 'reference' && String(doc.status) === 'draft' && !doc.review_status && (
                <Button variant="primary" icon={<CheckCircle size={16} />} onClick={() => approveMutation.mutate(Number(doc.id))} disabled={approveMutation.isPending}>
                  {t('policies.approve')}
                </Button>
              )}
              {canUpload && String(doc.status) !== 'reference' && (
                <>
                  <Button variant="secondary" icon={<Edit2 size={16} />} onClick={() => openEdit(doc)}>{t('common.edit') || 'Edit'}</Button>
                  <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteId(Number(doc.id))}>{t('common.delete') || 'Delete'}</Button>
                </>
              )}
              {/* Delete button for references (admin only) */}
              {String(doc.status) === 'reference' && isAdmin && (
                <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteId(Number(doc.id))}>{t('common.delete') || 'Delete'}</Button>
              )}
            </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Page-by-page Analysis Results Modal */}
      {showPageResults && selectedId !== null && (
        <Modal
          open={showPageResults}
          onClose={() => { setShowPageResults(false); closeAndRefresh() }}
          title={t('policies.pageResults') || 'Resultats par page'}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Relaunch error pages button */}
            {(() => {
              const allPages = Array.isArray(analysisResults) ? analysisResults : []
              const errorCount = allPages.filter((p: Record<string, unknown>) => String(p.status) === 'error').length
              if (errorCount > 0 && canAnalyze) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'var(--color-bg-secondary)', marginBottom: '4px' }}>
                    <Badge variant="danger">{errorCount} page{errorCount > 1 ? 's' : ''} en erreur</Badge>
                    <Button
                      variant="primary"
                      icon={<RefreshCw size={14} />}
                      onClick={() => {
                        policyDocumentsApi.analyzeErrorPages(selectedId!)
                          .then((r) => {
                            const data = r.data as Record<string, unknown>
                            toast('success', `Relance de ${data.count} page(s) en erreur`)
                            qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisResults', selectedId] })
                            qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisProgress', selectedId] })
                          })
                          .catch(() => toast('error', 'Erreur lors de la relance'))
                      }}
                    >
                      Relancer les pages en erreur
                    </Button>
                  </div>
                )
              }
              return null
            })()}
            {(Array.isArray(analysisResults) ? analysisResults : []).map((page: Record<string, unknown>, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${String(page.status) === 'skipped' ? 'var(--color-border)' : String(page.status) === 'error' ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  background: String(page.status) === 'skipped' ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {t('policies.wizardStep') || 'Etape'} {String(page.page_number)}
                  </span>
                  {String(page.status) === 'done' && <Badge variant="success">{t('policies.analysisComplete') || 'Terminee'}</Badge>}
                  {String(page.status) === 'done' && Boolean(page.needs_review) && (
                    <span title={String(page.needs_review_reason ?? '')}><Badge variant="warning">A revoir</Badge></span>
                  )}
                  {String(page.status) === 'skipped' && <Badge variant="default">{t('policies.pageSkipped') || 'Sans exigences'}</Badge>}
                  {String(page.status) === 'error' && <Badge variant="danger">Erreur</Badge>}
                  {String(page.status) === 'pending' && <Badge variant="info">En attente</Badge>}
                  {String(page.status) === 'analyzing' && (
                    <Badge variant="info"><Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> En cours</Badge>
                  )}
                  {canAnalyze && (String(page.status) === 'done' || String(page.status) === 'error' || String(page.status) === 'skipped') && String(page.status) !== 'analyzing' && (
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '2px', marginLeft: 'auto', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Relancer l'analyse de cette page"
                      onClick={() => {
                        policyDocumentsApi.analyzePage(selectedId!, Number(page.page_number))
                          .then(() => {
                            toast('success', `Page ${page.page_number} relancee`)
                            qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisResults', selectedId] })
                            qc.invalidateQueries({ queryKey: ['policyDocumentAnalysisProgress', selectedId] })
                          })
                          .catch(() => toast('error', 'Erreur'))
                      }}
                    >
                      <RefreshCw size={12} /> Relancer
                    </button>
                  )}
                </div>
                {String(page.status) === "done" && Boolean(page.result_text) && (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--color-bg-secondary)', padding: '8px', borderRadius: '6px' }}>
                    {String(page.result_text)}
                  </div>
                )}
                {String(page.status) === 'skipped' && (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    {t('policies.pageSkipped') || 'Page sans exigences'}
                  </div>
                )}
                {String(page.status) === "error" && Boolean(page.error_message) && (
                  <div style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                    {String(page.error_message)}
                  </div>
                )}
              </div>
            ))}
            {(!Array.isArray(analysisResults) || analysisResults.length === 0) && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>
                {t('policies.notStarted') || 'Analyse non demarree'}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && doc && (
        <Modal open={showEdit} onClose={() => { setShowEdit(false); closeAndRefresh() }} title={t('common.edit') || 'Edit'} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('governance.policies.title_field')} value={editName} onChange={setEditName} />
            <Select label={t('policies.category')} value={editCategory} onChange={setEditCategory} options={categoryOptions.slice(1)} />
            <Input label={t('policies.version')} value={editVersion} onChange={setEditVersion} />
            <Select label={t('policies.status')} value={editStatus} onChange={setEditStatus} options={statusOptions.slice(1)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.policies.content')}</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowEdit(false); closeAndRefresh() }}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate({
              id: Number(doc.id),
              body: { name: editName, category: editCategory, version: editVersion, status: editStatus, description: editDescription }
            })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '...' : (t('common.save') || 'Save')}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={t('policies.deleteConfirm')}
        message={t('policies.deleteConfirm')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => { setDeleteId(null); closeAndRefresh() }}
      />

      {/* View Analysis Modal */}
      {showViewAnalysis && (
        <Modal open={showViewAnalysis} onClose={() => { setShowViewAnalysis(false); closeAndRefresh() }} title={t('policies.analysisResult') || 'Analyse IA'} size="lg">
          <div style={{ maxHeight: '70vh', overflowY: 'auto', background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <MarkdownRenderer content={String(viewAnalysis ?? '')} />
          </div>
          <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            ⚠️ {t('policies.iaDisclaimer') || 'Cette analyse a ete generee par une IA et ne se substitue pas a la lecture attentive du document original'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => { setShowViewAnalysis(false); closeAndRefresh() }}>{t('common.close') || 'Fermer'}</Button>
            {selectedId !== null && (
              <Button icon={<FileDown size={16} />} onClick={() => handleDownloadAnalysis(selectedId, 'analysis')}>
                {t('policies.downloadAnalysis') || 'Telecharger l\'analyse'}
              </Button>
            )}
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}