import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi, usersApi } from '../../api'
import { Card, StatCard, Button, EmptyState } from '../../components/ui'
import { AcknowledgmentList } from '../../components/governance/AcknowledgmentList'
import type { AcknowledgmentEntry } from '../../components/governance/AcknowledgmentList'
import { usePermissions } from '../../hooks/usePermissions'
import { Users, CheckCircle, XCircle, Send, FileDown } from 'lucide-react'

interface DiffusionTabProps {
  policyId: number
  policyTitle: string
}

export function DiffusionTab({ policyId, policyTitle }: DiffusionTabProps) {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const [exporting, setExporting] = useState(false)

  // Access control: only superadmin, admin, compliance_officer
  const allowed = canView('compliance_officer')

  const { data: policy } = useQuery({
    queryKey: ['governance', 'policy', policyId, 'diffusion'],
    queryFn: () => governanceApi.getPolicy(policyId).then((r: { data: Record<string, unknown> }) => r.data),
    enabled: allowed,
  })

  const { data: acknowledgments } = useQuery({
    queryKey: ['governance', 'policy', policyId, 'acknowledgments'],
    queryFn: () => governanceApi.policyAcknowledgments(policyId).then((r: { data: unknown }) => r.data),
    enabled: allowed,
  })

  const { data: users } = useQuery({
    queryKey: ['users', 'list-for-diffusion-tab'],
    queryFn: () => usersApi.list().then((r: { data: unknown }) => r.data),
    enabled: allowed,
  })

  if (!allowed) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <EmptyState
          icon={<XCircle size={32} />}
          title={t('governance.policies.diffusion.accessDenied')}
        />
      </div>
    )
  }

  const policyData = policy as Record<string, unknown> | null
  const recipients = (Array.isArray(policyData?.recipients) ? policyData!.recipients : []) as number[]
  const ackList = (Array.isArray(acknowledgments) ? acknowledgments : []) as Record<string, unknown>[]
  const userList = (Array.isArray(users) ? users : []) as Record<string, unknown>[]

  // Build user name map
  const userNameMap = new Map<number, string>()
  for (const u of userList) {
    const uid = Number(u.id)
    const name = String(u.display_name || u.username || `User ${uid}`)
    userNameMap.set(uid, name)
  }

  // Build acknowledgment entries
  const ackTimeMap = new Map<number, string | null>()
  for (const a of ackList) {
    const uid = Number(a.user_id)
    const readAt = a.read_at as string | null
    ackTimeMap.set(uid, readAt)
  }

  const entries: AcknowledgmentEntry[] = recipients.map((uid) => ({
    user_id: uid,
    user_name: userNameMap.get(uid) || `User ${uid}`,
    read_at: ackTimeMap.get(uid) ?? null,
  }))

  const totalRecipients = recipients.length
  const readCount = entries.filter((e) => e.read_at !== null).length
  const unreadCount = totalRecipients - readCount
  const reminders = 0 // No backend endpoint for reminders yet

  function handleExportPDF() {
    setExporting(true)
    // Use window.print() with a dedicated printable view
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      setExporting(false)
      return
    }

    const sortedEntries = [...entries].sort((a, b) => {
      const aRead = a.read_at
      const bRead = b.read_at
      if (!aRead && bRead) return -1
      if (aRead && !bRead) return 1
      if (!aRead && !bRead) return 0
      return new Date(String(bRead)).getTime() - new Date(String(aRead)).getTime()
    })

    const rowsHtml = sortedEntries
      .map(
        (e) =>
          `<tr><td style="padding:8px;border:1px solid #ddd">${e.user_name}</td><td style="padding:8px;border:1px solid #ddd">${
            e.read_at ? new Date(e.read_at).toLocaleString() : '<strong style="color:#c0392b">NON LU</strong>'
          }</td></tr>`
      )
      .join('')

    const dateStr = new Date().toLocaleString()

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${t('governance.policies.diffusion.exportTitle')} — ${policyTitle}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
h1 { font-size: 22px; margin-bottom: 8px; }
h2 { font-size: 16px; margin-top: 24px; margin-bottom: 12px; }
.meta { color: #666; font-size: 13px; margin-bottom: 24px; }
.stats { display: flex; gap: 24px; margin-bottom: 24px; }
.stat { background: #f5f5f5; padding: 12px 20px; border-radius: 8px; }
.stat-label { font-size: 12px; color: #666; }
.stat-value { font-size: 20px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th { background: #f0f0f0; padding: 10px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
td { font-size: 13px; }
.footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>
<h1>${t('governance.policies.diffusion.exportTitle')}</h1>
<div class="meta">
${t('governance.policies.diffusion.exportPolicy')}: <strong>${policyTitle}</strong><br/>
${t('governance.policies.diffusion.exportDate')}: ${dateStr}
</div>
<div class="stats">
<div class="stat"><div class="stat-label">${t('governance.policies.diffusion.recipients')}</div><div class="stat-value">${totalRecipients}</div></div>
<div class="stat"><div class="stat-label">${t('governance.policies.diffusion.read')}</div><div class="stat-value">${readCount}</div></div>
<div class="stat"><div class="stat-label">${t('governance.policies.diffusion.unread')}</div><div class="stat-value">${unreadCount}</div></div>
</div>
<h2>${t('governance.policies.diffusion.acknowledgmentList')}</h2>
<table>
<thead><tr><th style="padding:10px;border:1px solid #ddd">${t('governance.policies.diffusion.userName')}</th><th style="padding:10px;border:1px solid #ddd">${t('governance.policies.diffusion.readDate')}</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<div class="footer">LogSOC SIEM — ${t('governance.policies.diffusion.exportFooter')}</div>
</body>
</html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      setExporting(false)
    }, 500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard
          label={t('governance.policies.diffusion.recipients')}
          value={totalRecipients}
          icon={<Users size={18} />}
          color="var(--color-accent)"
        />
        <StatCard
          label={t('governance.policies.diffusion.read')}
          value={readCount}
          icon={<CheckCircle size={18} />}
          color="var(--color-success)"
        />
        <StatCard
          label={t('governance.policies.diffusion.unread')}
          value={unreadCount}
          icon={<XCircle size={18} />}
          color="var(--color-danger)"
        />
        <StatCard
          label={t('governance.policies.diffusion.remindersSent')}
          value={reminders}
          icon={<Send size={18} />}
          color="var(--color-warning)"
        />
      </div>

      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          icon={<FileDown size={16} />}
          onClick={handleExportPDF}
          disabled={exporting || totalRecipients === 0}
        >
          {exporting
            ? t('governance.policies.diffusion.exporting')
            : t('governance.policies.diffusion.exportPdf')}
        </Button>
      </div>

      {/* Acknowledgment list */}
      <Card>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '0 0 12px 0',
          }}
        >
          {t('governance.policies.diffusion.acknowledgmentList')}
        </h3>
        <AcknowledgmentList acknowledgments={entries} />
      </Card>
    </div>
  )
}