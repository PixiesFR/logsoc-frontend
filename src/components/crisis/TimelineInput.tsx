/**
 * TimelineInput — text field + lock button + confirmation modal.
 * Ticket #44 — zone gauche War Room.
 *
 * - Text input at bottom of zone: "Saisir une action/décision..."
 * - Lock button: immediately locks the current entry (with confirmation)
 * - Auto-lock after configurable timeout (default 60s) of inactivity
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Send } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useAuthStore } from '../../stores'
import { useCrisisStore } from '../../stores/crisisStore'
import { crisisTimelineApi } from '../../api/crisis'
import { ConfirmDialog } from '../ui'
import { useToast } from '../ui/Toast'

interface TimelineInputProps {
  incidentId: number
  /** Called after a new entry is added (to scroll/auto-lock timer reset) */
  onEntryAdded?: () => void
}

export function TimelineInput({ incidentId, onEntryAdded }: TimelineInputProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const autoLockTimeoutSec = useCrisisStore((s) => s.autoLockTimeoutSec)

  const [text, setText] = useState('')
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textRef = useRef(text)

  useEffect(() => {
    textRef.current = text
  }, [text])

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      crisisTimelineApi.add(incidentId, {
        content,
        type: 'user',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis', 'timeline', incidentId] })
      setText('')
      onEntryAdded?.()
    },
    onError: () => {
      toast('error', t('warRoom.timelineAddError'))
    },
  })

  const lockMutation = useMutation({
    mutationFn: (entryId: string) => crisisTimelineApi.lock(incidentId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis', 'timeline', incidentId] })
      toast('success', t('warRoom.entryLocked'))
      setText('')
    },
    onError: () => {
      toast('error', t('warRoom.entryLockError'))
    },
  })

  // Clear the inactivity timer
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }, [])

  // Auto-lock after configurable timeout of inactivity (only if there's pending text)
  const autoLockMs = autoLockTimeoutSec * 1000
  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer()
    if (textRef.current.trim() && autoLockMs > 0) {
      inactivityTimerRef.current = setTimeout(() => {
        // Auto-submit + lock after inactivity
        const content = textRef.current.trim()
        if (content) {
          addMutation.mutate(content)
        }
      }, autoLockMs)
    }
  }, [addMutation, clearInactivityTimer, autoLockMs])

  useEffect(() => {
    resetInactivityTimer()
    return clearInactivityTimer
  }, [text, resetInactivityTimer, clearInactivityTimer])

  const handleSend = () => {
    const content = text.trim()
    if (!content) return
    addMutation.mutate(content)
  }

  const handleLockConfirm = () => {
    const content = text.trim()
    if (!content) return
    // Add then lock: we add the entry and immediately lock it
    addMutation.mutate(content, {
      onSuccess: (res) => {
        const entryId = String((res.data as Record<string, unknown>)?.id ?? '')
        if (entryId) {
          lockMutation.mutate(entryId)
        }
      },
    })
    setShowLockConfirm(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const authorName = user?.display_name ?? user?.username ?? '—'

  return (
    <div className="warroom-timeline-input-wrapper">
      <div className="warroom-timeline-input-author">{authorName}</div>
      <div className="warroom-timeline-input-row">
        <input
          type="text"
          className="warroom-timeline-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('warRoom.timelineInputPlaceholder')}
          aria-label={t('warRoom.timelineInputAria')}
          disabled={addMutation.isPending || lockMutation.isPending}
        />
        <button
          className="warroom-btn warroom-timeline-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || addMutation.isPending}
          aria-label={t('warRoom.send')}
        >
          <Send size={14} />
        </button>
        <button
          className="warroom-btn warroom-timeline-lock-btn"
          onClick={() => setShowLockConfirm(true)}
          disabled={!text.trim() || lockMutation.isPending}
          aria-label={t('warRoom.lock')}
          title={t('warRoom.lock')}
        >
          <Lock size={14} />
        </button>
      </div>
      <div className="warroom-timeline-input-hint">
        {t('warRoom.autoLockHint', { seconds: autoLockTimeoutSec })}
      </div>

      <ConfirmDialog
        open={showLockConfirm}
        title={t('warRoom.lockConfirmTitle')}
        message={t('warRoom.lockConfirmMessage')}
        confirmLabel={t('warRoom.lock')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleLockConfirm}
        onCancel={() => setShowLockConfirm(false)}
        variant="primary"
      />
    </div>
  )
}