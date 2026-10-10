import { useTranslation } from '../../i18n/useTranslation'
import type { OnboardingSize } from '../../stores/onboardingStore'

interface Step3SizeProps {
  value: OnboardingSize | null
  onChange: (value: OnboardingSize) => void
}

const sizes: { value: OnboardingSize; key: string }[] = [
  { value: 'lt50', key: 'onboarding.sizes.lt50' },
  { value: '50to250', key: 'onboarding.sizes.50to250' },
  { value: '250to1000', key: 'onboarding.sizes.250to1000' },
  { value: 'gt1000', key: 'onboarding.sizes.gt1000' },
]

export function Step3Size({ value, onChange }: Step3SizeProps) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('onboarding.step3Description')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {sizes.map((size) => (
          <button
            key={size.value}
            type="button"
            onClick={() => onChange(size.value)}
            style={{
              padding: '20px',
              borderRadius: '10px',
              border: `2px solid ${value === size.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: value === size.value ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
              textAlign: 'center',
            }}
          >
            {t(size.key)}
          </button>
        ))}
      </div>
    </div>
  )
}