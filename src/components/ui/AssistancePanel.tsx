import { useState, useRef, useEffect } from 'react'
import { domainSkillsApi } from '../../api'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Sparkles, Send, Loader2, X } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AssistancePanelProps {
  framework: string
  deliverableName: string
  requirements: string[]
  onClose: () => void
}

export function AssistancePanel({ framework, deliverableName, requirements, onClose }: AssistancePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [skillName, setSkillName] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initial message from IA
  useEffect(() => {
    const contextMsg = `Bonjour. Je suis votre assistant rédactionnel pour le livrable "${deliverableName}" dans le cadre ${framework}.\n\nCe livrable comporte ${requirements.length} exigence(s). Je peux vous aider à:\n- Structurer le document\n- Rédiger des sections\n- Comprendre les exigences\n- Proposer un plan de rédaction\n\nQue souhaitez-vous faire ?`

    setMessages([{ role: 'assistant', content: contextMsg }])
  }, [deliverableName, framework, requirements.length])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [loading])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Build context from requirements
      const contextPrefix = requirements.length > 0
        ? `Contexte — Livrable: "${deliverableName}" (${framework}). Exigences associées:\n${requirements.slice(0, 15).map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nQuestion de l'utilisateur: ${userMsg}`
        : `Contexte — Livrable: "${deliverableName}" (${framework}).\n\nQuestion de l'utilisateur: ${userMsg}`

      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

      const resp = await domainSkillsApi.assist({
        framework,
        skill_type: 'assistance',
        message: contextPrefix,
        history,
      }, { timeout: 120000 })

      setSkillName(resp.data.skill_name)
      setMessages([...newMessages, { role: 'assistant', content: resp.data.reply }])
    } catch (err) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Erreur: impossible de contacter l'IA. Vérifiez que le service Ollama est accessible.",
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '400px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            Assistance rédactionnelle — {deliverableName}
          </span>
          {skillName && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              ({skillName})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: '4px',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: msg.role === 'user'
                  ? 'var(--color-accent)'
                  : 'var(--color-bg-tertiary)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: '13px' }}>L'IA rédige...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Demandez à l'IA de vous aider à rédiger..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 12px',
            background: loading || !input.trim() ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
            border: 'none',
            borderRadius: '8px',
            color: loading || !input.trim() ? 'var(--color-text-secondary)' : '#fff',
            cursor: loading || !input.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}