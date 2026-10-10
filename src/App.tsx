import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './components/auth/LoginPage'
import { PublicValidate } from './pages/PublicValidate'
import { GovernanceDashboard } from './pages/GovernanceDashboard'
import { EventsPage } from './pages/Events'
import { AlertsPage } from './pages/Alerts'
import { ActionsPage } from './pages/Actions'
import { AgentsPage } from './pages/Agents'
import { YaraRulesPage } from './pages/YaraRules'
import { YaraMatchesPage } from './pages/YaraMatches'
import { RuleSelectionPage } from './pages/RuleSelection'
import { SigmaRulesPage } from './pages/SigmaRules'
import { MitrePage } from './pages/Mitre'
import { CorrelationPage } from './pages/Correlation'
import { ThreatHuntingPage } from './pages/ThreatHunting'

import { CrossMappingPage } from './pages/CrossMapping'
import RequirementsPage from './pages/compliance/Requirements'
import { Practices as PracticesPage } from './pages/compliance/Practices'
import { OpsPractices as OpsPracticesPage } from './pages/compliance/OpsPractices'
import { BusinessQuestionnaires as BusinessQuestionnairesPage } from './pages/compliance/BusinessQuestionnaires'
import { AuditProgram as AuditProgramPage, AuditPending as AuditPendingPage, AuditHistory as AuditHistoryPage } from './pages/audit/AuditPages'
import ComplianceMatrixPage from './pages/compliance/ComplianceMatrix'
import ActionPlanPage from './pages/compliance/ActionPlan'
import ComplianceAlertsPage from './pages/compliance/ComplianceAlerts'
import AutoRulesPage from './pages/compliance/AutoRules'
import { Nis2CountriesPage } from './pages/Nis2Countries'
import { FrameworksPage } from './pages/Frameworks'
import { NotificationsPage } from './pages/Notifications'
import { CrisisPage } from './pages/Crisis'
import { WarRoomPage } from './pages/WarRoom'
import { CrisisNotificationNewPage } from './pages/CrisisNotificationNew'
import { ErrorBoundary } from './components/ui'
import { CartographyPage } from './pages/Cartography'
import { RisquesPage } from './pages/Risques'
import { IncidentsPage } from './pages/Incidents'
import { RunbookPage } from './pages/Runbook'
import { AlertRunbooksPage } from './pages/AlertRunbooks'
import { CompliancePage } from './pages/Compliance'
import { ComplianceInfraPage } from './pages/ComplianceInfra'
import { GdprAuditPage } from './pages/GdprAudit'
import { GdprExtendedPage } from './pages/GdprExtended'
import { Nis2Page } from './pages/Nis2'
import { DoraPage } from './pages/Dora'
import { Iso27001Page } from './pages/Iso27001'
import { AiActPage } from './pages/AiAct'
import { SoarPage } from './pages/Soar'
import { ThreatIntelPage } from './pages/ThreatIntel'
import { ReportingPage } from './pages/Reporting'
import { Policies } from './pages/governance/Policies'
import { GovernanceActionPlan } from './pages/governance/GovernanceActionPlan'
import { GovernanceActionPlanRssi } from './pages/governance/GovernanceActionPlanRssi'
import { RssiDashboard } from './pages/governance/RssiDashboard'
import { Homologations } from './pages/governance/Homologations'
import { HomologationDetail } from './pages/governance/HomologationDetail'
import { GovernanceActionPlanDpo } from './pages/governance/GovernanceActionPlanDpo'
import { DpoDashboard } from './pages/governance/DpoDashboard'
import { DpoProcessingRegistry } from './pages/governance/dpo/DpoProcessingRegistry'
import { DpoBreachRegistry } from './pages/governance/dpo/DpoBreachRegistry'
import { DpoPiaRegistry } from './pages/governance/dpo/DpoPiaRegistry'
import { DpoRightsRequests } from './pages/governance/dpo/DpoRightsRequests'
import { GovernanceDocumentation } from './pages/governance/GovernanceDocumentation'
import { GovernanceWizard } from './pages/governance/GovernanceWizard'
import { WizardCadrage } from './pages/WizardCadrage'
import { ActionPlans } from './pages/operations/ActionPlans'
import { DataClassification } from './pages/governance/DataClassification'
import { Trainings } from './pages/governance/Trainings'
import { Committee } from './pages/governance/Committee'
import { Decisions } from './pages/governance/Decisions'
import { Raci } from './pages/governance/Raci'
import { Vendors } from './pages/governance/Vendors'
import { Calendar } from './pages/governance/Calendar'
import { PolicyApproval } from './pages/governance/PolicyApproval'
import { AssetsPage } from './pages/Assets'
import { CmdbPage } from './pages/Cmdb'
import { InsightsPage } from './pages/Insights'
import { UsersPage } from './pages/Users'
import { AgentPolicyPage } from './pages/AgentPolicy'
import { PolicyAuditPage } from './pages/PolicyAudit'
import { YaraRulesetPage } from './pages/YaraRuleset'
import { IntegrationsPage } from './pages/Integrations'
import { MaintenancePage } from './pages/Maintenance'
import { SettingsPage } from './pages/Settings'
import { LoginAuditPage } from './pages/LoginAudit'
import { DeliverablesAdmin } from './pages/admin/DeliverablesAdmin'
import { BusinessServices } from './pages/admin/BusinessServices'
import { BusinessRolesAdmin } from './pages/admin/BusinessRolesAdmin'
import { RolesPermissionsAdmin } from './pages/admin/RolesPermissionsAdmin'
import { ModulesAdmin } from './pages/admin/ModulesAdmin'
import { CommitteesAdmin } from './pages/admin/CommitteesAdmin'
import { TargetMappings } from './pages/admin/TargetMappings'
import { CrossMappingAuditPage } from './pages/audit/CrossMappingAudit'
import { NotFoundPage } from './pages/NotFound'
import { ToastProvider } from './components/ui'
import { useAuthStore } from './stores'
import { useCrisisStore } from './stores/crisisStore'
import { CrisisThemeProvider } from './components/crisis/CrisisThemeProvider'
import { initI18n } from './i18n'
import type { Lang } from './i18n/types'

