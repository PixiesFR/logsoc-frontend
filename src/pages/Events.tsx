import { useState, useCallback } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useEvents, useEventStats } from '../hooks/useData'
import { eventsApi } from '../api'
import { Table, Badge, Modal, Select, SearchBar, Button, EmptyState } from '../components/ui'
import { GlossaryTooltip } from '../components/ui/GlossaryTooltip'
import { Download, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../stores'
import { formatEventMessage, formatTimestamp, cleanFilename } from '../utils/eventFormatter'
import type { EventItem } from '../api/types'

const PAGE_SIZE = 20

const severityVariant = (sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (sev) {
    case 'critical': return 'danger'
    case 'error': return 'danger'
    case 'warning': return 'warning'
    case 'notice': return 'info'
    case 'info': return 'info'
    case 'debug': return 'default'
    default: return 'default'
  }
}

const serviceLabel = (service: string, t: (key: string) => string): string => {
  switch (service) {
    case 'fim': return t('events.serviceType.fim')
    case 'ebpf': return t('events.serviceType.ebpf')
    case 'journald': return t('events.serviceType.journald')
    case 'agent': return t('events.serviceType.agent')
    default: return service
  }
}

const serviceGlossary = (service: string): string | null => {
  switch (service) {
    case 'fim': return 'glossary.fim'
    case 'ebpf': return 'glossary.ebpf'
    case 'journald': return 'glossary.journald'
    default: return null
  }
}

export function EventsPage() {
  const { t } = useTranslation()
  const expertMode = useAuthStore((s) => s.expertMode)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [hostFilter, setHostFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
  if (severityFilter) params.severity = severityFilter
  if (serviceFilter) params.service = serviceFilter
  if (hostFilter) params.source_host = hostFilter

  const { data: events, isLoading } = useEvents(params)
  const { data: stats } = useEventStats()

  const handleExport = useCallback(() => {
    const exportParams: Record<string, string | number> = { page: 1, page_size: 10000 }
    if (severityFilter) exportParams.severity = severityFilter
    if (serviceFilter) exportParams.service = serviceFilter
    eventsApi.list(exportParams).then((res) => {
      const items = res.data as EventItem[]
      const csvRows = [
        ['id', 'timestamp', 'host', 'service', 'severity', 'message'].join(','),
        ...items.map((e) =>
          [e.id, e.received_at, e.source_host, e.service, e.severity, `"${(e.message || '').replace(/"/g, '""')}"`].join(',')
        ),
      ]
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'events.csv'
      a.click()
      URL.revokeObjectURL(url)
    })
  }, [severityFilter, serviceFilter])

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('dashboard.severity.critical'), value: 'critical' },
    { label: t('dashboard.severity.error'), value: 'error' },
    { label: t('dashboard.severity.warning'), value: 'warning' },
    { label: t('dashboard.severity.notice'), value: 'notice' },
    { label: t('dashboard.severity.info'), value: 'info' },
    { label: t('dashboard.severity.debug'), value: 'debug' },
  ]

  const serviceOptions = [
    { label: t('common.all'), value: '' },
    { label: t('events.serviceType.fim'), value: 'fim' },
    { label: t('events.serviceType.ebpf'), value: 'ebpf' },
    { label: t('events.serviceType.journald'), value: 'journald' },
    { label: t('events.serviceType.agent'), value: 'agent' },
  ]

  const columns = [
    { key: 'received_at', label: t('events.timestamp'), width: '160px' },
    { key: 'source_host', label: t('events.host'), width: '140px' },
    { key: 'service', label: t('events.type'), width: '130px' },
    { key: 'severity', label: t('common.severity'), width: '100px' },
    { key: 'message', label: t('events.message') },
  ]

  const filteredEvents = search
    ? (events ?? []).filter((e: EventItem) =>
        e.message?.toLowerCase().includes(search.toLowerCase()) ||
        e.source_host?.toLowerCase().includes(search.toLowerCase()) ||
        e.event_id?.toLowerCase().includes(search.toLowerCase())
      )
    : events ?? []

  const tableData = filteredEvents.map((e: EventItem) => ({
    id: e.id,
    received_at: e.received_at,
    source_host: e.source_host,
    service: e.service,
    severity: e.severity,
    message: e.message,
    _event: e,
  }))

  // Extract MITRE tags from the event
  const getMitreTags = (event: EventItem): string[] => {
    const tags: string[] = []
    if (event.tags && Array.isArray(event.tags)) {
      event.tags.forEach((tag: string) => {
        if (typeof tag === 'string' && (tag.startsWith('T') || tag.startsWith('G') || tag.startsWith('S'))) {
          tags.push(tag)
        }
      })
    }
    return tags
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('events.title')}
      </h1>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <SearchBar value={search} onChange={setSearch} placeholder={t('events.searchPlaceholder')} />
        </div>
        <div style={{ width: '160px' }}>
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            options={severityOptions}
            placeholder={t('common.severity')}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Select
            value={hostFilter}
            onChange={setHostFilter}
            options={[
              { label: t('common.all') || 'Tous', value: '' },
              ...Array.from(new Set((events ?? []).map((e: EventItem) => e.source_host).filter(Boolean))).sort().map((h: string) => ({ label: h, value: h })),
            ]}
            placeholder={t('events.host') || 'Host'}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Select
            value={serviceFilter}
            onChange={setServiceFilter}
            options={serviceOptions}
            placeholder={t('events.type')}
          />
        </div>
        <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
          {t('events.export')}
        </Button>
      </div>

      {isLoading && <Table columns={columns} data={[]} loading={true} />}

      {!isLoading && tableData.length === 0 && (
        <EmptyState icon={<FileText size={32} />} title={t('events.noEvents')} />
      )}

      {!isLoading && tableData.length > 0 && (
        <>
          <Table
            columns={columns}
            data={tableData}
            renderCell={(col, row) => {
              if (col.key === 'severity') {
                return <Badge variant={severityVariant(row.severity as string)} size="sm">{t(`dashboard.severity.${row.severity}`)}</Badge>
              }
              if (col.key === 'service') {
                const svc = row.service as string
                const label = serviceLabel(svc, t)
                const glossaryKey = serviceGlossary(svc)
                return glossaryKey
                  ? <GlossaryTooltip term={glossaryKey}><span>{label}</span></GlossaryTooltip>
                  : <span>{label}</span>
              }
              if (col.key === 'received_at') {
                return <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formatTimestamp(row.received_at as string, expertMode)}</span>
              }
              if (col.key === 'message') {
                const ev = row._event as EventItem
                const msg = formatEventMessage(ev, expertMode)
                return <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{msg}</span>
              }
              return String(row[col.key] ?? '')
            }}
            onRowClick={(row) => {
              const ev = row._event as EventItem
              setSelectedEvent(ev)
              setShowRawJson(false)
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              {t('common.previous')}
            </Button>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {t('events.page', { page })}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={tableData.length < PAGE_SIZE}>
              {t('common.next')}
            </Button>
          </div>
        </>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '4px' }}>
          {Object.entries(stats.by_severity).map(([sev, count]) => (
            <div key={sev} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t(`dashboard.severity.${sev}`)}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{count}</div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <Modal
          open={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title={t('events.detail')}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <DetailRow label={t('events.timestamp')} value={formatTimestamp(selectedEvent.received_at, expertMode)} />
            <DetailRow label={t('events.host')} value={selectedEvent.source_host} />
            <DetailRow label={t('events.sourceIp')} value={selectedEvent.source_ip} />
            <DetailRow
              label={t('events.type')}
              value={
                <span>
                  {serviceGlossary(selectedEvent.service)
                    ? <GlossaryTooltip term={serviceGlossary(selectedEvent.service)!}>{serviceLabel(selectedEvent.service, t)}</GlossaryTooltip>
                    : serviceLabel(selectedEvent.service, t)
                  }
                </span>
              }
            />
            <DetailRow label={t('common.severity')} value={t(`dashboard.severity.${selectedEvent.severity}`)} />
            <DetailRow label={t('events.message')} value={formatEventMessage(selectedEvent, expertMode)} />
            <DetailRow label={t('events.agentId')} value={selectedEvent.agent_id} />
            {selectedEvent.username && <DetailRow label={t('events.username')} value={selectedEvent.username} />}
            {!selectedEvent.username && selectedEvent.uid != null && <DetailRow label={t('events.username')} value={t('events.uid', { uid: selectedEvent.uid })} />}
            {selectedEvent.filename && <DetailRow label={t('events.filename')} value={cleanFilename(selectedEvent.filename, expertMode)} />}
            {selectedEvent.dst_ip && <DetailRow label={t('events.dstIp')} value={selectedEvent.dst_ip} />}
            {selectedEvent.pid && <DetailRow label="PID" value={String(selectedEvent.pid)} />}

            {/* MITRE ATT&CK tags */}
            {getMitreTags(selectedEvent).length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  <GlossaryTooltip term="glossary.mitre">MITRE ATT&CK</GlossaryTooltip>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {getMitreTags(selectedEvent).map((tag) => (
                    <a
                      key={tag}
                      href={`/mitre?technique=${tag}`}
                      style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-accent)', textDecoration: 'none' }}
                    >
                      {tag}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON only in expert mode */}
            {expertMode && selectedEvent.raw_message && (
              <div>
                <div
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  {showRawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {t('events.rawMessage')}
                </div>
                {showRawJson && (
                  <pre style={{ fontSize: '12px', color: 'var(--color-text-primary)', background: 'var(--color-bg-primary)', padding: '12px', borderRadius: '8px', overflow: 'auto', margin: 0 }}>
                    {selectedEvent.raw_message}
                  </pre>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '140px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}