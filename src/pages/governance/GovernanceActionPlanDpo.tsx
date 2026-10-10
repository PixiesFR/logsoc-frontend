import { GovernanceActionPlanFiltered } from './GovernanceActionPlanFiltered'
import { useTranslation } from '../../i18n/useTranslation'

export function GovernanceActionPlanDpo() {
  const { t } = useTranslation()
  // DPO: uniquement les actions pilotées par le DPO (RGPD)
  return (
    <GovernanceActionPlanFiltered
      title={t('nav.govActionPlanDpo')}
      description="Actions de pilotage DPO — registre des traitements, DPIA, violations de données, politique de protection des données (RGPD)"
      fixedPilot="dpo"
    />
  )
}