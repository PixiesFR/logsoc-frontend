import { useState, useRef, useEffect } from 'react'
import { Info, FileText } from 'lucide-react'
import { api } from '../../api'

interface Tooltip {
  id: number
  entry_type: string
  text: string
  source_doc_name: string | null
  source_page: number | null
  source_available: boolean
  source_url: string | null
}

/**
 * Pastille ⓘ affichant le contexte réglementaire (tooltips) d'une exigence.
 * Déterministe: l'endpoint renvoie max 3 informations/définitions
 * (même cible puis même document source), chaque tooltip porte sa
 * source (PDF + page), le lien n'est affiché que si le document existe.
 */
export function ContextInfoIcon({ reqId }: { reqId: number }) {
  const [tips, setTips] = useState<Tooltip[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fetched = useRef(false)

  useEffect(() => {
    if (!open || fetched.current) return
    fetched.current = true
    setLoading(true)
    api.get(`/api/v1/policies/requirements/${reqId}/context`)
      .then((r) => setTips(r.data.tooltips || []))
      .catch(() => setTips([]))
      .finally(() => setLoading(false))
  }, [open, reqId])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (tips !== null && tips.length === 0 && !loading) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: '4px' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        title="Contexte réglementaire"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px',
          color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center',
        }}
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', zIndex: 1000, left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(100% + 8px)', width: '360px', maxWidth: '80vw',
            background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
            borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            padding: '10px 12px', fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            💡 Contexte réglementaire
          </div>
          {loading && <div style={{ color: 'var(--color-text-secondary)' }}>Chargement…</div>}
          {tips?.map((t) => (
            <div key={t.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ color: 'var(--color-text-primary)', lineHeight: 1.45 }}>{t.text}</div>
              {t.source_doc_name && (
                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                  {t.source_available && t.source_url ? (
                    <a href={t.source_url} target="_blank" rel="noreferrer"
                       style={{ color: 'var(--color-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <FileText size={11} /> Source : {t.source_doc_name.slice(0, 40)}{t.source_page ? `, p.${t.source_page}` : ''}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                      Source : {t.source_doc_name.slice(0, 40)} (document non importé)
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}