/**
 * CrisisKanban — Kanban view for crisis management.
 * Ticket #54 — Kanban de gestion de crise avec drag-and-drop.
 *
 * Features:
 * - 5 columns: Détectée, En traitement, Sous contrôle, En post-mortem, Résolue
 * - Drag-and-drop cards between columns (HTML5 native)
 * - Card displays: title, severity badge, type, date, elapsed time
 * - Filters: by severity, by type, by period
 * - Toggle list/Kanban view
 * - Status updated via PATCH API when card is moved
 * - Responsive: horizontal scroll on mobile
 */
import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { crisisApi } from '../../api'
import { Badge } from '../ui'
import { useToast } from '../ui/Toast'
import type { DragEvent } from 'react'

/** Kanban column definitions — maps crisis status to column. */
const KANBAN_COLUMNS = [
  { status: 'active', key: 'detected' },
  { status: 'contained', key: 'inTreatment' },
  { status: 'resolved', key: 'underControl' },
  { status: 'postmortem', key: 'postmortem' },
  { status: 'closed', key: 'resolved' },
] as const

function severityVariant(sev: string): 'danger' | 'warning' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'default'
  }
}

/** Compute elapsed time since activation. */
function elapsedSince(activatedAt: string | null | undefined): string {
  if (!activatedAt) return '—'
  const then = new Date(activatedAt).getTime()
  if (isNaN(then)) return '—'
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}j ${hours % 24}h`
  if (hours > 0) return `${hours}h ${Math.floor((diff % 3_600_000) / 60_000)}m`
  const mins = Math.floor(diff / 60_000)
  return `${mins}m`
}

interface CrisisKanbanProps {
  onArchive: (crisisId: number) => void
}

export function CrisisKanban({ onArchive }: CrisisKanbanProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [scenarioFilter, setScenarioFilter] = useState<string>('')
  const [periodFilter, setPeriodFilter] = useState<string>('')

  // Fetch crises
  const { data: crises, isLoading } = useQuery({
    queryKey: ['crisis'],
    queryFn: () => crisisApi.list().then((r: { data: Record<string, unknown>[] }) => r.data),
  })

  // Patch status mutation (Kanban DnD)
  const patchStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      crisisApi.patchStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis'] })
    },
    onError: () => {
      toast('error', t('crisis.kanban.updateError'))
      qc.invalidateQueries({ queryKey: ['crisis'] })
    },
  })

  // Drag state
  const [draggedId, setDraggedId] = useState<number | null>(null)

  const crisisList = useMemo(() => {
    const list = Array.isArray(crises) ? crises : []
    return list.filter((c: Record<string, unknown>) => {
      if (c.status === 'archived') return false
      if (severityFilter && c.severity !== severityFilter) return false
      if (scenarioFilter && c.scenario !== scenarioFilter) return false
      if (periodFilter) {
        const activated = c.activated_at ? new Date(c.activated_at as string).getTime() : 0
        const now = Date.now()
        const diff = now - activated
        if (periodFilter === '24h' && diff > 86_400_000) return false
        if (periodFilter === '7d' && diff > 604_800_000) return false
        if (periodFilter === '30d' && diff > 2_592_000_000) return false
      }
      return true
    })
  }, [crises, severityFilter, scenarioFilter, periodFilter])

  // Group crises by status
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {}
    for (const col of KANBAN_COLUMNS) {
      map[col.status] = []
    }
    for (const crisis of crisisList) {
      const status = String(crisis.status ?? 'active')
      if (map[status]) {
        map[status].push(crisis)
      }
    }
    return map
  }, [crisisList])

  // Unique scenarios for filter dropdown
  const scenarios = useMemo(() => {
    const set = new Set<string>()
    for (const c of (Array.isArray(crises) ? crises : []) as Record<string, unknown>[]) {
      const s = String(c.scenario ?? '')
      if (s) set.add(s)
    }
    return Array.from(set)
  }, [crises])

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, crisisId: number) => {
    setDraggedId(crisisId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(crisisId))
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetStatus: string) => {
    e.preventDefault()
    const crisisId = Number(e.dataTransfer.getData('text/plain'))
    if (!isNaN(crisisId) && crisisId > 0) {
      patchStatusMutation.mutate({ id: crisisId, status: targetStatus })
    }
    setDraggedId(null)
  }, [patchStatusMutation])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">{t('crisis.kanban.allSeverities')}</option>
          <option value="critical">{t('common.criticalityLabels.critical')}</option>
          <option value="high">{t('common.criticalityLabels.high')}</option>
          <option value="medium">{t('common.criticalityLabels.medium')}</option>
        </select>

        <select
          value={scenarioFilter}
          onChange={(e) => setScenarioFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">{t('crisis.kanban.allTypes')}</option>
          {scenarios.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">{t('crisis.kanban.allPeriods')}</option>
          <option value="24h">{t('crisis.kanban.last24h')}</option>
          <option value="7d">{t('crisis.kanban.last7d')}</option>
          <option value="30d">{t('crisis.kanban.last30d')}</option>
        </select>
      </div>

      {/* Kanban board */}
      <div style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '8px',
        minHeight: '400px',
      }}>
        {KANBAN_COLUMNS.map((col) => {
          const items = grouped[col.status] ?? []
          return (
            <div
              key={col.status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
              style={{
                flex: '1 1 260px',
                minWidth: '260px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: draggedId ? '2px dashed var(--color-border)' : '1px solid var(--color-border)',
                transition: 'border 0.2s',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}>
                  {t(`crisis.kanban.columns.${col.key}`)}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              {items.map((crisis, i) => {
                const crisisId = Number(crisis.id)
                const title = String(crisis.summary ?? crisis.scenario ?? `Crisis #${crisisId}`)
                const sev = String(crisis.severity ?? 'medium')
                const scenario = crisis.scenario ? String(crisis.scenario) : ''
                const activatedAt = crisis.activated_at ? String(crisis.activated_at) : null
                const canArchive = col.status === 'closed' || col.status === 'resolved' || col.status === 'postmortem'

                return (
                  <div
                    key={`${crisisId}-${i}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, crisisId)}
                    style={{
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}>
                        {title}
                      </span>
                      <Badge variant={severityVariant(sev)} size="sm">
                        {t(`common.criticalityLabels.${sev}`)}
                      </Badge>
                    </div>
                    {scenario && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {scenario}
                      </span>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                    }}>
                      <span>{activatedAt ? new Date(activatedAt).toLocaleDateString() : '—'}</span>
                      <span>⏱ {elapsedSince(activatedAt)}</span>
                    </div>
                    {canArchive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onArchive(crisisId)
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          alignSelf: 'flex-end',
                        }}
                      >
                        {t('crisis.kanban.archive')}
                      </button>
                    )}
                  </div>
                )
              })}

              {items.length === 0 && !isLoading && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  padding: '16px',
                  fontStyle: 'italic',
                }}>
                  {t('crisis.kanban.empty')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}