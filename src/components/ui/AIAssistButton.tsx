import { useState, useCallback } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from './Toast'
import { Button, Modal } from './index'
import { Sparkles, Loader2 } from 'lucide-react'

interface AIAssistButtonProps {
  /** Context type: risks, incidents, policies, runbooks, nis2, iso27001, gdpr, threatHunting, crisis */
  contextType: string
  /** Context data to send to the AI (the item being analyzed) */
  contextData: Record<string, unknown>
  /** Optional callback after AI analysis is generated */
  onAnalysis?: (analysis: string) => void
  /** Button variant */
  variant?: 'primary' | 'secondary'
  /** Button size */
  size?: 'sm' | 'md'
  /** Custom label key in i18n (default: aiAssist.askAi) */
  labelKey?: string
}

export function AIAssistButton({ contextType, contextData, onAnalysis, variant = 'secondary', size = 'sm', labelKey }: AIAssistButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)

  const handleAskAi = useCallback(async () => {
    setLoading(true)
    setAnalysis(null)
    try {
      // For risks, use the dedicated LLM endpoint
      if (contextType === 'risks' && contextData.id != null) {
        const { risksApi } = await import('../../api')
        const response = await risksApi.aiSuggestLlm(Number(contextData.id), {
          context: contextType,
          data: contextData,
        })
        const result = response.data as Record<string, unknown>
        const suggestion = String(result.suggestion ?? result.analysis ?? result.message ?? JSON.stringify(result, null, 2))
        setAnalysis(suggestion)
        onAnalysis?.(suggestion)
      } else {
        // For other pages, show context-aware guidance message
        const guidanceKey = `aiAssist.guidance.${contextType}`
        const guidance = t(guidanceKey)
        setAnalysis(guidance !== guidanceKey ? guidance : t('aiAssist.guidance.default'))
        onAnalysis?.(guidance)
      }
    } catch {
      toast('error', t('aiAssist.error'))
    } finally {
      setLoading(false)
    }
  }, [contextType, contextData, onAnalysis, t, toast])

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        onClick={() => { setOpen(true); handleAskAi() }}
        disabled={loading}
      >
        {t(labelKey ?? 'aiAssist.askAi')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('aiAssist.aiAssistTitle')}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.close')}</Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-accent)' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('aiAssist.loading')}
              </div>
            </div>
          )}
          {analysis && !loading && (
            <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-accent)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '8px' }}>
                {t('aiAssist.analysis')}
              </div>
              <pre style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                {analysis}
              </pre>
            </div>
          )}
          {!loading && !analysis && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {t('aiAssist.noAnalysis')}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}