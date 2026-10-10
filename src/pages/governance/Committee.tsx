import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Table, Button, Modal, Input, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { Plus, Users } from 'lucide-react'

export function Committee() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formDate, setFormDate] = useState('')
  const [formAgenda, setFormAgenda] = useState('')
  const [formParticipants, setFormParticipants] = useState('')
  const [formReport, setFormReport] = useState('')

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['governance', 'committee'],
    queryFn: () => governanceApi.committee().then((r) => r.data),
  })

  const { data: meetingDetail } = useQuery({
    queryKey: ['governance', 'committee', selectedId],
    queryFn: () => governanceApi.getPolicy(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createCommittee(data),
    onSuccess: () => {
      toast('success', t('governance.committee.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'committee'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.committee.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deleteCommittee(id),
    onSuccess: () => {
      toast('success', t('governance.committee.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'committee'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.committee.deleteError')),
  })

  function resetForm() {
    setFormDate('')
    setFormAgenda('')
    setFormParticipants('')
    setFormReport('')
  }

  const items = (Array.isArray(meetings) ? meetings : (meetings as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const columns = [
    { key: 'date', label: t('common.date'), width: '120px' },
    { key: 'agenda', label: t('governance.committee.agenda') },
    { key: 'participants', label: t('governance.committee.participants'), width: '200px' },
    { key: 'report', label: t('governance.committee.report') },
    { key: 'decisions_count', label: t('governance.committee.decisionsCount'), width: '100px' },
  ]

  const detail = meetingDetail as Record<string, unknown> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.committee.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.committee.createMeeting')}
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.committee.noMeetings')}
        renderCell={(col, row) => {
          if (col.key === 'date') {
            return (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: 0, font: 'inherit', textAlign: 'left' }}
                onClick={() => setSelectedId(Number(row.id))}
              >
                {String(row.date ?? '')}
              </button>
            )
          }
          if (col.key === 'participants') {
            const participants = row.participants
            if (Array.isArray(participants)) {
              return participants.join(', ')
            }
            return String(participants ?? '')
          }
          if (col.key === 'decisions_count') {
            return String(row.decisions_count ?? 0)
          }
          return String(row[col.key] ?? '')
        }}
      />

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.committee.createMeeting')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('common.date')} value={formDate} onChange={setFormDate} type="date" required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.committee.agenda')}</label>
              <textarea
                value={formAgenda}
                onChange={(e) => setFormAgenda(e.target.value)}
                rows={4}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Input label={t('governance.committee.participants')} value={formParticipants} onChange={setFormParticipants} placeholder={t('governance.committee.participantsPlaceholder')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.committee.report')}</label>
              <textarea
                value={formReport}
                onChange={(e) => setFormReport(e.target.value)}
                rows={4}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ date: formDate, agenda: formAgenda, participants: formParticipants, report: formReport })} disabled={!formDate}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={t('governance.committee.meetingDetail')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              <Users size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              {String(detail.date ?? '')}
            </div>
            {(() => { const v = String(detail.agenda ?? ''); return v ? (<div><h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.committee.agenda')}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{v}</p></div>) : null })()}
            {(() => { const v = String(detail.report ?? ''); return v ? (<div><h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.committee.report')}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{v}</p></div>) : null })()}
            {(() => { const v = String(detail.decisions ?? ''); return v ? (<div><h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.committee.decisions')}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{v}</p></div>) : null })()}
            {canEdit('compliance_officer') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="danger" onClick={() => setDeleteId(Number(detail.id))}>{t('common.delete')}</Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={t('governance.committee.deleteConfirmTitle')}
        message={t('governance.committee.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}