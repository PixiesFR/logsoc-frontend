/**
 * ChecklistTask — a single reflex checklist task (zone centre).
 * Ticket #45 — Checklist réflexe (zone centre).
 *
 * Displays:
 * - Checkbox (interactive)
 * - Task label
 * - Assigned-to user/role
 * - Priority badge (CRITIQUE in red, etc.)
 * - Audit trail: who checked it and when (if checked)
 *
 * Critical tasks are visually emphasized (red border) and require
 * confirmation before checking — handled by the parent via onRequestCheck.
 */
import { Check } from 'lucide-react'
import { Badge } from '../ui'
import { useTranslation } from '../../i18n/useTranslation'
import { useAuthStore } from '../../stores'
import type { ChecklistTask as ChecklistTaskType } from '../../types/crisis'
import { formatTimestamp } from '../../utils/eventFormatter'

interface ChecklistTaskProps {
  task: ChecklistTaskType
  /** Called when the user clicks the checkbox. Parent decides whether to confirm. */
  onToggle: (task: ChecklistTaskType) => void
  disabled?: boolean
}

export function ChecklistTaskItem({ task, onToggle, disabled }: ChecklistTaskProps) {
  const { t } = useTranslation()
  const expertMode = useAuthStore((s) => s.expertMode)

  const priorityVariant =
    task.priority === 'CRITIQUE'
      ? 'danger'
      : task.priority === 'HAUTE'
        ? 'warning'
        : 'default'

  return (
    <div
      className={`warroom-checklist-item ${task.priority === 'CRITIQUE' ? 'warroom-checklist-item-critical' : ''}`}
      style={task.checked ? { opacity: 0.7 } : undefined}
    >
      <div
        className={`warroom-checklist-checkbox ${task.checked ? 'warroom-checklist-checkbox-done' : ''}`}
        onClick={() => !disabled && onToggle(task)}
        role="checkbox"
        aria-checked={task.checked}
        aria-label={task.text}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggle(task)
          }
        }}
      >
        {task.checked && <Check size={12} color="var(--color-bg-crisis)" />}
      </div>
      <div className="warroom-checklist-task-body">
        <div className="warroom-checklist-task-header">
          <span className={`warroom-checklist-text ${task.checked ? 'warroom-checklist-text-done' : ''}`}>
            {task.text}
          </span>
          <Badge variant={priorityVariant} size="sm">
            {t(`warRoom.checklistPriority.${task.priority}`)}
          </Badge>
        </div>
        <div className="warroom-checklist-task-meta">
          {task.assignedTo && (
            <span className="warroom-checklist-task-assigned">
              {t('warRoom.checklistAssignedTo')}: {task.assignedTo}
            </span>
          )}
          {task.checked && task.checkedByName && task.checkedAt && (
            <span className="warroom-checklist-task-audit">
              {t('warRoom.checklistAuditBy')}: {task.checkedByName} ·{' '}
              {formatTimestamp(task.checkedAt, expertMode)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}