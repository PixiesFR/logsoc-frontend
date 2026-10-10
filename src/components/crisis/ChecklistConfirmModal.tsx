/**
 * ChecklistConfirmModal — confirmation modal for checking CRITIQUE tasks.
 * Ticket #45 — Checklist réflexe (zone centre).
 *
 * Critical tasks require explicit confirmation before being checked,
 * ensuring the defender acknowledges the gravity of the action.
 */
import { Modal, Button } from '../ui'
import { useTranslation } from '../../i18n/useTranslation'
import { AlertTriangle } from 'lucide-react'

interface ChecklistConfirmModalProps {
  open: boolean
  taskText: string
  onConfirm: () => void
  onCancel: () => void
}

export function ChecklistConfirmModal({
  open,
  taskText,
  onConfirm,
  onCancel,
}: ChecklistConfirmModalProps) {
  const { t } = useTranslation()

  const footer = (
    <>
      <Button variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="danger" onClick={onConfirm}>
        {t('warRoom.checklistConfirmAction')}
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={onCancel} title={t('warRoom.checklistConfirmTitle')} footer={footer} size="sm">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-crisis-danger)',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          <AlertTriangle size={18} />
          {t('warRoom.checklistCriticalWarning')}
        </div>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-crisis-text)',
            margin: 0,
            fontWeight: 500,
          }}
        >
          {taskText}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-crisis-border)', margin: 0 }}>
          {t('warRoom.checklistConfirmMessage')}
        </p>
      </div>
    </Modal>
  )
}