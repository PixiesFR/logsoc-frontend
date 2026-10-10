import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { yaraApi, agentsApi } from '../api'
import { Card, Badge, Button, SearchBar, Select, Modal, Table } from '../components/ui'
import { Download } from 'lucide-react'

interface YaraMatch {
  id: string
  rule_name: string
  file_path: string
  severity: string
  timestamp: string
  agent: string
  rule_id?: string
  match_details?: string
  matched_strings?: string[]
  file_hash?: string
  file_size?: number
}

interface YaraMatchListResponse {
  items: YaraMatch[]
  total: number
  page: number
  page_size: number
  pages: number
}

function severityToVariant(sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'error': return 'danger'
    case 'warning': return 'warning'
    case 'medium': return 'warning'
    case 'notice': return 'info'
    case 'info': return 'info'
    case 'low': return 'info'
    default: return 'default'
  }
}

export function YaraMatchesPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [selectedMatch, setSelectedMatch] = useState<YaraMatch | null>(null)

  const pageSize = 20

  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  }
  if (search) queryParams.search = search
  if (severityFilter) queryParams.severity = severityFilter
  if (agentFilter) queryParams.agent = agentFilter

  const { data: matchesData, isLoading } = useQuery<YaraMatchListResponse>({
    queryKey: ['yara-matches', queryParams],
    queryFn: () => yaraApi.listResults(queryParams).then((r) => r.data),
  })

  const { data: agentsData } = useQuery<unknown[]>({
    queryKey: ['agents-list'],
    queryFn: () => agentsApi.list().then((r) => r.data),
  })

  const agentOptions = useMemo(() => {
    const opts = [{ label: t('common.all'), value: '' }]
    const agents = (agentsData ?? []) as Array<Record<string, unknown>>
    const seen = new Set<string>()
    for (const agent of agents) {
      const hostname = String(agent.hostname ?? agent.name ?? agent.agent_id ?? agent.id ?? '').trim()
      if (hostname && !seen.has(hostname)) {
        seen.add(hostname)
        opts.push({ label: hostname, value: hostname })
      }
    }
    return opts
  }, [agentsData, t])

  const matches = matchesData?.items ?? []
  const totalPages = matchesData?.pages ?? 1

  const handleExportCsv = useCallback(() => {
    if (!matches.length) return
    const headers = ['rule_name', 'file_path', 'severity', 'timestamp', 'agent']
    const rows = matches.map((m) => [m.rule_name, m.file_path, m.severity, m.timestamp, m.agent])
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'yara_matches.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [matches])

  const columns = [
    { key: 'rule_name', label: t('yara.colRuleName') },
    { key: 'file_path', label: t('yara.colFilePath') },
    { key: 'severity', label: t('common.severity') },
    { key: 'timestamp', label: t('yara.colTimestamp') },
    { key: 'agent', label: t('yara.colAgent') },
  ]

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('dashboard.severity.critical'), value: 'critical' },
    { label: t('dashboard.severity.warning'), value: 'warning' },
    { label: t('dashboard.severity.info'), value: 'info' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('yara.matches')}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={handleExportCsv}
          disabled={matches.length === 0}
        >
          {t('common.export')} CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t('yara.searchMatches')} />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              options={severityOptions}
              placeholder={t('common.severity')}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={agentFilter}
              onChange={setAgentFilter}
              options={agentOptions}
              placeholder={t('yara.colAgent')}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          data={matches as unknown as Record<string, unknown>[]}
          loading={isLoading}
          emptyMessage={t('yara.noMatches')}
          renderCell={(col, row) => {
            const match = row as unknown as YaraMatch
            if (col.key === 'severity') {
              return <Badge variant={severityToVariant(match.severity)}>{match.severity}</Badge>
            }
            if (col.key === 'rule_name') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => setSelectedMatch(match)}
                >
                  {match.rule_name}
                </span>
              )
            }
            if (col.key === 'file_path') {
              return (
                <span style={{ fontSize: '13px', wordBreak: 'break-all' }}>
                  {match.file_path}
                </span>
              )
            }
            if (col.key === 'timestamp') {
              return new Date(match.timestamp).toLocaleString()
            }
            return String(match[col.key as keyof YaraMatch] ?? '')
          }}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {t('common.previous')}
            </Button>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </Card>

      {/* Match Detail Modal */}
      {selectedMatch && (
        <Modal
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          title={selectedMatch.rule_name}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedMatch(null)}>
              {t('common.close')}
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Badge variant={severityToVariant(selectedMatch.severity)}>{selectedMatch.severity}</Badge>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('yara.colFilePath')}:
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0', wordBreak: 'break-all' }}>
                {selectedMatch.file_path}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('yara.colAgent')}:
              </span>
              <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {selectedMatch.agent}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('yara.colTimestamp')}:
              </span>
              <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {new Date(selectedMatch.timestamp).toLocaleString()}
              </span>
            </div>
            {selectedMatch.match_details && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.matchDetails')}:
                </span>
                <pre style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  overflow: 'auto',
                  maxHeight: '200px',
                  margin: '4px 0 0',
                }}>
                  {selectedMatch.match_details}
                </pre>
              </div>
            )}
            {selectedMatch.matched_strings && selectedMatch.matched_strings.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.matchedStrings')}:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {selectedMatch.matched_strings.map((s, i) => (
                    <Badge key={i} variant="info" size="sm">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedMatch.file_hash && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Hash:
                </span>
                <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                  {selectedMatch.file_hash}
                </span>
              </div>
            )}
            {selectedMatch.file_size != null && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.fileSize')}:
                </span>
                <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {selectedMatch.file_size} bytes
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}