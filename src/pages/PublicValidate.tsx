import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { FileCheck, CheckCircle2, XCircle, Loader2, XCircle as RefuseIcon } from 'lucide-react'

const apiPublic = axios.create({ baseURL: '' })

export function PublicValidate() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!token) { setError('Lien invalide: token manquant'); setLoading(false); return }
    apiPublic.get(`/api/v1/public/validate?token=${encodeURIComponent(token)}`)
      .then((r) => setInfo(r.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Lien invalide ou expiré'))
      .finally(() => setLoading(false))
  }, [token])

  const doAction = (a: string) => {
    setActing(true)
    apiPublic.post('/api/v1/public/validate', { token, action: a })
      .then((r) => setResult(r.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Erreur'))
      .finally(() => setActing(false))
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: '560px', margin: '60px auto', padding: '32px',
    borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fff',
    fontFamily: 'sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  }

  const btn = (bg: string): React.CSSProperties => ({
    background: bg, color: '#fff', padding: '12px 28px', borderRadius: '8px',
    textDecoration: 'none', fontWeight: 600, display: 'inline-block',
    border: 'none', cursor: 'pointer', fontSize: '15px', margin: '0 6px',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '20px' }}>
      <div style={cardStyle}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
            <p style={{ color: '#6b7280' }}>Vérification du lien…</p>
          </div>
        )}

        {error && !result && (
          <div style={{ textAlign: 'center' }}>
            <XCircle size={48} style={{ color: '#ef4444' }} />
            <h2 style={{ color: '#1f2937' }}>Lien indisponible</h2>
            <p style={{ color: '#6b7280' }}>{error}</p>
          </div>
        )}

        {!loading && info && !result && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <FileCheck size={28} style={{ color: '#3b82f6' }} />
              <div>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>{info.document_title}</h2>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
                  Version {info.version} — {info.validator}{info.validator_role ? ` (${info.validator_role})` : ''}
                </p>
              </div>
            </div>

            {info.request_status === 'pending' ? (
              <>
                <p style={{ color: '#374151' }}>
                  Votre validation est requise pour la publication de ce document.
                  {info.progress?.total > 1 && ` Validation ${info.progress.approved}/${info.progress.total}.`}
                </p>
                <div style={{ textAlign: 'center', margin: '28px 0' }}>
                  <button style={btn('#10b981')} onClick={() => doAction('approve')} disabled={acting}>
                    {acting ? '…' : '✅ Valider et publier'}
                  </button>
                  <button style={btn('#ef4444')} onClick={() => doAction('reject')} disabled={acting}>
                    ❌ Refuser
                  </button>
                </div>
                <p style={{ color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>
                  Lien personnel — expire le {info.expires_at?.slice(0, 10)}. Aucune connexion requise.
                </p>
              </>
            ) : info.request_status === 'approved' ? (
              <p style={{ color: '#10b981', fontWeight: 600 }}>✓ Vous avez déjà validé ce document. Merci !</p>
            ) : (
              <p style={{ color: '#6b7280' }}>Cette demande n'est plus active ({info.request_status}).</p>
            )}
          </div>
        )}

        {result && (
          <div style={{ textAlign: 'center' }}>
            {result.action === 'approve' ? (
              <CheckCircle2 size={48} style={{ color: '#10b981' }} />
            ) : (
              <RefuseIcon size={48} style={{ color: '#ef4444' }} />
            )}
            <h2 style={{ color: '#1f2937' }}>
              {result.action === 'approve' ? 'Validation enregistrée' : 'Refus enregistré'}
            </h2>
            <p style={{ color: '#374151' }}>{result.message}</p>
            {result.outcome === 'published' && (
              <p style={{ color: '#10b981', fontWeight: 600 }}>📗 Le document est publié.</p>
            )}
            {result.outcome === 'rejected' && (
              <p style={{ color: '#ef4444', fontWeight: 600 }}>Le document est rejeté — un nouveau cycle sera nécessaire.</p>
            )}
            {result.outcome === null && result.action === 'approve' && (
              <p style={{ color: '#6b7280' }}>
                Validation {result.progress.approved}/{result.progress.total} — en attente des autres validateurs.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}