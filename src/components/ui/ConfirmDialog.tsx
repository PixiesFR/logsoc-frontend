import { useTranslation } from '../../i18n/useTranslation'
import { Modal } from './Modal'
import { Button } from './Button'

type ConfirmVariant = 'danger' | 'primary'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: ConfirmVariant
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  const footer = (
    <>
      <Button variant="secondary" size="md" onClick={onCancel}>
        {cancelLabel ?? t('common.cancel')}
      </Button>
      <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" onClick={onConfirm}>
        {confirmLabel ?? t('common.confirm')}
      </Button>
    </>
  )

  return (
    <Modal open={open} onClose={onCancel} title={title} footer={footer} size="sm">
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {message}
      </p>
    </Modal>
  )
}