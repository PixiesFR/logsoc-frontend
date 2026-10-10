import { GovernanceActionPlanFiltered } from './GovernanceActionPlanFiltered'
import { useTranslation } from '../../i18n/useTranslation'

export function GovernanceActionPlan() {
  const { t } = useTranslation()
  return (
    <GovernanceActionPlanFiltered
      title={t('nav.govActionPlan')}
      description="Actions de pilotage Gouvernance — RSSI, DPO, RH/Juridique. Chaque action agrège les exigences d'un livrable."
    />
  )
}