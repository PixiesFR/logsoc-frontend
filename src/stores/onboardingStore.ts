import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Country codes (2-letter ISO) — 31 European countries (27 EU + UK + CH + NO + IS)
export type OnboardingCountry =
  | 'FR' | 'DE' | 'ES' | 'IT' | 'NL' | 'BE' | 'LU' | 'IE' | 'PT' | 'AT'
  | 'SE' | 'DK' | 'FI' | 'PL' | 'CZ' | 'SK' | 'HU' | 'RO' | 'BG' | 'HR'
  | 'SI' | 'EE' | 'LV' | 'LT' | 'GR' | 'CY' | 'MT'
  | 'GB' | 'CH' | 'NO' | 'IS'

export type OnboardingSector = 'energy' | 'finance' | 'health' | 'industry' | 'other'
export type OnboardingSize = 'lt50' | '50to250' | '250to1000' | 'gt1000'
export type OnboardingNis2Answer = 'yes' | 'no' | 'unknown'

export type OnboardingDetailedSector =
  | 'energy'
  | 'digital_infra'
  | 'finance'
  | 'health'
  | 'water'
  | 'transport'
  | 'public_admin'
  | 'space'
  | 'postal'
  | 'manufacturing'
  | 'other'

export type ServiceCriticality = 'low' | 'medium' | 'high'

interface OnboardingState {
  completed: boolean
  country: OnboardingCountry | null
  sector: OnboardingSector | null
  size: OnboardingSize | null
  nis2Answer: OnboardingNis2Answer | null
  // NIS2 sub-questionnaire (when "unknown")
  detailedSector: OnboardingDetailedSector | null
  serviceCriticality: ServiceCriticality | null
  employeeCount: string
  setAnswers: (answers: Partial<Omit<OnboardingState, 'setAnswers' | 'reset' | 'setCompleted'>>) => void
  setCompleted: (completed: boolean) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      country: null,
      sector: null,
      size: null,
      nis2Answer: null,
      detailedSector: null,
      serviceCriticality: null,
      employeeCount: '',
      setAnswers: (answers) => set(answers),
      setCompleted: (completed) => set({ completed }),
      reset: () =>
        set({
          completed: false,
          country: null,
          sector: null,
          size: null,
          nis2Answer: null,
          detailedSector: null,
          serviceCriticality: null,
          employeeCount: '',
        }),
    }),
    { name: 'logsoc-onboarding' }
  )
)