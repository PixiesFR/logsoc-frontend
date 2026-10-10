import { useTranslation } from '../../i18n/useTranslation'

interface InputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
  id?: string
  title?: string
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required = false,
  disabled = false,
  id,
  title,
}: InputProps) {
  const { t } = useTranslation()
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          htmlFor={inputId}
          title={title}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-danger)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
        required={required}
        disabled={disabled}
        style={{
          padding: '8px 12px',
          fontSize: '14px',
          borderRadius: '8px',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>
      )}
    </div>
  )
}