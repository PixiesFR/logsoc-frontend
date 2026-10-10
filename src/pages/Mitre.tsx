import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { mitreApi } from '../api'
import { Card, Badge, Button, Select, Modal, StatCard, EmptyState } from '../components/ui'
import { Shield, Target } from 'lucide-react'

interface MitreCoverage {
  tactics: MitreTactic[]
  coverage_score: number
  total_techniques: number
  covered_techniques: number
}

interface MitreTactic {
  id: string
  name: string
  techniques: MitreTechnique[]
}

interface MitreTechnique {
  id: string
  name: string
  coverage: 'active' | 'partial' | 'uncovered'
  rules_count: number
  tactics: string[]
  subtechniques?: string[]
  rules?: MitreRule[]
  recent_alerts?: MitreAlert[]
}

interface MitreRule {
  id: string
  name: string
  type: string
  severity: string
}

interface MitreAlert {
  id: string
  title: string
  severity: string
  created_at: string
}

function coverageToVariant(coverage: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (coverage) {
    case 'active': return 'success'
    case 'partial': return 'warning'
    case 'uncovered': return 'default'
    default: return 'default'
  }
}

function coverageToBg(coverage: string): string {
  switch (coverage) {
    case 'active': return 'color-mix(in srgb, var(--color-success) 25%, transparent)'
    case 'partial': return 'color-mix(in srgb, var(--color-warning) 25%, transparent)'
    case 'uncovered': return 'color-mix(in srgb, var(--color-text-secondary) 8%, transparent)'
    default: return 'var(--color-bg-primary)'
  }
}

function coverageToBorder(coverage: string): string {
  switch (coverage) {
    case 'active': return 'var(--color-success)'
    case 'partial': return 'var(--color-warning)'
    case 'uncovered': return 'var(--color-border)'
    default: return 'var(--color-border)'
  }
}