// Initialize i18n from persisted state
const persistedLang = localStorage.getItem('logsoc-app')
let initialLang: Lang = 'fr'
if (persistedLang) {
  try {
    const parsed = JSON.parse(persistedLang)
    if (parsed?.state?.lang === 'en' || parsed?.state?.lang === 'fr') {
      initialLang = parsed.state.lang
    }
  } catch {
    // ignore
  }
}
initI18n(initialLang)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AdminRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  if (!isAdmin()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const token = useAuthStore((s) => s.token)

  // Check localStorage consistency: if zustand has a token in memory but
  // localStorage was cleared (user cleared cookies/session), force logout
  useEffect(() => {
    if (token) {
      try {
        const stored = localStorage.getItem('logsoc-auth')
        if (!stored) {
          // localStorage was cleared but zustand still has stale state
          logout()
          return
        }
        const parsed = JSON.parse(stored)
        if (!parsed?.state?.token) {
          logout()
        }
      } catch {
        logout()
      }
    }
  }, [token, logout])

  // Listen for storage events from other tabs to sync logout
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'logsoc-auth' && !e.newValue) {
        // Another tab cleared auth — sync logout
        logout()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [logout])

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function CrisisModeGuard() {
  const crisisActive = useCrisisStore((s) => s.active)
  const crisisIncidentId = useCrisisStore((s) => s.incidentId)
  if (crisisActive && crisisIncidentId !== null) {
    return <Navigate to={`/crisis/${crisisIncidentId}`} replace />
  }
  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/validate" element={<PublicValidate />} />

      {/* War Room — outside AppLayout (no sidebar/header) */}
      <Route
        path="/crisis/:incidentId"
        element={
          <ProtectedRoute>
            <CrisisThemeProvider>
              <ErrorBoundary fallbackLabel="War Room error">
                <WarRoomPage />
              </ErrorBoundary>
            </CrisisThemeProvider>
          </ProtectedRoute>
        }
      />

      {/* Crisis notification editor — outside AppLayout (War Room context) */}
      <Route
        path="/crisis/:incidentId/notifications/new"
        element={
          <ProtectedRoute>
            <CrisisThemeProvider>
              <ErrorBoundary fallbackLabel="Notification editor error">
                <CrisisNotificationNewPage />
              </ErrorBoundary>
            </CrisisThemeProvider>
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <CrisisModeGuard />
            <CrisisThemeProvider>
              <AppLayout />
            </CrisisThemeProvider>
          </ProtectedRoute>
        }
      >
        {/* Dashboard = landing page (role-based: governance or SOC) */}
        <Route path="/" element={<GovernanceDashboard />} />
        <Route path="/dashboard" element={<GovernanceDashboard />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/yara" element={<YaraRulesPage />} />
        <Route path="/yara-matches" element={<YaraMatchesPage />} />
        <Route path="/ops/rule-selection" element={<RuleSelectionPage />} />
        <Route path="/yara-detections" element={<Navigate to="/yara-matches" replace />} />
        <Route path="/yara/matches" element={<Navigate to="/yara-matches" replace />} />
        <Route path="/yara-rules" element={<Navigate to="/yara" replace />} />
        <Route path="/sigma" element={<SigmaRulesPage />} />
        <Route path="/mitre" element={<MitrePage />} />
        <Route path="/correlation" element={<CorrelationPage />} />
        <Route path="/threat-hunting" element={<ThreatHuntingPage />} />

        <Route path="/agents" element={<AgentsPage />} />

        {/* Compliance */}
        <Route path="/cartography" element={<CartographyPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/compliance-infra" element={<ComplianceInfraPage />} />
        <Route path="/gdpr-audit" element={<GdprAuditPage />} />
        <Route path="/gdpr-extended" element={<GdprExtendedPage />} />
        <Route path="/nis2" element={<Nis2Page />} />
        <Route path="/compliance/nis2" element={<Navigate to="/nis2" replace />} />
        <Route path="/dora" element={<DoraPage />} />
        <Route path="/iso27001" element={<Iso27001Page />} />
        <Route path="/ai-act" element={<AiActPage />} />
        <Route path="/soar" element={<SoarPage />} />
        <Route path="/threat-intel" element={<ThreatIntelPage />} />
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/cross-mapping" element={<CrossMappingPage />} />
        <Route path="/audit/cross-mapping" element={<CrossMappingAuditPage />} />
        <Route path="/requirements" element={<RequirementsPage />} />
        <Route path="/practices" element={<PracticesPage />} />
        <Route path="/ops/practices" element={<OpsPracticesPage />} />
        <Route path="/business-questionnaires" element={<BusinessQuestionnairesPage />} />
        <Route path="/audit/program" element={<AuditProgramPage />} />
        <Route path="/audit/pending" element={<AuditPendingPage />} />
        <Route path="/audit/history" element={<AuditHistoryPage />} />
        <Route path="/compliance/matrix" element={<ComplianceMatrixPage />} />
        <Route path="/compliance/action-plan" element={<ActionPlanPage />} />
        <Route path="/compliance/alerts" element={<ComplianceAlertsPage />} />
        <Route path="/compliance/auto-rules" element={<AutoRulesPage />} />
        <Route path="/nis2-countries" element={<Nis2CountriesPage />} />
        <Route path="/frameworks" element={<FrameworksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/crisis" element={<CrisisPage />} />
        <Route path="/crisis/playbooks" element={<CrisisPage initialTab="playbooks" />} />

        {/* Risques */}
        <Route path="/risques" element={<RisquesPage />} />
        <Route path="/risks" element={<Navigate to="/risques" replace />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/runbook" element={<RunbookPage />} />
        <Route path="/alert-runbooks" element={<AlertRunbooksPage />} />

        {/* Governance */}
        <Route path="/governance/policies" element={<Policies />} />
        <Route path="/governance/action-plan" element={<GovernanceActionPlan />} />
        <Route path="/governance/action-plan-rssi" element={<GovernanceActionPlanRssi />} />
        <Route path="/governance/rssi-dashboard" element={<RssiDashboard />} />
        <Route path="/governance/homologations" element={<Homologations />} />
        <Route path="/governance/homologations/:id" element={<HomologationDetail />} />
        <Route path="/governance/dpo-dashboard" element={<DpoDashboard />} />
        <Route path="/dpo/processing" element={<DpoProcessingRegistry />} />
        <Route path="/dpo/breaches" element={<DpoBreachRegistry />} />
        <Route path="/dpo/pia" element={<DpoPiaRegistry />} />
        <Route path="/dpo/rights" element={<DpoRightsRequests />} />
        <Route path="/governance/action-plan-dpo" element={<GovernanceActionPlanDpo />} />
        <Route path="/governance/documentation" element={<GovernanceDocumentation />} />
        <Route path="/governance/wizard" element={<GovernanceWizard />} />
        <Route path="/wizard" element={<WizardCadrage />} />
        <Route path="/governance/policies/:id/approval" element={<PolicyApproval />} />
        <Route path="/operations/action-plans" element={<ActionPlans />} />
        <Route path="/governance/data-classification" element={<DataClassification />} />
        <Route path="/governance/trainings" element={<Trainings />} />
        <Route path="/governance/committee" element={<Committee />} />
        <Route path="/governance/decisions" element={<Decisions />} />
        <Route path="/governance/raci" element={<Raci />} />
        <Route path="/governance/vendors" element={<Vendors />} />
        <Route path="/governance/calendar" element={<Calendar />} />

        {/* Operations */}

        {/* Admin */}
        <Route path="/inventory" element={<AssetsPage />} />
        <Route path="/assets" element={<Navigate to="/inventory" replace />} />
        <Route path="/assets/" element={<Navigate to="/inventory" replace />} />
        <Route path="/insights" element={<InsightsPage />} />

        {/* Admin-only routes */}
        <Route
          path="/cmdb"
          element={<AdminRoute><CmdbPage /></AdminRoute>}
        />
        <Route
          path="/users"
          element={<AdminRoute><UsersPage /></AdminRoute>}
        />
        <Route
          path="/agent-policy"
          element={<AdminRoute><AgentPolicyPage /></AdminRoute>}
        />
        <Route
          path="/policy-audit"
          element={<AdminRoute><PolicyAuditPage /></AdminRoute>}
        />
        <Route
          path="/yara-ruleset"
          element={<AdminRoute><YaraRulesetPage /></AdminRoute>}
        />
        <Route
          path="/integrations"
          element={<AdminRoute><IntegrationsPage /></AdminRoute>}
        />
        <Route
          path="/maintenance"
          element={<AdminRoute><MaintenancePage /></AdminRoute>}
        />
        <Route
          path="/settings"
          element={<AdminRoute><SettingsPage /></AdminRoute>}
        />
        <Route
          path="/login-audit"
          element={<AdminRoute><LoginAuditPage /></AdminRoute>}
        />
        <Route
          path="/admin/deliverables"
          element={<AdminRoute><DeliverablesAdmin /></AdminRoute>}
        />
        <Route
          path="/admin/services"
          element={<AdminRoute><BusinessServices /></AdminRoute>}
        />
        <Route
          path="/admin/business-roles"
          element={<AdminRoute><BusinessRolesAdmin /></AdminRoute>}
        />
        <Route
          path="/admin/roles-permissions"
          element={<AdminRoute><RolesPermissionsAdmin /></AdminRoute>}
        />
        <Route
          path="/admin/modules"
          element={<AdminRoute><ModulesAdmin /></AdminRoute>}
        />
        <Route
          path="/admin/committees"
          element={<AdminRoute><CommitteesAdmin /></AdminRoute>}
        />
        <Route
          path="/admin/target-mappings"
          element={<AdminRoute><TargetMappings /></AdminRoute>}
        />
      </Route>

      {/* Redirect section shortcuts to first page */}
      <Route path="/administration" element={<Navigate to="/inventory" replace />} />
      <Route path="/gouvernance" element={<Navigate to="/governance/policies" replace />} />
      <Route path="/governance" element={<Navigate to="/governance/policies" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}