import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

const variantStyles: Record<ToastType, { border: string; color: string }> = {
  success: { border: 'var(--color-success)', color: 'var(--color-success)' },
  error: { border: 'var(--color-danger)', color: 'var(--color-danger)' },
  warning: { border: 'var(--color-warning)', color: 'var(--color-warning)' },
  info: { border: 'var(--color-info)', color: 'var(--color-info)' },
}

const toastTitles: Record<ToastType, string> = {
  success: 'common.success',
  error: 'common.error',
  warning: 'common.warning',
  info: 'common.info',
}

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useTranslation()
  const style = variantStyles[item.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])

  return (
    <div
      className="animate-toast"
      style={{
        background: 'var(--color-bg-secondary)',
        border: `1px solid var(--color-border)`,
        borderLeft: `4px solid ${style.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        maxWidth: '400px',
        width: '100%',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: style.color, marginBottom: '2px' }}>
          {t(toastTitles[item.type])}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{item.message}</div>
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  let nextId = 0

  const toast = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => {
      nextId = prev.length > 0 ? Math.max(...prev.map((t) => t.id)) + 1 : 1
      return [...prev, { id: nextId, type, message }]
    })
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {toasts.map((item) => (
          <ToastEntry key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}