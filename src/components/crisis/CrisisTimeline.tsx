/**
 * CrisisTimeline — main component for the War Room left zone.
 * Ticket #44 — Timeline de crise verrouillée.
 *
 * Features:
 * - Chronological display (newest at bottom, descending order = scroll down)
 * - Locked entries with 🔒, system entries with ⚙️
 * - WebSocket real-time updates (entry_added, entry_locked)
 * - Auto-scroll to newest entry on WebSocket message
 * - Text input + lock button at bottom
 * - Export PDF button
 * - aria-live="polite" for accessibility
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { crisisTimelineApi, normalizeTimelineEntry } from '../../api/crisis'
import type { TimelineEntry as TimelineEntryType, CrisisWebSocketMessage } from '../../types/crisis'
import { useCrisisStore } from '../../stores/crisisStore'
import type { TimelineSortOrder } from '../../stores/crisisStore'
import { TimelineEntry } from './TimelineEntry'
import { TimelineInput } from './TimelineInput'
import { TimelineExportButton } from './TimelineExportButton'
import { useCrisisWebSocket } from '../../hooks/useCrisisWebSocket'

interface CrisisTimelineProps {
  incidentId: number
}

export function CrisisTimeline({ incidentId }: CrisisTimelineProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [entries, setEntries] = useState<TimelineEntryType[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const sortOrder = useCrisisStore((s) => s.timelineSortOrder)
  const setSortOrder = useCrisisStore((s) => s.setTimelineSortOrder)

  // Fetch timeline entries
  const { data: rawEntries, isLoading, error } = useQuery({
    queryKey: ['crisis', 'timeline', incidentId],
    queryFn: () => crisisTimelineApi.list(incidentId).then((r) => r.data),
    enabled: !!incidentId,
  })

  // Sort entries based on configured order: 'desc' = newest at top, 'asc' = newest at bottom
  const sortEntries = useCallback(
    (list: TimelineEntryType[]): TimelineEntryType[] =>
      [...list].sort((a, b) =>
        sortOrder === 'desc'
          ? (a.timestamp < b.timestamp ? 1 : -1)
          : (a.timestamp > b.timestamp ? 1 : -1),
      ),
    [sortOrder],
  )

  // Normalize API response into TimelineEntry[]
  useEffect(() => {
    if (!rawEntries) return
    const list = Array.isArray(rawEntries)
      ? rawEntries
      : ((rawEntries as Record<string, unknown>)?.items ?? [])
    const normalized = (list as Record<string, unknown>[]).map(normalizeTimelineEntry)
    setEntries(sortEntries(normalized))
  }, [rawEntries, sortEntries])

  // Auto-scroll: to top for 'desc' (newest first), to bottom for 'asc' (newest last)
  const scrollToEdge = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        sortOrder === 'desc' ? 0 : scrollRef.current.scrollHeight
    }
  }, [sortOrder])

  useEffect(() => {
    scrollToEdge()
  }, [entries, scrollToEdge])

  const toggleSortOrder = () => {
    const newOrder: TimelineSortOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(newOrder)
  }

  // WebSocket message handler
  const handleWsMessage = useCallback(
    (msg: CrisisWebSocketMessage) => {
      if (msg.type === 'entry_added') {
        setEntries((prev) => {
          // Avoid duplicates
          if (prev.some((e) => e.id === msg.entry.id)) return prev
          return sortEntries([...prev, msg.entry])
        })
        // Invalidate the query to keep in sync with backend
        qc.invalidateQueries({ queryKey: ['crisis', 'timeline', incidentId] })
      } else if (msg.type === 'entry_locked') {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === msg.entry_id ? { ...e, locked: true } : e,
          ),
        )
      }
    },
    [qc, incidentId, sortEntries],
  )

  const { isConnected } = useCrisisWebSocket({
    incidentId,
    onMessage: handleWsMessage,
    enabled: !!incidentId,
  })

  return (
    <div className="warroom-zone">
      <div className="warroom-zone-header">
        <Clock size={16} style={{ color: 'var(--color-crisis-warning)' }} />
        {t('warRoom.timeline')}
        <span
          className={`warroom-timeline-ws-status ${isConnected ? 'warroom-timeline-ws-connected' : 'warroom-timeline-ws-disconnected'}`}
          title={isConnected ? t('warRoom.wsConnected') : t('warRoom.wsDisconnected')}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              display: 'inline-block',
            }}
          />
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className="warroom-btn"
            onClick={toggleSortOrder}
            title={sortOrder === 'desc' ? t('warRoom.sortNewestFirst') : t('warRoom.sortNewestLast')}
            aria-label={t('warRoom.sortOrder')}
          >
            {sortOrder === 'desc' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpWideNarrow size={14} />}
            {sortOrder === 'desc' ? t('warRoom.sortNewestFirst') : t('warRoom.sortNewestLast')}
          </button>
          <TimelineExportButton incidentId={incidentId} />
        </div>
      </div>

      <div
        className="warroom-zone-content"
        ref={scrollRef}
        aria-live="polite"
        aria-label={t('warRoom.timeline')}
      >
        {isLoading && (
          <div className="warroom-timeline-empty">
            {t('common.loading')}
          </div>
        )}
        {!isLoading && !!error && entries.length === 0 && (
          <div className="warroom-timeline-empty">
            {t('warRoom.noTimeline')}
          </div>
        )}
        {!isLoading && !error && entries.length === 0 && (
          <div className="warroom-timeline-empty">
            {t('warRoom.noTimeline')}
          </div>
        )}
        {entries.length > 0 && (
          <div className="warroom-timeline-list">
            {entries.map((entry) => (
              <TimelineEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <TimelineInput incidentId={incidentId} onEntryAdded={scrollToEdge} />
    </div>
  )
}