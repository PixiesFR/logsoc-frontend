import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui/Toast'
import { Button } from '../ui'
import { onboardingApi } from '../../api'
import { useAuthStore } from '../../stores'
import {
  useOnboardingStore,
  type OnboardingCountry,
  type OnboardingSector,
  type OnboardingSize,
  type OnboardingNis2Answer,
  type OnboardingDetailedSector,
  type ServiceCriticality,
} from '../../stores/onboardingStore'
import { Step1Country } from './Step1Country'
import { Step2Sector } from './Step2Sector'
import { Step3Size } from './Step3Size'
import { Step4Nis2 } from './Step4Nis2'

interface OnboardingWizardProps {
  onClose: () => void
}

const TOTAL_STEPS = 4

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isAdmin = useAuthStore((s) => s.isAdmin)()

  const {
    country,
    sector,
    size,
    nis2Answer,
    detailedSector,
    serviceCriticality,
    employeeCount,
    setAnswers,
    setCompleted,
  } = useOnboardingStore()

  const [step, setStep] = useState(0)

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        country,
        sector,
        company_size: size,
        nis2_answer: nis2Answer,
      }
      if (nis2Answer === 'unknown') {
        payload.detailed_sector = detailedSector
        payload.service_criticality = serviceCriticality
        payload.employee_count = employeeCount ? parseInt(employeeCount, 10) : 0
      }
      return onboardingApi.submit(payload)
    },
    onSuccess: () => {
      setCompleted(true)
      toast('success', t('onboarding.successMessage', { country: country ?? '', sector: sector ?? '' }))
      onClose()
      navigate('/')
    },
    onError: () => {
      toast('error', t('onboarding.errorMessage'))
    },
  })

  const isStepValid = (): boolean => {
    switch (step) {
      case 0:
        return country !== null
      case 1:
        return sector !== null
      case 2:
        return size !== null
      case 3: {
        if (nis2Answer === null) return false
        if (nis2Answer === 'unknown') {
          return detailedSector !== null && serviceCriticality !== null && employeeCount !== ''
        }
        return true
      }
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
    } else {
      submitMutation.mutate()
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const stepTitles = [
    t('onboarding.step1Title'),
    t('onboarding.step2Title'),
    t('onboarding.step3Title'),
    t('onboarding.step4Title'),
  ]

  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboarding.title')}
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '0 0 8px 0',
            }}
          >
            {t('onboarding.title')}
          </h2>
          {!isAdmin && (
            <p style={{ fontSize: '13px', color: 'var(--color-warning)', margin: 0 }}>
              {t('onboarding.adminOnlyNote')}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            {stepTitles.map((title, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: i === step ? 600 : 400,
                  color: i <= step ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                {i < step ? (
                  <Check size={14} />
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: `1px solid ${i <= step ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      fontSize: '11px',
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                <span style={{ display: i === step ? 'inline' : 'none' }}>{title}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              borderRadius: '2px',
              background: 'var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--color-accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Step content */}
        <div style={{ minHeight: '200px', marginBottom: '24px' }}>
          {step === 0 && (
            <Step1Country
              value={country}
              onChange={(v: OnboardingCountry) => setAnswers({ country: v })}
            />
          )}
          {step === 1 && (
            <Step2Sector
              value={sector}
              onChange={(v: OnboardingSector) => setAnswers({ sector: v })}
            />
          )}
          {step === 2 && (
            <Step3Size
              value={size}
              onChange={(v: OnboardingSize) => setAnswers({ size: v })}
            />
          )}
          {step === 3 && (
            <Step4Nis2
              value={nis2Answer}
              onChange={(v: OnboardingNis2Answer) => setAnswers({ nis2Answer: v })}
              detailedSector={detailedSector}
              onDetailedSectorChange={(v: OnboardingDetailedSector) => setAnswers({ detailedSector: v })}
              serviceCriticality={serviceCriticality}
              onServiceCriticalityChange={(v: ServiceCriticality) => setAnswers({ serviceCriticality: v })}
              employeeCount={employeeCount}
              onEmployeeCountChange={(v: string) => setAnswers({ employeeCount: v })}
            />
          )}
        </div>

        {/* Footer / navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={handleBack} disabled={step === 0} icon={<ChevronLeft size={16} />}>
              {t('common.back')}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isStepValid() || submitMutation.isPending}
              icon={
                submitMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : step === TOTAL_STEPS - 1 ? (
                  <Check size={16} />
                ) : (
                  <ChevronRight size={16} />
                )
              }
            >
              {step === TOTAL_STEPS - 1
                ? t('onboarding.configure')
                : t('common.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}