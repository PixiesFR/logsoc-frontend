import { useState, useRef, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { domainSkillsApi } from '../../api'
import { Sparkles, Send, MessageSquare, Loader2 } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SkillInfo {
  id: number
  regulatory_framework: string
  skill_type: string
  skill_name: string
  system_prompt: string
  deliverables_list: string | null
  is_base: boolean
  version: number
}

const FRAMEWORKS = [
  { value: 'ANSSI', label: 'ANSSI' },
  { value: 'RGPD', label: 'RGPD' },
  { value: 'NIS2', label: 'NIS2' },
  { value: 'DORA', label: 'DORA' },
  { value: 'ISO27001', label: 'ISO 27001' },
]
const SKILL_TYPES = [
  { value: 'wizard', label: 'Wizard (Cadrage)' },
  { value: 'assistance', label: 'Assistance (Rédaction)' },
  { value: 'definition', label: 'Définition (Glossaire)' },
]

export function GovernanceWizard() {
  const [framework, setFramework] = useState('ANSSI')
  const [skillType, setSkillType] = useState('wizard')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selectedSkill, setSelectedSkill] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSkills, setLoadingSkills] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSkills()
  }, [framework, skillType])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadSkills = async () => {
    setLoadingSkills(true)
    try {
      const res = await domainSkillsApi.list(framework, skillType)
      setSkills(res.data)
      if (res.data.length > 0) {
        setSelectedSkill(res.data[0].skill_name)
      } else {
        setSelectedSkill('')
      }
    } catch (e) {
      console.error('Failed to load skills:', e)
    } finally {
      setLoadingSkills(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const apiFn =
        skillType === 'wizard' ? domainSkillsApi.wizard :
        skillType === 'assistance' ? domainSkillsApi.assist :
        domainSkillsApi.define

      const res = await apiFn({
        framework,
        skill_type: skillType,
        skill_name: selectedSkill || undefined,
        message: userMsg.content,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      })

      setMessages([...newMessages, { role: 'assistant', content: res.data.reply }])
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Erreur de connexion à l\'IA'
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const resetChat = () => {
    setMessages([])
  }

  const activeSkill = skills.find(s => s.skill_name === selectedSkill)
  let deliverables: string[] = []
  if (activeSkill?.deliverables_list) {
    try { deliverables = JSON.parse(activeSkill.deliverables_list) } catch { deliverables = [] }
  }

  const skillOptions = skills.map(s => ({ value: s.skill_name, label: s.skill_name }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Sparkles size={24} style={{ color: 'var(--color-accent)' }} />
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Wizard Gouvernance</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Assistant IA pour le cadrage et la rédaction des livrables de gouvernance
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px' }}>
          <Select
            label="Framework"
            value={framework}
            onChange={setFramework}
            options={FRAMEWORKS}
          />
          <Select
            label="Type"
            value={skillType}
            onChange={setSkillType}
            options={SKILL_TYPES}
          />
          {skills.length > 1 && (
            <Select
              label="Skill spécifique"
              value={selectedSkill}
              onChange={setSelectedSkill}
              options={skillOptions}
            />
          )}
          <div style={{ paddingBottom: '4px' }}>
            <Button
              variant="secondary"
              onClick={resetChat}
              disabled={messages.length === 0}
            >
              Réinitialiser
            </Button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
            {loadingSkills && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />}
            {activeSkill && (
              <Badge variant={activeSkill.is_base ? 'default' : 'success'} size="sm">
                {activeSkill.is_base ? 'Skill de base' : `Enrichi v${activeSkill.version}`}
              </Badge>
            )}
          </div>
        </div>

        {/* Deliverables list */}
        {deliverables.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Livrables:</span>
            {deliverables.map(d => (
              <Badge key={d} variant="info" size="sm">{d}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Chat */}
      <Card style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: '400px', padding: 0, overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} />
          Conversation — {framework} / {SKILL_TYPES.find(t => t.value === skillType)?.label}
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', gap: '8px' }}>
              <Sparkles size={32} style={{ opacity: 0.5 }} />
              <p style={{ fontSize: '14px', margin: 0 }}>Posez votre première question pour commencer</p>
              {skillType === 'wizard' && (
                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Ex: "Quels livrables dois-je produire pour l'ANSSI ?"</p>
              )}
              {skillType === 'assistance' && (
                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Ex: "Aide-moi à rédiger la section classification des informations de la PSSI"</p>
              )}
              {skillType === 'definition' && (
                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Ex: "Qu'est-ce qu'un actif Tiers 0 ?"</p>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                borderRadius: '8px',
                padding: '8px 14px',
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

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: '8px', padding: '8px 14px', background: 'var(--color-bg-tertiary, var(--color-border))' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Tapez votre message..."
            disabled={loading}
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
          <Button onClick={sendMessage} disabled={loading || !input.trim()} size="sm">
            <Send size={16} />
          </Button>
        </div>
      </Card>
    </div>
  )
}