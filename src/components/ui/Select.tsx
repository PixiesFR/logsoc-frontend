import { useTranslation } from '../../i18n/useTranslation'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  error?: string
  required?: boolean
  disabled?: boolean
  id?: string
  placeholder?: string
  title?: string
}

export function Select({
  label,
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  id,
  placeholder,
  title,
}: SelectProps) {
  const { t } = useTranslation()
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          htmlFor={selectId}
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
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
          appearance: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder ?? t('common.select')}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>
      )}
    </div>
  )
}