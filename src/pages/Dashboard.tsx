import { useTranslation } from '../i18n/useTranslation'
import { useEventStats, useAlerts, useAssets, useSystemHealth } from '../hooks/useData'
import { Card, StatCard, Badge, EmptyState, Tabs } from '../components/ui'
import { GlossaryTooltip } from '../components/ui/GlossaryTooltip'
import { EventsChart, SeverityChart, SystemStatus, RecentEvents, PolicyReadRateWidget } from '../components/dashboard'
import { Activity, AlertTriangle, Database, Zap, Server, Cpu } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../stores'
import { formatTimestamp, translateAlertTitle } from '../utils/eventFormatter'
import type { AlertItem, AssetItem } from '../api/types'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(timestamp: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const now = Date.now()
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  const ts = new Date(normalized).getTime()
  const diffMs = now - ts
  if (diffMs < 0) return t('dashboard.justNow')
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('dashboard.justNow')
  if (diffMin < 60) return t('dashboard.minutesAgo', { count: diffMin })
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('dashboard.hoursAgo', { count: diffH })
  const diffD = Math.floor(diffH / 24)
  return t('dashboard.daysAgo', { count: diffD })
}

function severityToVariant(sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
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

function getActivityLevel(epm: number, t: (key: string, params?: Record<string, string | number>) => string): { label: string; color: string } {
  if (epm > 10000) return { label: t('utils.activityHigh'), color: 'var(--color-danger)' }
  if (epm > 1000) return { label: t('utils.activityNormal'), color: 'var(--color-warning)' }
  return { label: t('utils.activityLow'), color: 'var(--color-success)' }
}

function getAlertBadge(openAlerts: number, criticalCount: number, highCount: number): { text: string; color: string } {
  if (criticalCount > 0) return { text: String(openAlerts), color: 'var(--color-danger)' }
  if (highCount > 0) return { text: String(openAlerts), color: 'var(--color-warning)' }
  return { text: String(openAlerts), color: 'var(--color-success)' }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const expertMode = useAuthStore((s) => s.expertMode)
  const [recentTab, setRecentTab] = useState('events')

  const { data: eventStats, isLoading: statsLoading } = useEventStats()
  const { data: alerts, isLoading: alertsLoading } = useAlerts({ page: 1, page_size: 5 })
  const { data: assets, isLoading: assetsLoading } = useAssets({ page: '1', page_size: '10' })
  const { data: health } = useSystemHealth()

  const activeAgents = assets?.filter((a: AssetItem) => a.status === 'active').length ?? 0
  const openAlerts = alerts?.filter((a: AlertItem) => a.status === 'new' || a.status === 'acknowledged').length ?? 0

  // Count severity for alert badge
  const criticalAlerts = alerts?.filter((a: AlertItem) => a.severity === 'critical' && (a.status === 'new' || a.status === 'acknowledged')).length ?? 0
  const highAlerts = alerts?.filter((a: AlertItem) => a.severity === 'high' && (a.status === 'new' || a.status === 'acknowledged')).length ?? 0
  const alertBadge = getAlertBadge(openAlerts, criticalAlerts, highAlerts)

  // Build severity chart data
  const severityData = eventStats
    ? Object.entries(eventStats.by_severity).map(([sev, count]) => ({
        severity: t(`dashboard.severity.${sev}`),
        count,
      }))
    : []

  // Build events chart data (mock timeline from stats - real chart needs timeseries API)
  // For now, use by_service as distribution
  const serviceData = eventStats
    ? Object.entries(eventStats.by_service).map(([svc, count]) => ({
        time: svc,
        count,
      }))
    : []

  // Recent events: map API events to display format
  // Propagate tags for self-noise filtering (AppArmor ALLOWED logsoc-agent, ticket #56)
  const recentEvents = (alerts ?? []).slice(0, 5).map((a: AlertItem) => ({
    id: a.id,
    type: a.rule_id || 'alert',
    message: translateAlertTitle(a.title, expertMode),
    timestamp: a.created_at,
    severity: a.severity,
    tags: (a as unknown as Record<string, unknown>).tags != null
      ? ((a as unknown as Record<string, unknown>).tags as string[])
      : undefined,
  }))

  // Activity level for stat card context
  const epm = eventStats?.events_per_minute ?? 0
  const activityLevel = getActivityLevel(epm, t)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('dashboard.title')}
      </h1>

      {/* Stat cards row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('dashboard.totalEvents')}
            value={eventStats ? formatNumber(eventStats.total) : '—'}
            icon={<Database size={20} style={{ color: 'var(--color-accent)' }} />}
            loading={statsLoading}
          />
          {!expertMode && eventStats && (
            <div style={{ fontSize: '12px', color: activityLevel.color, marginTop: '4px', paddingLeft: '20px' }}>
              {activityLevel.label}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('dashboard.eventsPerMin')}
            value={eventStats ? eventStats.events_per_minute.toFixed(0) : '—'}
            icon={<Zap size={20} style={{ color: 'var(--color-warning)' }} />}
            loading={statsLoading}
          />
        </div>

        <StatCard
          label={t('dashboard.activeAgents')}
          value={activeAgents}
          icon={<Server size={20} style={{ color: 'var(--color-success)' }} />}
          loading={assetsLoading}
        />

        <div style={{ position: 'relative' }}>
          <StatCard
            label={t('dashboard.openAlerts')}
            value={expertMode ? openAlerts : t('utils.openAlerts', { count: openAlerts })}
            icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />}
            loading={alertsLoading}
          />
          {!expertMode && openAlerts > 0 && (
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: alertBadge.color }} />
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {t('dashboard.eventsBySeverity')}
            </h2>
          </div>
          {severityData.length > 0 ? (
            <SeverityChart data={severityData} loading={statsLoading} />
          ) : (
            <EmptyState icon={<Activity size={32} />} title={t('dashboard.noEvents')} />
          )}
        </Card>

        <Card>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              <GlossaryTooltip term="glossary.ebpf">{t('dashboard.systemStatus')}</GlossaryTooltip>
            </h2>
          </div>
          {health && <SystemStatus status={health} />}
          {!health && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className="skeleton" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ width: '120px', height: '32px', borderRadius: '6px' }} />
            </div>
          )}
        </Card>
      </div>

      {/* Policy read rate widget */}
      <PolicyReadRateWidget />

      {/* Recent activity row */}
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('dashboard.recentActivity')}
          </h2>
        </div>
        <Tabs
          tabs={[
            { key: 'events', label: t('dashboard.recentEvents'), count: recentEvents.length },
            { key: 'alerts', label: t('dashboard.recentAlerts'), count: alerts?.length ?? 0 },
          ]}
          active={recentTab}
          onChange={setRecentTab}
        />
        <div style={{ marginTop: '16px' }}>
          {recentTab === 'events' && (
            <RecentEvents events={recentEvents} loading={alertsLoading} />
          )}
          {recentTab === 'alerts' && (
            alerts && alerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts.slice(0, 5).map((alert: AlertItem) => (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: 'var(--color-bg-primary)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <AlertTriangle
                      size={16}
                      style={{ color: severityToVariant(alert.severity) === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {translateAlertTitle(alert.title, expertMode)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {alert.source_host} · {formatTimestamp(alert.created_at, expertMode) || timeAgo(alert.created_at, t)}
                      </div>
                    </div>
                    <Badge variant={severityToVariant(alert.severity)} size="sm">
                      {t(`dashboard.severity.${alert.severity}`)}
                    </Badge>
                    <Badge variant={alert.status === 'new' ? 'danger' : 'default'} size="sm">
                      {t(`dashboard.status.${alert.status}`) || alert.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<AlertTriangle size={32} />} title={t('dashboard.noAlerts')} />
            )
          )}
        </div>
      </Card>

      {/* Hosts summary */}
      {eventStats && eventStats.by_host && Object.keys(eventStats.by_host).length > 0 && (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {t('dashboard.eventsByHost')}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(eventStats.by_host)
              .sort((a, b) => b[1] - a[1])
              .map(([host, count]) => (
                <div key={host} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Cpu size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', minWidth: '180px' }}>
                    {host || '—'}
                  </span>
                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--color-bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(count / eventStats.total) * 100}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-accent)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', minWidth: '80px', textAlign: 'right' }}>
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Services chart */}
      {serviceData.length > 0 && (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              {t('dashboard.eventsByService')}
            </h2>
          </div>
          <EventsChart data={serviceData} loading={statsLoading} />
        </Card>
      )}
    </div>
  )
}