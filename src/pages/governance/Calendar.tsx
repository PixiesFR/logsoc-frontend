import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Badge, Select, Button, Modal, Card, EmptyState } from '../../components/ui'
import { Calendar as CalendarIcon, Download } from 'lucide-react'

const EVENT_TYPE_COLORS: Record<string, string> = {
  committee: 'var(--color-accent)',
  policy_review: 'var(--color-info)',
  audit: 'var(--color-danger)',
  training: 'var(--color-success)',
  remediation_deadline: 'var(--color-warning)',
  vendor_renewal: 'var(--color-warning)',
  risk_review: 'var(--color-danger)',
}

function eventTypeBadge(type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (type) {
    case 'committee': return 'info'
    case 'policy_review': return 'default'
    case 'audit': return 'danger'
    case 'training': return 'success'
    case 'remediation_deadline': return 'warning'
    case 'vendor_renewal': return 'warning'
    case 'risk_review': return 'danger'
    default: return 'default'
  }
}

const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun

export function Calendar() {
  const { t } = useTranslation()

  const [typeFilter, setTypeFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null)
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const params: Record<string, string> = {}
  if (typeFilter) params.type = typeFilter

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const { data: events, isLoading } = useQuery({
    queryKey: ['governance', 'calendar', year, month + 1, params],
    queryFn: () => governanceApi.calendar({ year: String(year), month: String(month + 1), ...params }).then((r) => r.data),
  })

  const items = (Array.isArray(events) ? events : (events as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.calendar.committee'), value: 'committee' },
    { label: t('governance.calendar.policyReview'), value: 'policy_review' },
    { label: t('governance.calendar.audit'), value: 'audit' },
    { label: t('governance.calendar.training'), value: 'training' },
    { label: t('governance.calendar.remediationDeadline'), value: 'remediation_deadline' },
    { label: t('governance.calendar.vendorRenewal'), value: 'vendor_renewal' },
    { label: t('governance.calendar.riskReview'), value: 'risk_review' },
  ]

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday = 0
    const days: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [year, month])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, Record<string, unknown>[]>()
    for (const event of items) {
      const dateStr = String(event.date ?? event.start_date ?? '')
      const day = parseInt(dateStr.split('-')[2], 10)
      if (!isNaN(day)) {
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(event)
      }
    }
    return map
  }, [items])

  const monthNames = [
    t('governance.calendar.january'), t('governance.calendar.february'), t('governance.calendar.march'),
    t('governance.calendar.april'), t('governance.calendar.may'), t('governance.calendar.june'),
    t('governance.calendar.july'), t('governance.calendar.august'), t('governance.calendar.september'),
    t('governance.calendar.october'), t('governance.calendar.november'), t('governance.calendar.december'),
  ]

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function handleExportIcs() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LogSOC//Governance//EN',
    ]
    for (const event of items) {
      const dateStr = String(event.date ?? event.start_date ?? '').replace(/-/g, '')
      lines.push(
        'BEGIN:VEVENT',
        `DTSTART:${dateStr}`,
        `SUMMARY:${String(event.title ?? event.name ?? 'Event')}`,
        `DESCRIPTION:${String(event.description ?? '')}`,
        'END:VEVENT',
      )
    }
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'governance.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.calendar.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportIcs}>
            {t('governance.calendar.exportIcs')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} label={t('common.type')} />
        </div>
      </div>

      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button variant="secondary" onClick={prevMonth}>{t('common.previous')}</Button>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {monthNames[month]} {year}
        </h2>
        <Button variant="secondary" onClick={nextMonth}>{t('common.next')}</Button>
      </div>

      {/* Calendar Grid */}
      <div style={{ borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {DAYS_OF_WEEK.map((d) => (
                <th key={d} style={{ padding: '10px 8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                  {t(`governance.calendar.day${d}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: calendarDays.length / 7 }, (_, weekIdx) => (
              <tr key={weekIdx}>
                {DAYS_OF_WEEK.map((_, dayIdx) => {
                  const day = calendarDays[weekIdx * 7 + dayIdx]
                  const dayEvents = day ? (eventsByDay.get(day) ?? []) : []
                  const isToday = isCurrentMonth && day === today.getDate()
                  return (
                    <td
                      key={dayIdx}
                      style={{
                        padding: '4px 6px',
                        minHeight: '80px',
                        height: '80px',
                        verticalAlign: 'top',
                        border: '1px solid var(--color-border)',
                        background: isToday ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-bg-secondary)',
                        width: `${100 / 7}%`,
                      }}
                    >
                      {day !== null && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)', marginBottom: '2px' }}>
                            {day}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedEvent(ev)}
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: EVENT_TYPE_COLORS[String(ev.type)] ?? 'var(--color-border)',
                                  color: '#fff',
                                  textAlign: 'left',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.4,
                                }}
                              >
                                {String(ev.title ?? ev.name ?? '')}
                              </button>
                            ))}
                            {dayEvents.length > 3 && (
                              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Event list below calendar */}
      {items.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
            {t('governance.calendar.upcomingEvents')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((ev, i) => (
              <Card key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CalendarIcon size={16} style={{ color: EVENT_TYPE_COLORS[String(ev.type)] ?? 'var(--color-text-secondary)' }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{String(ev.title ?? ev.name ?? '')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{String(ev.date ?? ev.start_date ?? '')}</div>
                    </div>
                  </div>
                  <Badge variant={eventTypeBadge(String(ev.type))}>{String(ev.type)}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <EmptyState icon={<CalendarIcon size={48} />} title={t('governance.calendar.noEvents')} description={t('governance.calendar.noEventsDescription')} />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <Modal open={selectedEvent !== null} onClose={() => setSelectedEvent(null)} title={String(selectedEvent.title ?? selectedEvent.name ?? '')} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Badge variant={eventTypeBadge(String(selectedEvent.type))}>{String(selectedEvent.type)}</Badge>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{String(selectedEvent.date ?? selectedEvent.start_date ?? '')}</span>
            </div>
            {String(selectedEvent.description ?? "") && (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(selectedEvent.description)}</p>
            )}
            {String(selectedEvent.location ?? "") && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong>{t('governance.calendar.location')}:</strong> {String(selectedEvent.location)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}