import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { wizardApi } from '../api'
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Marker that the IA includes at the end of its message when the profile is ready
const PROFILE_READY_MARKER = '[PROFILE_READY]'

export function WizardCadrage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [profileStatus, setProfileStatus] = useState<string>('none')
  const [showSummary, setShowSummary] = useState(false)
  const [profileSummary, setProfileSummary] = useState<string>('')
  const [autoGenerating, setAutoGenerating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Refocus input when IA finishes responding (sending -> false)
  useEffect(() => {
    if (!sending && !loading && !autoGenerating && !showSummary && profileStatus !== 'validated' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [sending, loading, autoGenerating, showSummary, profileStatus])

  // Charger la session au démarrage — si pas de session, démarrer automatiquement
  useEffect(() => {
    loadSession()
  }, [])

  const loadSession = async () => {
    setLoading(true)
    try {
      const res = await wizardApi.session()
      const data = res.data
      setMessages(data.messages || [])
      setProfileStatus(data.profile_status || 'none')
      if (data.profile_status === 'pending' || data.profile_status === 'validated') {
        const profRes = await wizardApi.profile()
        if (profRes.data.summary) {
          setProfileSummary(profRes.data.summary)
          if (data.profile_status === 'pending') {
            setShowSummary(true)
          }
        }
      }
      // Si pas de session existante, démarrer automatiquement
      if ((!data.messages || data.messages.length === 0) && data.profile_status !== 'validated') {
        await startWizard()
      }
    } catch (e) {
      console.error('Failed to load session:', e)
    } finally {
      setLoading(false)
    }
  }

  const startWizard = async () => {
    setLoading(true)
    try {
      const res = await wizardApi.start()
      const data = res.data
      const msgs = data.messages || []
      // Add info banner as first message if this is a new session
      if (msgs.length > 0 && msgs[0].role === 'assistant') {
        const infoMsg: ChatMessage = {
          role: 'assistant',
          content: '💡 Ce cadrage peut être mis en pause et repris à tout moment. Vos réponses sont sauvegardées automatiquement.'
        }
        setMessages([infoMsg, ...msgs])
      } else {
        setMessages(msgs)
      }
      setProfileStatus(data.profile_status || 'none')
    } catch (e) {
      console.error('Failed to start wizard:', e)
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate profile when IA says it's ready
  const autoGenerateProfile = useCallback(async (currentMessages: ChatMessage[]) => {
    setAutoGenerating(true)
    try {
      const res = await wizardApi.generateProfile()
      if (res.data.summary) {
        setProfileSummary(res.data.summary)
      }
      setShowSummary(true)
      setProfileStatus('pending')
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Erreur lors de la génération du profil'
      setMessages([...currentMessages, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setAutoGenerating(false)
    }
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const res = await wizardApi.chat({ message: userMsg.content })
      const reply = res.data.reply || ''
      
      // Check if IA says profile is ready
      const hasMarker = reply.includes(PROFILE_READY_MARKER)
      // Clean the marker from the displayed message
      const cleanReply = reply.replace(PROFILE_READY_MARKER, '').trim()
      
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: cleanReply }]
      setMessages(finalMessages)
      setProfileStatus(res.data.profile_status || 'none')
      
      // Auto-generate profile if marker detected
      if (hasMarker) {
        await autoGenerateProfile(finalMessages)
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Erreur de connexion à l\'IA'
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setSending(false)
    }
  }

  const validateProfile = async () => {
    try {
      await wizardApi.validateProfile()
      setProfileStatus('validated')
      setShowSummary(false)
      setMessages([...messages, { role: 'assistant', content: '✅ Profil validé ! L\'assistance IA est maintenant disponible dans tous les modules.' }])
      // Notify TopNav to refresh badge
      window.dispatchEvent(new Event('wizardStatusChanged'))
    } catch (e: any) {
      console.error('Validate failed:', e)
    }
  }

  const reviewProfile = () => {
    // Hide summary, let user continue chatting to correct things
    setShowSummary(false)
    setMessages([...messages, { role: 'assistant', content: 'D\'accord, reprenez les éléments que vous souhaitez corriger. Je mettrai à jour le profil.' }])
  }

  const resetWizard = async () => {
    if (!confirm('Êtes-vous sûr de vouloir tout réinitialiser ? Cette action est irréversible.')) return
    try {
      await wizardApi.reset()
      setMessages([])
      setProfileStatus('none')
      setProfileSummary('')
      setShowSummary(false)
      // Notify TopNav to refresh badge
      window.dispatchEvent(new Event('wizardStatusChanged'))
    } catch (e) {
      console.error('Reset failed:', e)
    }
  }

  const isProfileValidated = profileStatus === 'validated'
  const isProfilePending = profileStatus === 'pending'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={24} style={{ color: 'var(--color-accent)' }} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Wizard de Cadrage</h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              L'IA vous pose des questions pour comprendre votre organisation et assister chaque utilisateur
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isProfileValidated && <Badge variant="success" size="sm"><CheckCircle size={12} style={{ marginRight: 4 }} />Profil validé</Badge>}
          {isProfilePending && <Badge variant="warning" size="sm"><AlertCircle size={12} style={{ marginRight: 4 }} />Profil à valider</Badge>}
          {!isProfileValidated && !isProfilePending && <Badge variant="danger" size="sm"><AlertCircle size={12} style={{ marginRight: 4 }} />Profil à compléter</Badge>}
          <Button variant="secondary" onClick={resetWizard} size="sm">
            <RefreshCw size={14} style={{ marginRight: 4 }} />Réinitialiser
          </Button>
        </div>
      </div>

      {/* Chat area */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', minHeight: '400px' }}>
        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--color-text-secondary)' }}>
              <Loader2 size={20} className="animate-spin" />
              <span>Chargement...</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--color-text-secondary)' }}>
              <Sparkles size={40} style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '15px', margin: 0 }}>L'IA va vous poser des questions sur votre organisation</p>
              <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>Cadrage: organisation, SI, sécurité, réglementation, risques, crise</p>
              <Button onClick={startWizard}>Démarrer le cadrage</Button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '14px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-tertiary, var(--color-border))',
                color: msg.role === 'user' ? '#ffffff' : 'var(--color-text-primary)',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: '10px', padding: '10px 16px', background: 'var(--color-bg-tertiary, var(--color-border))' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            </div>
          )}

          {autoGenerating && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: '10px', padding: '10px 16px', background: 'var(--color-bg-tertiary, var(--color-border))' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
                <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Génération du profil...</span>
              </div>
            </div>
          )}
        </div>

        {/* Profile summary (if generated) */}
        {showSummary && profileSummary && (
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', background: 'var(--color-bg-secondary)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
              Résumé du profil généré
            </div>
            <pre style={{ fontSize: '13px', whiteSpace: 'pre-wrap', margin: 0, maxHeight: '200px', overflowY: 'auto', fontFamily: 'inherit' }}>
              {profileSummary}
            </pre>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button onClick={validateProfile} size="sm" variant="primary">Valider le profil</Button>
              <Button onClick={reviewProfile} size="sm" variant="secondary">Revoir les étapes</Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px', display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Tapez votre réponse..."
            disabled={sending || loading || isProfileValidated || autoGenerating || showSummary}
            style={{
              flex: 1,
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              padding: '8px 12px',
              fontSize: '14px',
              outline: 'none',
              color: 'var(--color-text-primary)',
            }}
          />
          <Button onClick={sendMessage} disabled={sending || !input.trim() || loading || isProfileValidated || autoGenerating || showSummary} size="sm">
            <Send size={16} />
          </Button>
        </div>
      </Card>
    </div>
  )
}