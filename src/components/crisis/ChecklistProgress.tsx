/**
 * ChecklistProgress — progress bar showing X/Y completed tasks + percentage.
 * Ticket #45 — Checklist réflexe (zone centre).
 */
import { useTranslation } from '../../i18n/useTranslation'

interface ChecklistProgressProps {
  completed: number
  total: number
  /** Progress percentage (0-100). If omitted, computed from completed/total. */
  percent?: number
}

export function ChecklistProgress({ completed, total, percent }: ChecklistProgressProps) {
  const { t } = useTranslation()
  const pct = percent ?? (total > 0 ? Math.round((completed / total) * 100) : 0)

  return (
    <div className="checklist-progress">
      <div className="checklist-progress-bar-bg">
        <div
          className="checklist-progress-bar-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('warRoom.checklistProgress')}
        />
      </div>
      <div className="checklist-progress-label">
        {completed}/{total} {t('warRoom.checklistCompleted')} ({pct}%)
      </div>
    </div>
  )
}