import { useTranslation } from '../../i18n/useTranslation'
import { Select } from '../ui'
import type { OnboardingCountry } from '../../stores/onboardingStore'

interface Step1CountryProps {
  value: OnboardingCountry | null
  onChange: (value: OnboardingCountry) => void
}

export const EU_COUNTRIES: { code: OnboardingCountry; authority: string }[] = [
  { code: 'FR', authority: 'ANSSI / ReCyF' },
  { code: 'DE', authority: 'BSI' },
  { code: 'ES', authority: 'INCIBE-CERT' },
  { code: 'IT', authority: 'ACN' },
  { code: 'NL', authority: 'NCSC-NL' },
  { code: 'BE', authority: 'CCB' },
  { code: 'LU', authority: 'ILR' },
  { code: 'IE', authority: 'NCSC-IE' },
  { code: 'PT', authority: 'CNCS' },
  { code: 'AT', authority: 'BMI' },
  { code: 'SE', authority: 'MSB' },
  { code: 'DK', authority: 'CFCS' },
  { code: 'FI', authority: 'Kyberturvallisuuskeskus' },
  { code: 'PL', authority: 'CSIRT NASK' },
  { code: 'CZ', authority: 'NUKIB' },
  { code: 'SK', authority: 'SK-CERT' },
  { code: 'HU', authority: 'NBSH' },
  { code: 'RO', authority: 'CERT-RO' },
  { code: 'BG', authority: 'CERT-BG' },
  { code: 'HR', authority: 'ZSI' },
  { code: 'SI', authority: 'SI-CERT' },
  { code: 'EE', authority: 'RIA' },
  { code: 'LV', authority: 'CERT-LV' },
  { code: 'LT', authority: 'NKSC' },
  { code: 'GR', authority: 'GR-CERT' },
  { code: 'CY', authority: 'CSIRT-CY' },
  { code: 'MT', authority: 'CSIRT-MT' },
  { code: 'GB', authority: 'NCSC-UK' },
  { code: 'CH', authority: 'NCSC-CH' },
  { code: 'NO', authority: 'NSM' },
  { code: 'IS', authority: 'CERT-IS' },
]

export function Step1Country({ value, onChange }: Step1CountryProps) {
  const { t } = useTranslation()

  const countryOptions = EU_COUNTRIES.map((c) => ({
    label: t(`onboarding.countries.${c.code}`),
    value: c.code,
  }))

  const selectedCountry = EU_COUNTRIES.find((c) => c.code === value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {t('onboarding.step1Description')}
      </p>
      <Select
        value={value ?? ''}
        onChange={(v) => onChange(v as OnboardingCountry)}
        options={countryOptions}
        placeholder={t('onboarding.selectCountry')}
      />
      {selectedCountry && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-primary)',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('onboarding.nis2Authority')}: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{selectedCountry.authority}</span>
          </p>
        </div>
      )}
    </div>
  )
}