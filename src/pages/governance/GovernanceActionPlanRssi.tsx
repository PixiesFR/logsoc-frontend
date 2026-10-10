import { GovernanceActionPlanFiltered } from './GovernanceActionPlanFiltered'
import { useTranslation } from '../../i18n/useTranslation'

export function GovernanceActionPlanRssi() {
  const { t } = useTranslation()
  // RSSI: uniquement les actions pilotées par le RSSI (ANSSI + NIS2 + DORA)
  // RH/Juridique et DPO ont leurs actions dans la Gouvernance Globale
  return (
    <GovernanceActionPlanFiltered
      title={t('nav.govActionPlanRssi')}
      description="Actions de pilotage RSSI — PSSI, registre des risques, audits, actions opérationnelles (ANSSI, NIS2, DORA)"
      fixedPilot="rssi"
    />
  )
}