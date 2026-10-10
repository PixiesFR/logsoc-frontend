/**
 * TimelineEntry — a single entry in the crisis timeline (zone gauche).
 * Ticket #44.
 *
 * - Locked entries: 🔒 icon, non-editable, slightly grayed background
 * - System entries: ⚙️ icon, automatic (eBPF, incident status)
 * - User entries: standard display
 *
 * Accessibility: aria-live="polite" is set on the parent list container.
 */
import { Lock, Cog } from 'lucide-react'
import type { TimelineEntry as TimelineEntryType } from '../../types/crisis'
import { useTranslation } from '../../i18n/useTranslation'
import { formatTimestamp } from '../../utils/eventFormatter'

interface TimelineEntryProps {
  entry: TimelineEntryType
}

export function TimelineEntry({ entry }: TimelineEntryProps) {
  const { t } = useTranslation()
  const isSystem = entry.type === 'system'
  const isLocked = entry.locked

  return (
    <div
      className={`warroom-timeline-entry ${isLocked ? 'warroom-timeline-entry-locked' : ''} ${isSystem ? 'warroom-timeline-entry-system' : ''}`}
      role="article"
      aria-label={t('warRoom.timelineEntryAria', { time: entry.timestamp })}
    >
      <div className={`warroom-timeline-dot ${isSystem ? 'warroom-timeline-dot-system' : ''}`} />
      <div className="warroom-timeline-entry-body">
        <div className="warroom-timeline-entry-meta">
          <span className="warroom-timeline-time">{formatTimestamp(entry.timestamp, false)}</span>
          <span className="warroom-timeline-author">
            {entry.author}
            {entry.authorRole && entry.authorRole !== '—' && (
              <span className="warroom-timeline-author-role"> · {entry.authorRole}</span>
            )}
          </span>
          {isLocked && (
            <span className="warroom-timeline-icon-locked" title={t('warRoom.locked')}>
              <Lock size={12} />
            </span>
          )}
          {isSystem && (
            <span className="warroom-timeline-icon-system" title={t('warRoom.systemEntry')}>
              <Cog size={12} />
            </span>
          )}
        </div>
        <div className="warroom-timeline-text">{entry.content}</div>
        {isSystem && entry.systemSource && (
          <div className="warroom-timeline-source">{entry.systemSource}</div>
        )}
      </div>
    </div>
  )
}