import { useState, useEffect, useRef } from 'react'
import { governanceDocsApi } from '../../api'
import { useToast } from './Toast'
import { FileText, Loader2, Sparkles, RefreshCw, Download, Send, FileDown, PenLine, Gavel, BadgeCheck, Lock } from 'lucide-react'

interface DocumentEditorProps {
  deliverableId: number
  deliverableName: string
}

export function DocumentEditor({ deliverableId, deliverableName }: DocumentEditorProps) {
  const { toast } = useToast()
  const [docStatus, setDocStatus] = useState<{ exists: boolean; status: string | null; version: number; has_pdf?: boolean } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [verifyInfo, setVerifyInfo] = useState<any>(null)
  const [workflowBusy, setWorkflowBusy] = useState<string | null>(null)
  const [editorInstanceId, setEditorInstanceId] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const docEditorInstance = useRef<any>(null)

  // Current user (pour droits signature)
  const [me, setMe] = useState<any>(null)
  useEffect(() => {
    import('../../api').then(({ usersApi }) => {
      usersApi.getMe().then((r: any) => setMe(r.data)).catch(() => {})
    })
  }, [])

  const isSignatoryUser = !!me?.is_signatory
  const isDirection = String(me?.business_role ?? '').toLowerCase().split('/').map((p: string) => p.trim()).some((c: string) => ['gerant', 'president', 'dg', 'direction'].includes(c))

  const checkVerify = async () => {
    try {
      const resp = await governanceDocsApi.verify(deliverableId)
      setVerifyInfo(resp.data)
    } catch { setVerifyInfo(null) }
  }

  useEffect(() => {
    checkVerify()
  }, [deliverableId, docStatus?.status])

  const handleWorkflow = async (action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    setWorkflowBusy(action)
    try {
      let resp: any
      if (action === 'submit') resp = await governanceDocsApi.submit(deliverableId)
      if (action === 'convert') resp = await governanceDocsApi.convertPdf(deliverableId)
      if (action === 'sign') resp = await governanceDocsApi.sign(deliverableId)
      if (action === 'countersign') resp = await governanceDocsApi.countersign(deliverableId)
      toast('success', resp?.data?.message || 'Opération réussie')
      await checkStatus()
      await checkVerify()
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Erreur')
    }
    setWorkflowBusy(null)
  }

  // Check document status on mount
  useEffect(() => {
    checkStatus()
  }, [deliverableId])

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (docEditorInstance.current) {
        try { docEditorInstance.current.destroyEditor() } catch {}
        docEditorInstance.current = null
      }
    }
  }, [deliverableId])

  const checkStatus = async () => {
    try {
      const resp = await governanceDocsApi.status(deliverableId)
      setDocStatus(resp.data)
    } catch {
      setDocStatus({ exists: false, status: null, version: 0 })
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await governanceDocsApi.generate(deliverableId)
      toast('success', 'Document généré avec succès')
      await checkStatus()
      // Load the editor
      loadEditor()
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Erreur lors de la génération')
    }
    setGenerating(false)
  }

  const loadEditor = async (pdfView: boolean = false) => {
    setLoadingConfig(true)
    setEditorReady(false)

    // Nouvelle instance unique: le div React sera remonte vierge
    // (evite le crash Node.insertBefore quand OnlyOffice a deplace les noeuds)
    const instanceId = Date.now()
    setEditorInstanceId(instanceId)

    // Destroy previous editor
    if (docEditorInstance.current) {
      try { docEditorInstance.current.destroyEditor() } catch {}
      docEditorInstance.current = null
    }

    try {
      const configResp = await governanceDocsApi.editorConfig(deliverableId, pdfView ? { view: true, file: 'pdf' } : undefined)
      const config = configResp.data

      // Load OnlyOffice API script
      const scriptUrl = 'https://onlyoffice.anytimeadmin.info/web-apps/apps/api/documents/api.js'

      // Check if script already loaded
      let script = document.querySelector(`script[src="${scriptUrl}"]`) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.src = scriptUrl
        script.async = true
        document.head.appendChild(script)
        await new Promise((resolve, reject) => {
          script!.onload = resolve
          script!.onerror = reject
        })
      }

      // Create editor
      const editorConfig = {
        ...config,
        events: {
          onAppReady: () => {
            setEditorReady(true)
            setLoadingConfig(false)
          },
          onError: (e: any) => {
            console.error('OnlyOffice error:', e)
            setLoadingConfig(false)
            toast('error', 'Erreur éditeur OnlyOffice')
          },
          onDocumentReady: () => {
            setEditorReady(true)
            setLoadingConfig(false)
          },
        },
        height: '100%',
        width: '100%',
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DocsAPI = (window as any).DocsAPI
      if (!DocsAPI) {
        // Wait a bit and retry
        await new Promise(r => setTimeout(r, 500))
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const API = (window as any).DocsAPI
      if (API && API.DocEditor) {
        // Attendre que React ait remonte le div vierge avec le nouvel id
        const targetId = `onlyoffice-editor-${instanceId}`
        await new Promise<void>((resolve) => {
          const check = () => {
            if (document.getElementById(targetId)) resolve()
            else requestAnimationFrame(check)
          }
          requestAnimationFrame(check)
        })
        docEditorInstance.current = new API.DocEditor(targetId, editorConfig)
      } else {
        setLoadingConfig(false)
        toast('error', 'Impossible de charger OnlyOffice API')
      }
    } catch (err: any) {
      setLoadingConfig(false)
      toast('error', 'Erreur lors du chargement de l\'éditeur')
    }
  }

  // Auto-load editor if document exists AND is still editable
  const EDITABLE_STATUSES = ['generated', 'editing', 'saved']
  const isDocEditable = EDITABLE_STATUSES.includes(docStatus?.status || '')
  const isDocFrozen = docStatus?.exists && !isDocEditable

  useEffect(() => {
    if (docStatus?.exists && docStatus.status && !editorReady && !loadingConfig && !generating) {
      // Document figé -> viewer OnlyOffice sur le PDF signé/de reference
      // Document editable -> editeur classique
      loadEditor(isDocFrozen)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docStatus?.status, docStatus?.version, docStatus?.exists])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {deliverableName}
          </span>
          {docStatus?.exists && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: docStatus.status === 'editing' ? 'var(--color-warning, #f59e0b)' : 'var(--color-success, #22c55e)',
              color: '#fff',
            }}>
              {docStatus.status === 'editing' ? 'En cours d\'édition' : `v${docStatus.version}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {docStatus?.exists && (
            <>
              <button
                onClick={() => {
                  if (confirm('Voulez-vous régénérer le document ? Le document actuel sera remplacé par une nouvelle version.')) {
                    handleGenerate()
                  }
                }}
                disabled={generating}
                title="Régénérer le document avec l'IA"
                style={{
                  padding: '4px 8px',
                  background: 'var(--color-accent)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: '#fff',
                }}
              >
                <Sparkles size={14} />
                Régénérer
              </button>
              {/* ── Workflow signature ── */}
              {['editing', 'generated', 'to_validate', 'pdf_ready'].includes(docStatus.status || '') && (
                <button
                  onClick={() => handleWorkflow('submit')}
                  disabled={workflowBusy !== null || docStatus.status === 'to_validate'}
                  title="Soumettre le document à validation (fige le contenu)"
                  style={{
                    padding: '4px 8px',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Send size={14} />
                  {docStatus.status === 'to_validate' ? 'Soumis' : 'Soumettre'}
                </button>
              )}
              {docStatus.status === 'to_validate' && !docStatus.has_pdf && (
                <button
                  onClick={() => handleWorkflow('convert')}
                  disabled={workflowBusy !== null}
                  title="Convertir en PDF (version figée de référence)"
                  style={{
                    padding: '4px 8px',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <FileDown size={14} />
                  Convertir en PDF
                </button>
              )}
              {(docStatus.status === 'pdf_ready' || docStatus.status === 'to_validate') && docStatus.has_pdf && !verifyInfo?.signatures?.some((s: any) => s.category === 'signatory') && (
                <button
                  onClick={() => handleWorkflow('sign')}
                  disabled={workflowBusy !== null || !isSignatoryUser}
                  title={isSignatoryUser ? 'Signer électroniquement (PKCS#7 + cachet)' : 'Votre compte n\'est pas signataire (voir Administration → Utilisateurs)'}
                  style={{
                    padding: '4px 8px',
                    background: isSignatoryUser ? '#10b981' : 'var(--color-bg-tertiary)',
                    border: `1px solid ${isSignatoryUser ? '#10b981' : 'var(--color-border)'}`,
                    borderRadius: '4px',
                    cursor: workflowBusy !== null ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                    color: isSignatoryUser ? '#fff' : 'var(--color-text-secondary)',
                    opacity: isSignatoryUser ? 1 : 0.6,
                  }}
                >
                  <PenLine size={14} />
                  Signer
                </button>
              )}
              {verifyInfo?.signatures?.some((s: any) => s.category === 'signatory') && docStatus.status !== 'published' && (
                <button
                  onClick={() => handleWorkflow('countersign')}
                  disabled={workflowBusy !== null || !isDirection}
                  title={isDirection ? 'Contre-signer pour la direction (publie le document)' : 'Réservé à la direction (Gérant/DG)'}
                  style={{
                    padding: '4px 8px',
                    background: isDirection ? '#f59e0b' : 'var(--color-bg-tertiary)',
                    border: `1px solid ${isDirection ? '#f59e0b' : 'var(--color-border)'}`,
                    borderRadius: '4px',
                    cursor: workflowBusy !== null ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                    color: isDirection ? '#000' : 'var(--color-text-secondary)',
                    opacity: isDirection ? 1 : 0.6,
                  }}
                >
                  <Gavel size={14} />
                  Valider direction
                </button>
              )}
              {docStatus.status === 'published' && (
                <span style={{
                  padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981', borderRadius: '4px',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#10b981',
                }}>
                  <BadgeCheck size={14} /> Publié (signé)
                </span>
              )}
              {/* Signatures présentes */}
              {verifyInfo?.signatures?.length > 0 && (
                <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {verifyInfo.signatures.map((s: any, i: number) => (
                    <span key={i} title={`${s.signer} (${s.role}) — ${s.signed_at?.slice(0, 10)} — intégrité: ${s.pdf_integrity || '—'}`}
                      style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500,
                        background: s.pdf_integrity === 'OK' ? 'rgba(16,185,129,0.15)' : s.pdf_integrity === 'ALTERÉ' ? 'rgba(239,68,68,0.15)' : 'var(--color-bg-tertiary)',
                        border: `1px solid ${s.pdf_integrity === 'ALTERÉ' ? '#ef4444' : 'var(--color-border)'}`,
                        color: s.pdf_integrity === 'ALTERÉ' ? '#ef4444' : 'var(--color-text-primary)',
                      }}>
                      {s.category === 'direction' ? '⚖' : '✍'} {s.signer}
                    </span>
                  ))}
                </span>
              )}
              {/* Progression validation direction (unanimité) */}
              {verifyInfo?.validation_cycle && verifyInfo.validation_cycle.total > 0 && docStatus.status !== 'published' && (
                <span style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  background: verifyInfo.validation_cycle.has_rejection ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.12)',
                  border: `1px solid ${verifyInfo.validation_cycle.has_rejection ? '#ef4444' : 'var(--color-border)'}`,
                  color: verifyInfo.validation_cycle.has_rejection ? '#ef4444' : 'var(--color-text-primary)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {verifyInfo.validation_cycle.has_rejection ? (
                    <>❌ Rejeté par la direction</>
                  ) : (
                    <>⏳ Direction: {verifyInfo.validation_cycle.approved}/{verifyInfo.validation_cycle.total}{verifyInfo.validators?.length ? ` — ${verifyInfo.validators.filter((v: any) => v.status === 'approved').map((v: any) => v.validator).join(', ')}` : ''}</>
                  )}
                </span>
              )}
              <button
                onClick={() => loadEditor()}
                disabled={loadingConfig}
                title="Recharger l'éditeur"
                style={{
                  padding: '4px 8px',
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                }}
              >
                <RefreshCw size={14} />
              </button>
              <a
                href={`/api/v1/governance-docs/${deliverableId}/file`}
                download
                title="Télécharger le document"
                style={{
                  padding: '4px 8px',
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  textDecoration: 'none',
                  color: 'var(--color-text-primary)',
                }}
              >
                <Download size={14} />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Generate button (if no document yet) */}
        {!docStatus?.exists && !generating && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
          }}>
            <FileText size={48} style={{ color: 'var(--color-muted)' }} />
            <p style={{ color: 'var(--color-muted)', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
              Aucun document généré. Cliquez sur le bouton ci-dessous pour générer automatiquement
              le document à partir des exigences réglementaires via l'IA.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: '10px 20px',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <Sparkles size={18} />
              Générer le document
            </button>
          </div>
        )}

        {/* Generating spinner */}
        {generating && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
          }}>
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
              L'IA rédige le document... (1-3 minutes)
            </p>
          </div>
        )}

        {/* Loading editor */}
        {loadingConfig && !generating && !isDocFrozen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '12px',
          }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-muted)', fontSize: '13px' }}>Chargement de l'éditeur OnlyOffice...</p>
          </div>
        )}

        {/* Document FIGÉ (soumis/signé/publié) : bandeau + viewer OnlyOffice PDF (plus d'édition) */}
        {isDocFrozen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
              background: docStatus?.status === 'published' ? 'rgba(16, 185, 129, 0.1)' : docStatus?.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${docStatus?.status === 'published' ? 'var(--color-success, #10b981)' : docStatus?.status === 'rejected' ? 'var(--color-error, #ef4444)' : 'var(--color-warning, #f59e0b)'}`,
              borderRadius: '6px', fontSize: '13px',
              color: docStatus?.status === 'published' ? 'var(--color-success, #10b981)' : docStatus?.status === 'rejected' ? 'var(--color-error, #ef4444)' : 'var(--color-warning, #f59e0b)',
            }}>
              <Lock size={14} />
              Document figé ({docStatus?.status === 'to_validate' ? 'en attente de validation' : docStatus?.status === 'pdf_ready' ? 'en cours de signature' : docStatus?.status === 'published' ? 'publié' : docStatus?.status === 'rejected' ? 'rejeté par la direction — régénérer pour repartir' : docStatus?.status})
              — le contenu .docx n'est plus modifiable.
              {docStatus?.status === 'published' ? ' Version signée de référence ci-dessous.' : ' Le PDF de référence est ci-dessous.'}
            </div>
            {/* Le viewer OnlyOffice (PDF, mode view) s'affiche via le div editor plus bas */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <a
                href={(verifyInfo?.signatures?.length > 0
                  ? governanceDocsApi.signedPdfUrl(deliverableId)
                  : governanceDocsApi.pdfUrl(deliverableId))}
                download
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
                  fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Download size={14} /> Télécharger le PDF{verifyInfo?.signatures?.length > 0 ? ' signé' : ''}
              </a>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Pour modifier : régénérer le document (nouveau cycle, signatures purgées).
              </span>
            </div>
          </div>
        )}

        {/* OnlyOffice editor/viewer placeholder — id unique par instance (fix insertBefore crash) */}
        <div
          key={`oe-${editorInstanceId}`}
          id={`onlyoffice-editor-${editorInstanceId}`}
          ref={editorRef}
          style={{
            width: '100%',
            height: isDocFrozen ? undefined : '100%',
            flex: isDocFrozen ? 1 : undefined,
            minHeight: isDocFrozen ? '400px' : undefined,
            display: docStatus?.exists && !generating ? 'block' : 'none',
          }}
        />
      </div>
    </div>
  )
}