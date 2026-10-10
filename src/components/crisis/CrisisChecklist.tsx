/**
 * CrisisChecklist — main component for the War Room centre zone.
 * Ticket #45 — Checklist réflexe contextuelle selon le type de crise.
 *
 * Features:
 * - Ordered task list by priority (CRITIQUE > HAUTE > MOYENNE > BAS)
 * - Critical tasks: red emphasis + confirmation modal before checking
 * - Progress bar: X/Y completed + percentage
 * - Audit trail: who checked what and when (nominative proof of action)
 * - WebSocket real-time sync of checks across all participants
 * - Remains editable when timeline is locked (every action is traced)
 */
import { useState, useCallback } from 'react'
import { CheckSquare } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useCrisisChecklist } from '../../hooks/useCrisisChecklist'
import { ChecklistTaskItem } from './ChecklistTask'
import { ChecklistProgress } from './ChecklistProgress'
import { ChecklistConfirmModal } from './ChecklistConfirmModal'
import type { ChecklistTask } from '../../types/crisis'

interface CrisisChecklistProps {
  crisisId: number
}

export function CrisisChecklist({ crisisId }: CrisisChecklistProps) {
  const { t } = useTranslation()
  const { tasks, isLoading, completedCount, totalCount, progressPercent, check, uncheck, isChecking, error } =
    useCrisisChecklist(crisisId)

  const [pendingTask, setPendingTask] = useState<ChecklistTask | null>(null)

  const handleToggle = useCallback(
    (task: ChecklistTask) => {
      if (task.checked) {
        // Unchecking doesn't need confirmation
        uncheck(task.id)
      } else if (task.priority === 'CRITIQUE') {
        // Critical tasks require confirmation
        setPendingTask(task)
      } else {
        // Non-critical: check directly
        check(task.id)
      }
    },
    [check, uncheck],
  )

  const handleConfirmCritical = useCallback(() => {
    if (pendingTask) {
      check(pendingTask.id)
    }
    setPendingTask(null)
  }, [pendingTask, check])

  const handleCancelConfirm = useCallback(() => {
    setPendingTask(null)
  }, [])

  return (
    <div className="warroom-zone">
      <div className="warroom-zone-header">
        <CheckSquare size={16} style={{ color: 'var(--color-crisis-success)' }} />
        {t('warRoom.checklist')}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="warroom-checklist-progress-wrapper">
          <ChecklistProgress completed={completedCount} total={totalCount} percent={progressPercent} />
        </div>
      )}

      <div className="warroom-zone-content" aria-live="polite" aria-label={t('warRoom.checklist')}>
        {isLoading && <div className="warroom-checklist-empty">{t('common.loading')}</div>}
        {!isLoading && !!error && tasks.length === 0 && (
          <div className="warroom-checklist-empty">{t('warRoom.noChecklist')}</div>
        )}
        {!isLoading && !error && tasks.length === 0 && (
          <div className="warroom-checklist-empty">{t('warRoom.noChecklist')}</div>
        )}
        {!isLoading && tasks.length > 0 && (
          <div className="warroom-checklist-list">
            {tasks.map((task) => (
              <ChecklistTaskItem
                key={task.id}
                task={task}
                onToggle={handleToggle}
                disabled={isChecking}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal for CRITIQUE tasks */}
      <ChecklistConfirmModal
        open={pendingTask !== null}
        taskText={pendingTask?.text ?? ''}
        onConfirm={handleConfirmCritical}
        onCancel={handleCancelConfirm}
      />
    </div>
  )
}