export function MitrePage() {
  const { t } = useTranslation()

  const [groupFilter, setGroupFilter] = useState('')
  const [selectedTechnique, setSelectedTechnique] = useState<MitreTechnique | null>(null)

  const { data: coverageData, isLoading } = useQuery<MitreCoverage>({
    queryKey: ['mitre-coverage'],
    queryFn: () => mitreApi.coverage().then((r) => {
      const raw = r.data as Record<string, unknown>
      // Backend may return tactics as an object { "tactic-name": { count, techniques, rule_count, rules } }
      // or as an array of { id, name, techniques: [...] }
      const rawTactics = raw.tactics as Record<string, unknown> | MitreTactic[] | undefined

      let tactics: MitreTactic[]
      if (Array.isArray(rawTactics)) {
        tactics = rawTactics as MitreTactic[]
      } else if (rawTactics && typeof rawTactics === 'object') {
        // Transform object-format tactics into array
        tactics = Object.entries(rawTactics).map(([key, value]) => {
          const tacticData = value as Record<string, unknown>
          const rawTechniques = (tacticData.techniques ?? []) as (string | MitreTechnique)[]
          const rawRules = (tacticData.rules ?? []) as string[]
          const techniqueObjects: MitreTechnique[] = rawTechniques.map((tech) => {
            if (typeof tech === 'string') {
              return {
                id: tech,
                name: tech,
                coverage: rawRules.length > 0 ? 'partial' : 'uncovered',
                rules_count: rawRules.length,
                tactics: [key],
              } as MitreTechnique
            }
            return tech as MitreTechnique
          })
          return {
            id: key,
            name: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            techniques: techniqueObjects,
          } as MitreTactic
        })
      } else {
        tactics = []
      }

      return {
        tactics,
        coverage_score: typeof raw.coverage_score === 'number' ? raw.coverage_score as number : (typeof raw.covered_techniques === 'number' && typeof raw.total_techniques === 'number' && (raw.total_techniques as number) > 0 ? ((raw.covered_techniques as number) / (raw.total_techniques as number)) * 100 : 0),
        total_techniques: typeof raw.total_techniques === 'number' ? raw.total_techniques as number : tactics.reduce((sum, t) => sum + t.techniques.length, 0),
        covered_techniques: typeof raw.covered_techniques === 'number' ? raw.covered_techniques as number : tactics.reduce((sum, t) => sum + t.techniques.filter((tech) => tech.coverage !== 'uncovered').length, 0),
      } as MitreCoverage
    }),
  })

  const tactics = coverageData?.tactics ?? []
  const coverageScore = coverageData?.coverage_score ?? 0
  const totalTechniques = coverageData?.total_techniques ?? 0
  const coveredTechniques = coverageData?.covered_techniques ?? 0

  const groupOptions = [
    { label: t('common.all'), value: '' },
    { label: 'APT28', value: 'apt28' },
    { label: 'APT29', value: 'apt29' },
    { label: 'FIN7', value: 'fin7' },
    { label: 'Lazarus', value: 'lazarus' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mitre.title')}
        </h1>
        <div style={{ minWidth: '180px' }}>
          <Select
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            placeholder={t('mitre.filterGroup')}
          />
        </div>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('mitre.coverageScore')}
          value={`${Math.round(coverageScore)}%`}
          icon={<Shield size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('mitre.coveredTechniques')}
          value={`${coveredTechniques} / ${totalTechniques}`}
          icon={<Target size={20} style={{ color: 'var(--color-success)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('mitre.totalTechniques')}
          value={totalTechniques}
          icon={<Target size={20} style={{ color: 'var(--color-text-secondary)' }} />}
          loading={isLoading}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          {t('mitre.legend')}:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: coverageToBg('active'), border: `1px solid ${coverageToBorder('active')}` }} />
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{t('mitre.activeCoverage')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: coverageToBg('partial'), border: `1px solid ${coverageToBorder('partial')}` }} />
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{t('mitre.partialCoverage')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: coverageToBg('uncovered'), border: `1px solid ${coverageToBorder('uncovered')}` }} />
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{t('mitre.uncovered')}</span>
        </div>
      </div>

      {/* MITRE Matrix */}
      {isLoading ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '8px' }} />
            ))}
          </div>
        </Card>
      ) : tactics.length === 0 ? (
        <EmptyState
          icon={<Target size={32} />}
          title={t('mitre.noData')}
        />
      ) : (
        <div style={{
          overflowX: 'auto',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}>
          <div style={{ display: 'flex', minWidth: 'max-content' }}>
            {tactics.map((tactic) => (
              <div
                key={tactic.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '160px',
                  flex: 1,
                }}
              >
                {/* Tactic header */}
                <div style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-bg-primary)',
                  borderBottom: '2px solid var(--color-border)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.5px',
                }}>
                  {tactic.name}
                </div>
                {/* Techniques */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 4px' }}>
                  {tactic.techniques.length === 0 ? (
                    <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      —
                    </div>
                  ) : (
                    tactic.techniques.map((tech) => (
                      <button
                        key={tech.id}
                        onClick={() => setSelectedTechnique(tech)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px 6px',
                          borderRadius: '6px',
                          border: `1px solid ${coverageToBorder(tech.coverage)}`,
                          background: coverageToBg(tech.coverage),
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                          minWidth: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                          {tech.id}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                          {tech.name}
                        </span>
                        {tech.rules_count > 0 && (
                          <Badge variant={coverageToVariant(tech.coverage)} size="sm">
                            {tech.rules_count}
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technique Detail Modal */}
      {selectedTechnique && (
        <Modal
          open={!!selectedTechnique}
          onClose={() => setSelectedTechnique(null)}
          title={`${selectedTechnique.id} — ${selectedTechnique.name}`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedTechnique(null)}>
              {t('common.close')}
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Badge variant={coverageToVariant(selectedTechnique.coverage)}>
                {selectedTechnique.coverage === 'active'
                  ? t('mitre.activeCoverage')
                  : selectedTechnique.coverage === 'partial'
                  ? t('mitre.partialCoverage')
                  : t('mitre.uncovered')}
              </Badge>
              <Badge variant="default">
                {selectedTechnique.rules_count} {t('mitre.rulesCount')}
              </Badge>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('mitre.tactics')}:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {selectedTechnique.tactics.map((tac) => (
                  <Badge key={tac} variant="info" size="sm">{tac}</Badge>
                ))}
              </div>
            </div>

            {selectedTechnique.rules && selectedTechnique.rules.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('mitre.associatedRules')}:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {selectedTechnique.rules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'var(--color-bg-primary)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <Badge variant={coverageToVariant(rule.severity)} size="sm">{rule.severity}</Badge>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{rule.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{rule.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTechnique.recent_alerts && selectedTechnique.recent_alerts.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('mitre.recentAlerts')}:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {selectedTechnique.recent_alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'var(--color-bg-primary)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <Badge variant={coverageToVariant(alert.severity)} size="sm">{alert.severity}</Badge>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', flex: 1 }}>{alert.title}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {new Date(alert.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}