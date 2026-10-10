import { useEffect, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { Play, Pause } from 'lucide-react'

interface LogMessage {
  id: string
  text: string
  timestamp: string
  level: string
}

interface LogStreamProps {
  messages: LogMessage[]
  paused: boolean
  onTogglePause: () => void
}

const levelColors: Record<string, string> = {
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-text-primary)',
}

export function LogStream({ messages, paused, onTogglePause }: LogStreamProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, paused])

  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('events.timeline')}
        </h3>
        <button
          onClick={onTogglePause}
          style={{
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '4px 10px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--color-text-primary)',
          }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? t('common.active') : t('common.inactive')}
        </button>
      </div>
      <div
        ref={containerRef}
        className="scrollbar-none"
        style={{
          height: 300,
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '12px',
          lineHeight: 1.6,
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              {msg.timestamp}
            </span>
            <span style={{ color: levelColors[msg.level] ?? 'var(--color-text-primary)' }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}