import { useTranslation } from '../../i18n/useTranslation'
import type { OnboardingSector } from '../../stores/onboardingStore'

interface Step2SectorProps {
  value: OnboardingSector | null
  onChange: (value: OnboardingSector) => void
}

const sectors: { value: OnboardingSector; key: string }[] = [
  { value: 'energy', key: 'onboarding.sectors.energy' },
  { value: 'finance', key: 'onboarding.sectors.finance' },
  { value: 'health', key: 'onboarding.sectors.health' },
  { value: 'industry', key: 'onboarding.sectors.industry' },
  { value: 'other', key: 'onboarding.sectors.other' },
]

export function Step2Sector({ value, onChange }: Step2SectorProps) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('onboarding.step2Description')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sectors.map((sector) => (
          <button
            key={sector.value}
            type="button"
            onClick={() => onChange(sector.value)}
            style={{
              padding: '16px 20px',
              borderRadius: '10px',
              border: `2px solid ${value === sector.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: value === sector.value ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
              textAlign: 'left',
            }}
          >
            {t(sector.key)}
          </button>
        ))}
      </div>
    </div>
  )
}