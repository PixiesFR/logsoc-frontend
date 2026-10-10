import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../stores'
import { useToast } from './Toast'
import { Loader2, FileText, Download, RefreshCw, Eye, Pencil } from 'lucide-react'

interface PolicyDocumentEditorProps {
  docId: number
  docName: string
  canEdit: boolean
}

export function PolicyDocumentEditor({ docId, docName, canEdit }: PolicyDocumentEditorProps) {
  const { toast } = useToast()
  const [loadingConfig, setLoadingConfig] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const docEditorInstance = useRef<any>(null)

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (docEditorInstance.current) {
        try { docEditorInstance.current.destroyEditor() } catch {}
        docEditorInstance.current = null
      }
    }
  }, [docId])

  const loadEditor = async () => {
    setLoadingConfig(true)

    // Destroy previous editor
    if (docEditorInstance.current) {
      try { docEditorInstance.current.destroyEditor() } catch {}
      docEditorInstance.current = null
    }

    try {
      const resp = await fetch(`/api/v1/policies/documents/${docId}/editor-config`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState()?.token || ''}`,
        },
      })
      if (!resp.ok) throw new Error('Failed to fetch editor config')
      const config = await resp.json()

      // Load OnlyOffice API script
      const scriptUrl = 'https://onlyoffice.anytimeadmin.info/web-apps/apps/api/documents/api.js'

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

      const editorConfig = {
        ...config,
        events: {
          onAppReady: () => {
            setLoadingConfig(false)
          },
          onError: (e: any) => {
            console.error('OnlyOffice error:', e)
            setLoadingConfig(false)
            toast('error', 'Erreur éditeur OnlyOffice')
          },
          onDocumentReady: () => {
            setLoadingConfig(false)
          },
        },
        height: '100%',
        width: '100%',
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const API = (window as any).DocsAPI
      if (API && API.DocEditor) {
        docEditorInstance.current = new API.DocEditor(`policy-editor-${docId}`, editorConfig)
      } else {
        setLoadingConfig(false)
        toast('error', 'Impossible de charger OnlyOffice API')
      }
    } catch (err: any) {
      setLoadingConfig(false)
      toast('error', 'Erreur lors du chargement de l\'éditeur')
    }
  }

  // Auto-load on mount
  useEffect(() => {
    loadEditor()
  }, [docId])

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
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{docName}</span>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: canEdit ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
            color: canEdit ? '#fff' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {canEdit ? <><Pencil size={10} /> Édition</> : <><Eye size={10} /> Lecture seule</>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
            href={`/api/v1/policies/documents/${docId}/office-file`}
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
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Loading editor */}
        {loadingConfig && (
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

        {/* OnlyOffice editor placeholder */}
        <div
          id={`policy-editor-${docId}`}
          ref={editorRef}
          style={{
            width: '100%',
            height: '100%',
            display: loadingConfig ? 'none' : 'block',
          }}
        />
      </div>
    </div>
  )
}