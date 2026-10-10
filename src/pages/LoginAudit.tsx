import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { loginAuditApi } from '../api'

export function LoginAuditPage() {
  const { t } = useTranslation()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterIp, setFilterIp] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['login-audit', filterStatus, filterIp, page],
    queryFn: () => loginAuditApi.list({
      status: filterStatus || undefined,
      source_ip: filterIp || undefined,
      offset: String(page * limit),
      limit: String(limit),
    } as Record<string, string | number>).then(r => r.data as {
      total: number; offset: number; limit: number;
      items: Array<{
        id: number; user_id: number | null; username: string; source_ip: string;
        user_agent: string | null; status: string; mfa_used: boolean; timestamp: string | null;
      }>;
    }),
  })

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['login-audit', 'stats'],
    queryFn: () => loginAuditApi.stats().then(r => r.data as {
      total_logins: number; successful_logins: number; failed_attempts: number;
      mfa_used_count: number; unknown_lan_count: number; unique_ips: number;
      top_ips: Array<{ ip: string; count: number }>;
      by_status: Array<{ status: string; count: number }>;
      logins_per_day: Array<{ date: string; count: number }>;
    }),
  })

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'var(--color-success, #10b981)',
      mfa_required: 'var(--color-accent)',
      mfa_setup_required: 'var(--color-warning, #f59e0b)',
      mfa_failed: 'var(--color-danger)',
      invalid_password: 'var(--color-danger)',
      invalid_mfa: 'var(--color-danger)',
      backup_code_used: 'var(--color-accent)',
      account_locked: 'var(--color-danger)',
      unknown_user: 'var(--color-danger)',
      unknown_lan: '#ff6b35',
    }
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: colors[status] || 'var(--color-bg-hover)',
        color: status === 'mfa_setup_required' ? '#000' : '#fff',
      }}>
        {status}
      </span>
    )
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    padding: '20px',
  }

  const statCardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('loginAudit.title')}
      </h1>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            {t('loginAudit.totalLogins')}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {statsLoading ? '...' : (statsData?.total_logins ?? 0)}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: 'var(--color-success)', textTransform: 'uppercase' }}>
            {t('loginAudit.successfulLogins')}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-success)' }}>
            {statsLoading ? '...' : (statsData?.successful_logins ?? 0)}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: 'var(--color-danger)', textTransform: 'uppercase' }}>
            {t('loginAudit.failedAttempts')}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-danger)' }}>
            {statsLoading ? '...' : (statsData?.failed_attempts ?? 0)}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: 'var(--color-accent)', textTransform: 'uppercase' }}>
            MFA
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-accent)' }}>
            {statsLoading ? '...' : (statsData?.mfa_used_count ?? 0)}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: '#ff6b35', textTransform: 'uppercase' }}>
            {t('loginAudit.unknownLan')}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#ff6b35' }}>
            {statsLoading ? '...' : (statsData?.unknown_lan_count ?? 0)}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            {t('loginAudit.uniqueIps')}
          </span>
          <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {statsLoading ? '...' : (statsData?.unique_ips ?? 0)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {t('loginAudit.status')}:
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}
              style={{
                marginLeft: '8px',
                padding: '6px 10px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="success">Success</option>
              <option value="mfa_required">MFA Required</option>
              <option value="mfa_setup_required">MFA Setup Required</option>
              <option value="invalid_password">Invalid Password</option>
              <option value="invalid_mfa">Invalid MFA</option>
              <option value="backup_code_used">Backup Code</option>
              <option value="unknown_lan">Unknown LAN</option>
              <option value="account_locked">Account Locked</option>
              <option value="unknown_user">Unknown User</option>
            </select>
          </label>
          <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            IP:
            <input
              type="text"
              value={filterIp}
              onChange={(e) => { setFilterIp(e.target.value); setPage(0) }}
              placeholder="Filter by IP"
              style={{
                marginLeft: '8px',
                padding: '6px 10px',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                width: '140px',
              }}
            />
          </label>
        </div>
      </div>

      {/* Audit Table */}
      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>#</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t('loginAudit.user')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>IP</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t('loginAudit.status')}</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>MFA</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t('loginAudit.timestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t('common.loading')}</td></tr>
              ) : !auditData?.items?.length ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No data</td></tr>
              ) : auditData.items.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{entry.id}</td>
                  <td style={{ padding: '8px', fontSize: '13px', color: 'var(--color-text-primary)' }}>{entry.username}</td>
                  <td style={{ padding: '8px', fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{entry.source_ip}</td>
                  <td style={{ padding: '8px' }}>{statusBadge(entry.status)}</td>
                  <td style={{ padding: '8px', fontSize: '13px', color: entry.mfa_used ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                    {entry.mfa_used ? '✓' : '—'}
                  </td>
                  <td style={{ padding: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {auditData && auditData.total > limit && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {page * limit + 1}–{Math.min((page + 1) * limit, auditData.total)} / {auditData.total}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: page === 0 ? 'var(--color-bg-primary)' : 'var(--color-accent)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                {t('common.previous')}
              </button>
              <button
                disabled={(page + 1) * limit >= auditData.total}
                onClick={() => setPage(page + 1)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: (page + 1) * limit >= auditData.total ? 'var(--color-bg-primary)' : 'var(--color-accent)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  cursor: (page + 1) * limit >= auditData.total ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}