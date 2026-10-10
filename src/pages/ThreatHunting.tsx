import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { huntingApi } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Card, Badge, Button, Modal, Input, EmptyState, Table, useToast, AIAssistButton } from '../components/ui'
import { Crosshair, Play, Trash2 } from 'lucide-react'

interface SavedQuery {
  id: number
  name: string
  description: string
  query: string
  created_at: string
}

interface HuntResult {
  id: number
  event_id: string
  timestamp: string
  source_host: string
  message: string
  severity: string
}

export function ThreatHuntingPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null)
  const [showNewQuery, setShowNewQuery] = useState(false)
  const [results, setResults] = useState<HuntResult[] | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)

  // New query form state
  const [newQueryName, setNewQueryName] = useState('')
  const [newQueryDescription, setNewQueryDescription] = useState('')
  const [newQueryWhere, setNewQueryWhere] = useState('')

  // Queries
  const { data: savedQueries, isLoading: queriesLoading } = useQuery<SavedQuery[]>({
    queryKey: ['hunting', 'saved'],
    queryFn: () => huntingApi.saved().then((r) => r.data),
  })

  // Mutations
  const createQueryMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => huntingApi.createSaved(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hunting', 'saved'] })
      toast('success', t('hunting.createQuerySuccess'))
      setShowNewQuery(false)
      setNewQueryName('')
      setNewQueryDescription('')
      setNewQueryWhere('')
    },
    onError: () => {
      toast('error', t('hunting.createQueryError'))
    },
  })

  // Pre-configured hunting templates
  const huntingTemplates = [
    { name: t('hunting.templateRootProcesses'), description: t('hunting.templatesDescription'), query: t('hunting.templateRootProcessesQuery') },
    { name: t('hunting.templateNonEuConnections'), description: t('hunting.templatesDescription'), query: t('hunting.templateNonEuConnectionsQuery') },
    { name: t('hunting.templateConfigChanges'), description: t('hunting.templatesDescription'), query: t('hunting.templateConfigChangesQuery') },
    { name: t('hunting.templateSecurityDisable'), description: t('hunting.templatesDescription'), query: t('hunting.templateSecurityDisableQuery') },
  ]

  const handleCreateTemplate = useCallback((template: { name: string; description: string; query: string }) => {
    createQueryMutation.mutate({
      name: template.name,
      description: template.description,
      query: template.query,
    })
  }, [createQueryMutation])

  const deleteQueryMutation = useMutation({
    mutationFn: (id: number) => huntingApi.deleteSaved(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hunting', 'saved'] })
      toast('success', t('hunting.deleteQuerySuccess'))
      if (selectedQuery) {
        setSelectedQuery(null)
        setResults(null)
      }
    },
    onError: () => {
      toast('error', t('hunting.deleteQueryError'))
    },
  })

  const handleCreateQuery = useCallback(() => {
    if (!newQueryName.trim() || !newQueryWhere.trim()) return
    createQueryMutation.mutate({
      name: newQueryName,
      description: newQueryDescription,
      query: newQueryWhere,
    })
  }, [newQueryName, newQueryDescription, newQueryWhere, createQueryMutation])

  const handleRunQuery = useCallback(async (query: SavedQuery) => {
    if (!canEdit('analyst')) return
    setResultsLoading(true)
    setResults(null)
    setSelectedQuery(query)
    try {
      const runRes = await huntingApi.run({ id: query.id, query: query.query })
      const huntId = runRes.data?.id ?? runRes.data?.hunt_id ?? query.id
      const resultsRes = await huntingApi.results(huntId)
      setResults(Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.items ?? []))
      toast('success', t('hunting.runSuccess'))
    } catch {
      toast('error', t('hunting.runError'))
    } finally {
      setResultsLoading(false)
    }
  }, [canEdit, toast, t])

  const handleDeleteQuery = useCallback((id: number) => {
    deleteQueryMutation.mutate(id)
  }, [deleteQueryMutation])

  const resultColumns = [
    { key: 'timestamp', label: t('common.date') },
    { key: 'source_host', label: t('hunting.sourceHost') },
    { key: 'severity', label: t('common.severity') },
    { key: 'message', label: t('hunting.message') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('hunting.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <AIAssistButton contextType="threatHunting" contextData={{}} labelKey="aiAssist.suggestQuery" />
          {canEdit('analyst') && (
            <Button variant="primary" size="sm" icon={<Crosshair size={16} />} onClick={() => setShowNewQuery(true)}>
              {t('hunting.newQuery')}
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' }}>
        {/* Left: Saved queries */}
        <Card>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            {t('hunting.savedQueries')}
          </h2>
          {queriesLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '8px' }} />
              ))}
            </div>
          )}
          {!queriesLoading && (!savedQueries || savedQueries.length === 0) && (
            <EmptyState icon={<Crosshair size={32} />} title={t('hunting.noSavedQueries')} />
          )}
          {!queriesLoading && savedQueries && savedQueries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {savedQueries.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: selectedQuery?.id === q.id ? 'var(--color-bg-hover)' : 'var(--color-bg-primary)',
                    cursor: 'pointer',
                  }}
                  onClick={() => { setSelectedQuery(q); setResults(null) }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{q.name}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {canEdit('analyst') && (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '2px', display: 'flex' }}
                          onClick={(e) => { e.stopPropagation(); handleRunQuery(q) }}
                          title={t('hunting.execute')}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {canEdit('analyst') && (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px', display: 'flex' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteQuery(q.id) }}
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {q.description && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{q.description}</div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    WHERE {q.query}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pre-configured templates */}
          {canEdit('analyst') && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                {t('hunting.templates')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {huntingTemplates.map((tpl) => (
                  <button
                    key={tpl.name}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                    }}
                    onClick={() => handleCreateTemplate(tpl)}
                    disabled={createQueryMutation.isPending}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Right: Results */}
        <Card>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            {selectedQuery ? `${t('hunting.results')} — ${selectedQuery.name}` : t('hunting.resultsTitle')}
          </h2>
          {resultsLoading && (
            <Table columns={resultColumns} data={[]} loading />
          )}
          {!resultsLoading && results && results.length > 0 && (
            <Table
              columns={resultColumns}
              data={results as unknown as Record<string, unknown>[]}
              renderCell={(col, row) => {
                if (col.key === 'severity') {
                  const sev = String(row[col.key] ?? '')
                  const variant = sev === 'critical' || sev === 'high' ? 'danger' : sev === 'medium' ? 'warning' : sev === 'low' ? 'default' : 'info'
                  return <Badge variant={variant}>{sev}</Badge>
                }
                return String(row[col.key] ?? '')
              }}
            />
          )}
          {!resultsLoading && results && results.length === 0 && (
            <EmptyState icon={<Crosshair size={32} />} title={t('hunting.noResults')} />
          )}
          {!resultsLoading && !results && !selectedQuery && (
            <EmptyState icon={<Crosshair size={32} />} title={t('hunting.selectQuery')} />
          )}
        </Card>
      </div>

      {/* New query modal */}
      <Modal
        open={showNewQuery}
        onClose={() => setShowNewQuery(false)}
        title={t('hunting.newQuery')}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setShowNewQuery(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreateQuery} disabled={!newQueryName.trim() || !newQueryWhere.trim() || createQueryMutation.isPending}>
              {createQueryMutation.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label={t('common.name')} value={newQueryName} onChange={setNewQueryName} required />
          <Input label={t('common.description')} value={newQueryDescription} onChange={setNewQueryDescription} />
          <Input label={t('hunting.whereClause')} value={newQueryWhere} onChange={setNewQueryWhere} required />
        </div>
      </Modal>
    </div>
  )
}