/**
 * CrisisArchivedPage — read-only view of archived crises with PDF download.
 * Ticket #54 — Archivage de crise + rapport PDF.
 *
 * Features:
 * - List all archived crises (read-only)
 * - Download PDF report per crisis
 * - No edit actions (archived = frozen)
 */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { crisisApi } from '../api'
import { Card, Badge, Button, EmptyState } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { Archive, Download, FileText } from 'lucide-react'

function severityVariant(sev: string): 'danger' | 'warning' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    default: return 'default'
  }
}

export function CrisisArchivedPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data: archived, isLoading } = useQuery({
    queryKey: ['crisis', 'archived'],
    queryFn: () => crisisApi.archived().then((r) => r.data),
  })

  const reportMutation = useMutation({
    mutationFn: (crisisId: number) => crisisApi.report(crisisId),
    onSuccess: (response, crisisId) => {
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crisis_${crisisId}_report.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setDownloadingId(null)
      toast('success', t('crisis.archived.downloadSuccess'))
    },
    onError: () => {
      setDownloadingId(null)
      toast('error', t('crisis.archived.downloadError'))
    },
  })

  const archivedList = (Array.isArray(archived) ? archived : []) as Record<string, unknown>[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('crisis.archived.title')}
        </h1>
        <Archive size={24} style={{ color: 'var(--color-text-secondary)' }} />
      </div>

      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('crisis.archived.description')}
      </p>

      {archivedList.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {archivedList.map((crisis, i) => {
            const crisisId = Number(crisis.id)
            const title = String(crisis.summary ?? crisis.scenario ?? `Crisis #${crisisId}`)
            const sev = String(crisis.severity ?? 'medium')
            const scenario = crisis.scenario ? String(crisis.scenario) : ''
            const archivedAt = crisis.archived_at ? String(crisis.archived_at) : '—'
            const resolvedAt = crisis.resolved_at ? String(crisis.resolved_at) : '—'
            const activatedAt = crisis.activated_at ? String(crisis.activated_at) : '—'

            return (
              <Card key={`${crisisId}-${i}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                    {title}
                  </h3>
                  <Badge variant="default" size="sm">
                    {t('crisis.archived.archived')}
                  </Badge>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <Badge variant={severityVariant(sev)} size="sm">{t(`common.criticalityLabels.${sev}`)}</Badge>
                  {scenario && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{scenario}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>{t('crisis.archived.detected')}:</span> {new Date(activatedAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>{t('crisis.archived.resolved')}:</span> {new Date(resolvedAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>{t('crisis.archived.archivedOn')}:</span> {new Date(archivedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => {
                    setDownloadingId(crisisId)
                    reportMutation.mutate(crisisId)
                  }}
                  disabled={downloadingId === crisisId}
                >
                  {downloadingId === crisisId ? t('common.loading') : t('crisis.archived.downloadPdf')}
                </Button>
              </Card>
            )
          })}
        </div>
      ) : !isLoading && (
        <EmptyState
          icon={<FileText size={32} />}
          title={t('crisis.archived.noArchived')}
        />
      )}
    </div>
  )
}