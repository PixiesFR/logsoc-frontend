import { useTranslation } from '../../i18n/useTranslation'
import { GlossaryTooltip } from '../ui/GlossaryTooltip'
import { Select } from '../ui'
import type {
  OnboardingNis2Answer,
  OnboardingDetailedSector,
  ServiceCriticality,
} from '../../stores/onboardingStore'

interface Step4Nis2Props {
  value: OnboardingNis2Answer | null
  onChange: (value: OnboardingNis2Answer) => void
  detailedSector: OnboardingDetailedSector | null
  onDetailedSectorChange: (value: OnboardingDetailedSector) => void
  serviceCriticality: ServiceCriticality | null
  onServiceCriticalityChange: (value: ServiceCriticality) => void
  employeeCount: string
  onEmployeeCountChange: (value: string) => void
}

const nis2Answers: { value: OnboardingNis2Answer; key: string }[] = [
  { value: 'yes', key: 'onboarding.nis2.yes' },
  { value: 'no', key: 'onboarding.nis2.no' },
  { value: 'unknown', key: 'onboarding.nis2.unknown' },
]

export function Step4Nis2({
  value,
  onChange,
  detailedSector,
  onDetailedSectorChange,
  serviceCriticality,
  onServiceCriticalityChange,
  employeeCount,
  onEmployeeCountChange,
}: Step4Nis2Props) {
  const { t } = useTranslation()

  const detailedSectorOptions = [
    { label: t('onboarding.detailedSectors.energy'), value: 'energy' },
    { label: t('onboarding.detailedSectors.digital_infra'), value: 'digital_infra' },
    { label: t('onboarding.detailedSectors.finance'), value: 'finance' },
    { label: t('onboarding.detailedSectors.health'), value: 'health' },
    { label: t('onboarding.detailedSectors.water'), value: 'water' },
    { label: t('onboarding.detailedSectors.transport'), value: 'transport' },
    { label: t('onboarding.detailedSectors.public_admin'), value: 'public_admin' },
    { label: t('onboarding.detailedSectors.space'), value: 'space' },
    { label: t('onboarding.detailedSectors.postal'), value: 'postal' },
    { label: t('onboarding.detailedSectors.manufacturing'), value: 'manufacturing' },
    { label: t('onboarding.detailedSectors.other'), value: 'other' },
  ]

  const criticalityOptions = [
    { label: t('common.criticalityLabels.low'), value: 'low' },
    { label: t('common.criticalityLabels.medium'), value: 'medium' },
    { label: t('common.criticalityLabels.high'), value: 'high' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('onboarding.step4Description')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {nis2Answers.map((answer) => (
          <button
            key={answer.value}
            type="button"
            onClick={() => onChange(answer.value)}
            style={{
              padding: '16px 20px',
              borderRadius: '10px',
              border: `2px solid ${value === answer.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: value === answer.value ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
              textAlign: 'left',
            }}
          >
            {t(answer.key)}
          </button>
        ))}
      </div>

      {value === 'no' && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
            {t('onboarding.nis2VerificationPrompt')}
          </p>
          <a
            href="https://digital-strategy.ec.europa.eu/en/policies/nis2-directive"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '14px',
              color: 'var(--color-accent)',
              textDecoration: 'underline',
            }}
          >
            {t('onboarding.nis2VerificationLink')}
          </a>
        </div>
      )}

      {value === 'unknown' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            <GlossaryTooltip term="glossary.nis2">{t('onboarding.nis2SubDescription')}</GlossaryTooltip>
          </p>
          <Select
            label={t('onboarding.detailedSector')}
            value={detailedSector ?? ''}
            onChange={(v) => onDetailedSectorChange(v as OnboardingDetailedSector)}
            options={detailedSectorOptions}
            placeholder={t('onboarding.selectDetailedSector')}
          />
          <Select
            label={t('onboarding.serviceCriticality')}
            value={serviceCriticality ?? ''}
            onChange={(v) => onServiceCriticalityChange(v as ServiceCriticality)}
            options={criticalityOptions}
            placeholder={t('onboarding.selectCriticality')}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('onboarding.employeeCount')}
            </label>
            <input
              type="number"
              min="0"
              value={employeeCount}
              onChange={(e) => onEmployeeCountChange(e.target.value)}
              placeholder="0"
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}