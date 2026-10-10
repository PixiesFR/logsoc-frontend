import axios from 'axios'
import { useAuthStore } from '../stores'

export const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: inject JWT token
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: refresh token on 401, toast on 403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const { refreshToken, setAuth, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken })
          setAuth(data.access_token, data.refresh_token, useAuthStore.getState().user)
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
          return api(originalRequest)
        } catch {
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/api/v1/auth/login', { username, password }),
  refresh: (refreshToken: string) =>
    api.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),
  logout: () => api.post('/api/v1/auth/logout'),
}

export const mfaApi = {
  setup: (password: string) => api.post('/api/v1/auth/mfa/setup', { password }),
  verify: (code: string) => api.post('/api/v1/auth/mfa/verify', { code }),
  verifySetup: (code: string) => api.post('/api/v1/auth/mfa/verify-setup', { code }),
  disable: (password: string) => api.post('/api/v1/auth/mfa/disable', { password }),
  status: () => api.get('/api/v1/auth/mfa/status'),
  regenerate: (code: string) => api.post('/api/v1/auth/mfa/regenerate', { code }),
  backupCodes: (userId?: number) =>
    api.post('/api/v1/auth/mfa/backup-codes', userId ? { user_id: userId } : {}),
  login: (tempToken: string, code: string) =>
    api.post('/api/v1/auth/mfa/login', { temp_token: tempToken, code }),
  forceSetup: (tempToken: string) =>
    api.post('/api/v1/auth/mfa/force-setup', {}, { headers: { Authorization: `Bearer ${tempToken}` } }),
  forceVerifySetup: (tempToken: string, code: string) =>
    api.post('/api/v1/auth/mfa/force-verify-setup', { temp_token: tempToken, code }),
}

// ── MFA Policy (admin) ──
export const mfaPolicyApi = {
  get: () => api.get('/api/v1/auth/admin/mfa/policy'),
  update: (data: { required?: boolean; enforce_for_roles?: string[] }) =>
    api.put('/api/v1/auth/admin/mfa/policy', data),
  enforceUser: (userId: number) => api.put(`/api/v1/auth/admin/mfa/enforce/${userId}`),
  unenforceUser: (userId: number) => api.delete(`/api/v1/auth/admin/mfa/enforce/${userId}`),
  resetUser: (userId: number) => api.post(`/api/v1/auth/admin/mfa/reset/${userId}`),
}

// ── Login Audit (admin) ──
export const loginAuditApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/api/v1/auth/admin/login-audit', { params }),
  stats: () => api.get('/api/v1/auth/admin/login-audit/stats'),
}

export const ssoApi = {
  getProviders: () => api.get('/api/v1/auth/sso/providers'),
}

// ── Users ──
export const usersApi = {
  getMe: () => api.get('/api/v1/users/me'),
  list: () => api.get('/api/v1/users/'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/users/', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/users/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/users/${id}`),
  getRoles: () => api.get('/api/v1/users/roles'),
  changeRole: (id: number, role: string) => api.put(`/api/v1/users/${id}/role`, { role }),
  getRoleModules: (role: string) => api.get(`/api/v1/users/roles/${role}/modules`),
  updateRoleModule: (role: string, module: string, data: Record<string, unknown>) =>
    api.put(`/api/v1/users/roles/${role}/modules/${module}`, data),
  getModulesStatus: () => api.get('/api/v1/users/modules/status'),
  setModuleActive: (module: string, isActive: boolean) =>
    api.put(`/api/v1/users/modules/${module}/active`, { is_active: isActive }),
  getMyPermissions: () => api.get('/api/v1/users/me/permissions'),
}

// ── Casquettes métier (business_roles_ref, liste fermée administrable) ──
export const businessRolesApi = {
  list: (activeOnly = false) => api.get('/api/v1/business-roles', { params: activeOnly ? { active_only: true } : {} }),
  create: (data: Record<string, unknown>) => api.post('/api/v1/business-roles', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/business-roles/${id}`, data),
  deactivate: (id: number) => api.delete(`/api/v1/business-roles/${id}`),
}

// ── Events ──
export const eventsApi = {
  list: (params?: Record<string, string | number>) => api.get('/api/v1/events/', { params }),
  get: (id: number) => api.get(`/api/v1/events/${id}`),
  stats: () => api.get('/api/v1/events/stats/summary'),
}

// ── Alerts ──
export const alertsApi = {
  list: (params?: Record<string, string | number>) => api.get('/api/v1/alerts/', { params }),
  get: (id: number) => api.get(`/api/v1/alerts/${id}`),
  summary: () => api.get('/api/v1/alerts/summary'),
  slaConfig: () => api.get('/api/v1/alerts/sla-config'),
  slaBreached: () => api.get('/api/v1/alerts/sla-breached'),
  assign: (id: number, userId: number) => api.post(`/api/v1/alerts/${id}/assign`, { user_id: userId }),
  acknowledge: (id: number) => api.post(`/api/v1/alerts/${id}/acknowledge`),
  close: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/alerts/${id}/close`, data),
  escalate: (id: number) => api.post(`/api/v1/alerts/${id}/escalate`),
  linkCase: (id: number, caseId: number) => api.post(`/api/v1/alerts/${id}/link-case`, { case_id: caseId }),
  updateSlaConfig: (data: Record<string, unknown>) => api.put('/api/v1/alerts/sla-config', data),
}

// ── Assets ──
export const assetsApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/assets/', { params }),
  get: (id: number) => api.get(`/api/v1/assets/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/assets/', data),
  stats: () => api.get('/api/v1/assets/stats/summary'),
  compliance: (id: number) => api.get(`/api/v1/assets/${id}/compliance`),
  heartbeats: (id: number) => api.get(`/api/v1/assets/${id}/heartbeats`),
  groups: () => api.get('/api/v1/assets/groups'),
  createGroup: (data: Record<string, unknown>) => api.post('/api/v1/assets/groups', data),
  updateGroup: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/assets/groups/${id}`, data),
  deleteGroup: (id: number) => api.delete(`/api/v1/assets/groups/${id}`),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/assets/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/assets/${id}`),
  complianceSuggestions: () => api.get('/api/v1/assets/compliance/suggestions'),
  // Network scan
  startScan: (ipRange: string) => api.post('/api/v1/assets/scan', { ip_range: ipRange }),
  getScanStatus: (jobId: string) => api.get(`/api/v1/assets/scan/${jobId}/status`),
  importScanResults: (jobId: string, hosts: Record<string, unknown>[]) => api.post(`/api/v1/assets/scan/${jobId}/import`, { hosts }),
  getNetworkInfo: () => api.get('/api/v1/assets/scan/network-info'),
  getNmapPath: () => api.get('/api/v1/assets/settings/nmap-path'),
  updateNmapPath: (path: string) => api.put('/api/v1/assets/settings/nmap-path', { nmap_path: path }),
  tags: () => api.get('/api/v1/assets/tags'),
}

// ── Agents ──
export const agentsApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/agents/', { params }),
  get: (id: string) => api.get(`/api/v1/agents/${id}`),
  approve: (id: string) => api.put(`/api/v1/agents/${id}/approve`),
  reject: (id: string) => api.put(`/api/v1/agents/${id}/reject`),
  revoke: (id: string) => api.put(`/api/v1/agents/${id}/revoke`),
  reactivate: (id: string) => api.put(`/api/v1/agents/${id}/reactivate`),
  delete: (id: string) => api.delete(`/api/v1/agents/${id}`),
  permanentDelete: (id: string) => api.delete(`/api/v1/agents/${id}/permanent`),
  heartbeats: (id: string, limit?: number) => api.get(`/api/v1/agents/${id}/heartbeats`, { params: limit ? { limit } : {} }),
  walKeyStatus: (id: string) => api.get(`/api/v1/agents/${id}/wal-key-status`),
  hotReload: (id: string, config: Record<string, unknown>) => api.post(`/api/v1/agents/${id}/hot-reload`, config),
  getConfig: (id: string) => api.get(`/api/v1/agents/${id}/config`),
  putConfig: (id: string, config: Record<string, unknown>) => api.put(`/api/v1/agents/${id}/config`, config),
}

// ── Actions ──
export const actionsApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/actions/', { params }),
  get: (id: number) => api.get(`/api/v1/actions/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/actions/', data),
  approve: (id: number) => api.post(`/api/v1/actions/${id}/approve`),
  cancel: (id: number) => api.post(`/api/v1/actions/${id}/cancel`),
  byAgent: (agentId: string) => api.get(`/api/v1/actions/agent/${agentId}`),
}

// ── YARA ──
export const yaraApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/yara/rules', { params }),
  get: (ruleId: string) => api.get(`/api/v1/yara/rules/${ruleId}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/yara/rules', data),
  update: (ruleId: string, data: Record<string, unknown>) => api.put(`/api/v1/yara/rules/${ruleId}`, data),
  delete: (ruleId: string) => api.delete(`/api/v1/yara/rules/${ruleId}`),
  toggle: (ruleId: string) => api.post(`/api/v1/yara/rules/${ruleId}/toggle`),
  test: (ruleId: string, sampleText: string) =>
    api.post(`/api/v1/yara/rules/${ruleId}/test?sample_text=${encodeURIComponent(sampleText)}`),
  listResults: (params?: Record<string, string>) => api.get('/api/v1/yara/results', { params }),
  getAgentStats: (agentId: string) => api.get(`/api/v1/yara/agent-stats/${agentId}`),
  reload: () => api.post('/api/v1/yara/reload'),
  getRuleset: () => api.get('/api/v1/yara/ruleset'),
  updateRuleset: (data: Record<string, unknown>) => api.put('/api/v1/yara/ruleset', data),
  aiSuggest: (data?: { target_host?: string; context?: string }) => api.post('/api/v1/yara/ai-suggest', data ?? {}),
  importSigbase: (data: Record<string, unknown>) => api.post('/api/v1/yara/import-sigbase?async_mode=true', data),
  getImportStatus: (jobId: string) => api.get(`/api/v1/yara/import-sigbase/${jobId}/status`),
}

// ── Sigma ──
export const sigmaApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/sigma/', { params }),
  get: (uuid: string) => api.get(`/api/v1/sigma/${uuid}`),
  stats: () => api.get('/api/v1/sigma/stats'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/sigma/', data),
  evaluate: (uuid: string) => api.post(`/api/v1/sigma/${uuid}/evaluate`),
  importSigma: (data: Record<string, unknown>) => api.post('/api/v1/sigma/import', data, { params: { async_mode: 'true' } }),
  getImportStatus: (jobId: string) => api.get(`/api/v1/sigma/import/${jobId}/status`),
}

// ── MITRE ──
export const mitreApi = {
  coverage: () => api.get('/api/v1/correlation/mitre/coverage'),
  navigator: () => api.get('/api/v1/correlation/mitre/navigator'),
  alerts: (params?: Record<string, string>) => api.get('/api/v1/correlation/mitre/alerts', { params }),
}

// ── Correlation ──
export const correlationApi = {
  stats: () => api.get('/api/v1/correlation/stats'),
  rules: () => api.get('/api/v1/correlation/rules'),
  config: () => api.get('/api/v1/correlation/config'),
  alerts: (params?: Record<string, string>) => api.get('/api/v1/correlation/alerts', { params }),
  ebpfEnriched: (params?: Record<string, string>) => api.get('/api/v1/correlation/ebpf-enriched', { params }),
  listCustomRules: () => api.get('/api/v1/correlation/rules/custom'),
  createCustomRule: (data: Record<string, unknown>) => api.post('/api/v1/correlation/rules/custom', data),
  updateCustomRule: (id: string, data: Record<string, unknown>) => api.put(`/api/v1/correlation/rules/custom/${id}`, data),
  deleteCustomRule: (id: string) => api.delete(`/api/v1/correlation/rules/custom/${id}`),
  listSuppressions: () => api.get('/api/v1/correlation/suppressions'),
  createSuppression: (data: Record<string, unknown>) => api.post('/api/v1/correlation/suppressions', data),
  deleteSuppression: (id: string) => api.delete(`/api/v1/correlation/suppressions/${id}`),
  mitreRules: () => api.get('/api/v1/correlation/mitre/rules'),
}

// ── Hunting ──
export const huntingApi = {
  saved: () => api.get('/api/v1/hunting/saved'),
  getSaved: (id: number) => api.get(`/api/v1/hunting/saved/${id}`),
  createSaved: (data: Record<string, unknown>) => api.post('/api/v1/hunting/saved', data),
  deleteSaved: (id: number) => api.delete(`/api/v1/hunting/saved/${id}`),
  run: (data: Record<string, unknown>) => api.post('/api/v1/hunting/run', data),
  results: (huntId: number) => api.get(`/api/v1/hunting/results/${huntId}`),
}

// ── Cases ──
export const casesApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/cases/', { params }),
  get: (id: number) => api.get(`/api/v1/cases/${id}`),
  stats: () => api.get('/api/v1/cases/stats'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/cases/', data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/api/v1/cases/${id}`, data),
  changeStatus: (id: number, newStatus: string) => api.post(`/api/v1/cases/${id}/status`, { new_status: newStatus }),
  addComment: (id: number, note: string) => api.post(`/api/v1/cases/${id}/comments`, { note }),
  getTimeline: (id: number) => api.get(`/api/v1/cases/${id}/timeline`),
  close: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/cases/${id}/close`, data),
  addIocs: (caseId: number, iocs: unknown[]) => api.post(`/api/v1/cases/${caseId}/iocs`, { iocs }),
  addTtps: (caseId: number, ttps: unknown[]) => api.post(`/api/v1/cases/${caseId}/ttps`, { ttps }),
  addTimelineEvent: (caseId: number, event: Record<string, unknown>) => api.post(`/api/v1/cases/${caseId}/timeline`, event),
}

// ── Risks ──
export const risksApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/risks/', { params }),
  get: (id: number) => api.get(`/api/v1/risks/${id}`),
  stats: () => api.get('/api/v1/risks/stats'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/risks/', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/risks/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/risks/${id}`),
  aiSuggestions: (riskId: number) => api.get(`/api/v1/risks/${riskId}/ai-suggestions`),
  aiSuggestLlm: (riskId: number, data: Record<string, unknown>) => api.post(`/api/v1/risks/${riskId}/ai-suggest-llm`, data),
  applySuggestion: (riskId: number, suggestionId: number) => api.post(`/api/v1/risks/${riskId}/ai-suggestions/${suggestionId}/apply`),
}

// ── AI Assist (generic LLM helper via admin endpoint) ──
export const aiAssistApi = {
  status: () => api.get('/api/v1/admin/llm/status'),
  models: () => api.get('/api/v1/admin/llm/models'),
  modelInfo: (modelName: string) => api.get(`/api/v1/admin/llm/models/${encodeURIComponent(modelName)}/info`),
  getThinking: () => api.get('/api/v1/admin/llm/thinking'),
  setThinking: (data: Record<string, unknown>) => api.put('/api/v1/admin/llm/thinking', data),
}

// ── Settings — SMTP configuration ──
export const settingsSmtpApi = {
  get: () => api.get('/api/v1/settings/smtp'),
  update: (data: Record<string, unknown>) => api.put('/api/v1/settings/smtp', data),
  test: (data: Record<string, unknown>) => api.post('/api/v1/settings/smtp/test', data),
}

// ── Settings — Référentiel (seed) configuration ──
export const settingsSeedApi = {
  get: () => api.get('/api/v1/settings/seed'),
  update: (data: Record<string, unknown>) => api.put('/api/v1/settings/seed', data),
  check: () => api.post('/api/v1/settings/seed/check'),
  apply: () => api.post('/api/v1/settings/seed/apply'),
}

// ── Security practices ──
export const practicesApi = {
  list: () => api.get('/api/v1/grc/practices'),
  get: (id: number) => api.get(`/api/v1/grc/practices/${id}`),
  // Déclarations terrain pratique×asset (13/09, vue Opérations)
  assets: (practiceId: number) => api.get(`/api/v1/grc/practices/${practiceId}/assets`),
  declareAsset: (practiceId: number, assetId: number, status: string) =>
    api.put(`/api/v1/grc/practices/${practiceId}/assets/${assetId}`, { status }),
  // Questionnaires Directions Métiers (13/09)
  questionnaires: {
    list: (qtype?: string) => api.get('/api/v1/business-questionnaires/questionnaires', { params: qtype ? { qtype } : {} }),
    create: (data: { service_id: number; qtype: string }) =>
      api.post('/api/v1/business-questionnaires/questionnaires', data),
    get: (id: number) => api.get(`/api/v1/business-questionnaires/questionnaires/${id}`),
    send: (id: number) => api.post(`/api/v1/business-questionnaires/questionnaires/${id}/send`),
    submit: (id: number, answers: Record<number, string>) =>
      api.put(`/api/v1/business-questionnaires/questionnaires/${id}/answers`, { answers }),
    validate: (id: number) => api.post(`/api/v1/business-questionnaires/questionnaires/${id}/validate`),
  },
  createAudit: (practiceId: number, data: { auditor_user_id: number; audit_date?: string }) =>
    api.post(`/api/v1/grc/practices/${practiceId}/audits`, data),
  prepareAudit: (practiceId: number, data: { auditor_user_id: number; selected_requirement_ids?: number[] }) =>
    api.post(`/api/v1/grc/practices/${practiceId}/prepare-audit`, data),
  getAudit: (auditId: number) => api.get(`/api/v1/grc/practice-audits/${auditId}`),
  updateAudit: (auditId: number, data: Record<string, unknown>) =>
    api.put(`/api/v1/grc/practice-audits/${auditId}`, data),
  generateActions: (auditId: number) =>
    api.post(`/api/v1/grc/practice-audits/${auditId}/generate-actions`),
  program: () => api.get('/api/v1/grc/audit-program'),
  pending: () => api.get('/api/v1/grc/audit-pending'),
  history: () => api.get('/api/v1/grc/audit-history'),
  // ── Rapport signé (10/09) ──
  generateReport: (auditId: number) =>
    api.post(`/api/v1/grc/practice-audits/${auditId}/generate-report`),
  signReport: (auditId: number) =>
    api.post(`/api/v1/grc/practice-audits/${auditId}/sign`, {}),
  notifyDirection: (auditId: number) =>
    api.post(`/api/v1/grc/practice-audits/${auditId}/notify-direction`),
  reportUrl: (auditId: number, signed = true) =>
    `/api/v1/grc/practice-audits/${auditId}/report-file?signed=${signed}`,
  previousActions: (practiceId: number, excludeAuditId?: number) =>
    api.get(`/api/v1/grc/practices/${practiceId}/previous-actions`, { params: excludeAuditId ? { exclude_audit_id: excludeAuditId } : undefined }),
}

// ── Settings — LLM (Ollama) configuration ──
export const settingsLlmApi = {
  get: () => api.get('/api/v1/settings/llm'),
  update: (data: { url: string; model: string; api_key: string; timeout: number; temperature: number; context_length: number; thinking?: boolean; thinking_level?: string }) =>
    api.put('/api/v1/settings/llm', data),
  test: (data: { url: string; api_key: string }) =>
    api.post('/api/v1/settings/llm/test', data),
}

// ── Settings — IA Prompts configuration ──
export const iaPromptsApi = {
  list: () => api.get('/api/v1/settings/ia-prompts'),
  get: (key: string) => api.get(`/api/v1/settings/ia-prompts/${key}`),
  update: (key: string, data: { prompt_text: string }) =>
    api.put(`/api/v1/settings/ia-prompts/${key}`, data),
  create: (data: { prompt_key: string; label: string; description?: string; prompt_text: string; variables?: unknown[] }) =>
    api.post('/api/v1/settings/ia-prompts', data),
  reset: (key: string) => api.post(`/api/v1/settings/ia-prompts/${key}/reset`),
  delete: (key: string) => api.delete(`/api/v1/settings/ia-prompts/${key}`),
}

// ── Runbook (compliance infra procedures) ──
export const runbookApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/runbook/', { params }),
  get: (id: number) => api.get(`/api/v1/runbook/${id}`),
  stats: () => api.get('/api/v1/runbook/stats'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/runbook/', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/runbook/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/runbook/${id}`),
  reviews: (id: number) => api.get(`/api/v1/runbook/${id}/reviews`),
  addReview: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/runbook/${id}/reviews`, data),
}

// ── Alert Runbooks ──
export const runbooksApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/runbooks', { params }),
  get: (id: number) => api.get(`/api/v1/runbooks/${id}`),
  getByType: (alertType: string) => api.get(`/api/v1/runbooks/by-type/${encodeURIComponent(alertType)}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/runbooks', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/runbooks/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/runbooks/${id}`),
  executeDetection: (id: number) => api.post(`/api/v1/runbooks/${id}/execute-detection`),
}

// ── Compliance ──
export const complianceApi = {
  listControls: (params?: Record<string, string>) => api.get('/api/v1/compliance/controls', { params }),
  getControl: (id: number) => api.get(`/api/v1/compliance/controls/${id}`),
  scores: (framework?: string) => api.get('/api/v1/compliance/scores', { params: { framework } }),
  updateControl: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/compliance/controls/${id}`, data),
}

export const complianceInfraApi = {
  stats: () => api.get('/api/v1/compliance-infra/stats'),
  section: (key: string) => api.get(`/api/v1/compliance-infra/section/${key}`),
  scores: (params?: Record<string, string>) => api.get('/api/v1/compliance-infra/scores', { params }),
  trend: (key: string, days: number) => api.get(`/api/v1/compliance-infra/trend/${key}?days=${days}`),
  snapshot: () => api.post('/api/v1/compliance-infra/snapshot'),
}

// ── GDPR ──
export const gdprApi = {
  auditList: (params?: Record<string, string>) => api.get('/api/v1/gdpr/audit', { params }),
  auditGet: (ref: string) => api.get(`/api/v1/gdpr/audit/${encodeURIComponent(ref)}`),
  erasure: (data: Record<string, unknown>) => api.post('/api/v1/gdpr/erasure', data),
  archiveSweep: (dryRun: boolean) => api.post(`/api/v1/retention/archive/sweep?dry_run=${dryRun}`),
  archiveManifests: (domain: string) => api.get(`/api/v1/retention/archive/manifests/${domain}`),
  archiveConfirm: (domain: string, data: Record<string, unknown>) => api.post(`/api/v1/retention/archive/${domain}/confirm`, data),
  restore: (params: Record<string, string>) => api.get('/api/v1/retention/restore', { params }),
}

export const gdprExtApi = {
  treatments: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/treatments', { params }),
  treatmentsGet: (id: number) => api.get(`/api/v1/gdpr-ext/treatments/${id}`),
  treatmentsCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/treatments', data),
  treatmentsDelete: (id: number) => api.delete(`/api/v1/gdpr-ext/treatments/${id}`),
  dpia: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/dpia', { params }),
  dpiaCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/dpia', data),
  dpiaApprove: (id: number, approvedBy: number | null) =>
    api.put(`/api/v1/gdpr-ext/dpia/${id}/approve${approvedBy != null ? `?approved_by=${approvedBy}` : ''}`),
  requests: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/requests', { params }),
  requestsCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/requests', data),
  requestsUpdate: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/gdpr-ext/requests/${id}`, data),
  subprocessors: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/subprocessors', { params }),
  subprocessorsCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/subprocessors', data),
  subprocessorsDelete: (id: number) => api.delete(`/api/v1/gdpr-ext/subprocessors/${id}`),
  transfers: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/transfers', { params }),
  transfersCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/transfers', data),
  breaches: (params?: Record<string, string>) => api.get('/api/v1/gdpr-ext/breaches', { params }),
  breachesCreate: (data: Record<string, unknown>) => api.post('/api/v1/gdpr-ext/breaches', data),
  breachesUpdate: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/gdpr-ext/breaches/${id}`, data),
  summary: () => api.get('/api/v1/gdpr-ext/summary'),
}

// ── NIS2 ──
export const nis2Api = {
  classification: () => api.get('/api/v1/nis2/classification'),
  measures: () => api.get('/api/v1/nis2/measures'),
  getMeasure: (code: string) => api.get(`/api/v1/nis2/measures/${code}`),
  governance: () => api.get('/api/v1/nis2/governance'),
  summary: () => api.get('/api/v1/nis2/summary'),
}

export const nis2CountriesApi = {
  list: () => api.get('/api/v1/nis2-countries/countries'),
  get: (code: string) => api.get(`/api/v1/nis2-countries/countries/${code}`),
  authority: (code: string) => api.get(`/api/v1/nis2-countries/countries/${code}/authority`),
}

// ── DORA ──
export const doraApi = {
  pillars: () => api.get('/api/v1/dora/pillars'),
  incidents: (params?: Record<string, string>) => api.get('/api/v1/dora/incidents', { params }),
  getIncident: (id: number) => api.get(`/api/v1/dora/incidents/${id}`),
  thirdParties: () => api.get('/api/v1/dora/third-parties'),
  resilienceTests: () => api.get('/api/v1/dora/resilience-tests'),
  summary: () => api.get('/api/v1/dora/summary'),
}

// ── ISO 27001 ──
export const iso27001Api = {
  soa: () => api.get('/api/v1/iso27001/soa'),
  getSoa: (controlId: string) => api.get(`/api/v1/iso27001/soa/${controlId}`),
  audits: () => api.get('/api/v1/iso27001/audits'),
  nonconformities: () => api.get('/api/v1/iso27001/nonconformities'),
  reviews: () => api.get('/api/v1/iso27001/management-reviews'),
  certification: () => api.get('/api/v1/iso27001/certification'),
  summary: () => api.get('/api/v1/iso27001/summary'),
}

// ── AI Act ──
export const aiactApi = {
  systems: (params?: Record<string, string>) => api.get('/api/v1/aiact/systems', { params }),
  getSystem: (id: number) => api.get(`/api/v1/aiact/systems/${id}`),
  obligations: (systemId: number) => api.get(`/api/v1/aiact/systems/${systemId}/obligations`),
  incidents: (params?: Record<string, string>) => api.get('/api/v1/aiact/incidents', { params }),
  transparency: () => api.get('/api/v1/aiact/transparency'),
  summary: () => api.get('/api/v1/aiact/summary'),
}

// ── SOAR ──
export const soarApi = {
  playbooks: () => api.get('/api/v1/soar/playbooks'),
  getPlaybook: (id: number) => api.get(`/api/v1/soar/playbooks/${id}`),
  executions: () => api.get('/api/v1/soar/executions'),
  getExecution: (id: number) => api.get(`/api/v1/soar/executions/${id}`),
  approvals: () => api.get('/api/v1/soar/approvals/pending'),
  integrations: () => api.get('/api/v1/soar/integrations'),
  summary: () => api.get('/api/v1/soar/summary'),
}

// ── Threat Intel ──
export const threatIntelApi = {
  indicators: (params?: Record<string, string>) => api.get('/api/v1/ti/indicators', { params }),
  actors: () => api.get('/api/v1/ti/actors'),
  feeds: () => api.get('/api/v1/ti/feeds'),
  bulletins: () => api.get('/api/v1/ti/bulletins'),
  summary: () => api.get('/api/v1/ti/summary'),
}

// ── Reporting ──
export const reportingApi = {
  dashboards: () => api.get('/api/v1/reports/dashboards'),
  dashboardGet: (type: string) => api.get(`/api/v1/reports/dashboards/${type}`),
  dashboardData: (type: string) => api.get(`/api/v1/reports/dashboards/${type}/data`),
  templates: (params?: Record<string, string>) => api.get('/api/v1/reports/templates', { params }),
  generate: (data: Record<string, unknown>) => api.post('/api/v1/reports/generate', data),
  schedules: (params?: Record<string, string>) => api.get('/api/v1/reports/schedules', { params }),
  schedulesCreate: (data: Record<string, unknown>) => api.post('/api/v1/reports/schedules', data),
  schedulesDelete: (id: number) => api.delete(`/api/v1/reports/schedules/${id}`),
  history: (params?: Record<string, string>) => api.get('/api/v1/reports/history', { params }),
  summary: () => api.get('/api/v1/reports/summary'),
}

// ── Cross Mapping ──
export const crossMappingApi = {
  unifiedDashboard: () => api.get('/api/v1/mapping/unified-dashboard'),
  getMapping: (fw1: string, fw2: string) => api.get(`/api/v1/mapping/${fw1}/${fw2}`),
}

// ── Audit (auditor role) ──
export const auditApi = {
  profile: () => api.get('/api/v1/audit/profile'),
  crossMapping: (framework: string) => api.get(`/api/v1/audit/cross-mapping/${framework}`),
  exportReport: (format: string) =>
    api.get(`/api/v1/audit/export?format=${format}`, { responseType: 'blob' }),
}

// ── Frameworks ──
export const frameworksModularApi = {
  list: () => api.get('/api/v1/frameworks/'),
  get: (framework: string) => api.get(`/api/v1/frameworks/${framework}`),
  summary: () => api.get('/api/v1/frameworks/summary'),
  updateAssessment: (framework: string, data: Record<string, unknown>) => api.put(`/api/v1/frameworks/${framework}`, data),
}

// ── Regulatory Notifications ──
export const regulatoryNotificationsApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/notifications/', { params }),
  get: (id: number) => api.get(`/api/v1/notifications/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/notifications/', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/notifications/${id}`, data),
  templates: (regulation: string, params?: Record<string, string>) =>
    api.get(`/api/v1/notifications/templates/${regulation}`, { params }),
}

// ── Crisis ──
export const crisisApi = {
  list: () => api.get('/api/v1/crisis/'),
  archived: () => api.get('/api/v1/crisis/archived'),
  get: (id: number) => api.get(`/api/v1/crisis/${id}`),
  playbooks: () => api.get('/api/v1/crisis/playbooks'),
  getPlaybook: (scenario: string) => api.get(`/api/v1/crisis/playbooks/${scenario}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/crisis/', data),
  updateStatus: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/crisis/${id}`, data),
  patchStatus: (id: number, status: string) => api.patch(`/api/v1/crisis/${id}/status`, { status }),
  archive: (id: number, archivedBy: number) => api.post(`/api/v1/crisis/${id}/archive`, { archived_by: archivedBy }),
  report: (id: number) => api.get(`/api/v1/crisis/${id}/report`, { responseType: 'blob' }),
  cell: (id: number) => api.get(`/api/v1/crisis/${id}/cell`),
  actions: (id: number, params?: Record<string, string>) => api.get(`/api/v1/crisis/${id}/actions`, { params }),
  communications: (id: number) => api.get(`/api/v1/crisis/${id}/communications`),
  postmortem: (id: number) => api.get(`/api/v1/crisis/${id}/postmortem`),
  qualify: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/crisis/${id}/qualify`, data),
  // Crisis contacts CRUD (ticket #54)
  contacts: (params?: Record<string, string>) => api.get('/api/v1/crisis/contacts', { params }),
  createContact: (data: Record<string, unknown>) => api.post('/api/v1/crisis/contacts', data),
  updateContact: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/crisis/contacts/${id}`, data),
  deleteContact: (id: number) => api.delete(`/api/v1/crisis/contacts/${id}`),
  // Crisis timeline (ticket #44)
  timeline: (id: number) => api.get(`/api/v1/incidents/${id}/crisis/timeline`),
  timelineAdd: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/incidents/${id}/crisis/timeline`, data),
  timelineLock: (id: number, entryId: string) => api.patch(`/api/v1/incidents/${id}/crisis/timeline/${entryId}/lock`),
  timelineExport: (id: number) => api.get(`/api/v1/incidents/${id}/crisis/timeline/export`, { responseType: 'blob' }),
  // Crisis regulatory deadlines (ticket #48 — sentinelles temporelles)
  regulatoryDeadlines: (id: number) => api.get(`/api/v1/crisis/${id}/regulatory-deadlines`),
}

// ── Crisis Sessions (enhanced) ──
export const crisisSessionsApi = {
  // Playbooks
  listPlaybooks: (params?: Record<string, string | number | boolean>) => api.get('/api/v1/crisis/playbooks', { params }),
  getPlaybook: (id: number) => api.get(`/api/v1/crisis/playbooks/${id}`),
  createPlaybook: (data: Record<string, unknown>) => api.post('/api/v1/crisis/playbooks', data),
  updatePlaybook: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/crisis/playbooks/${id}`, data),
  deletePlaybook: (id: number) => api.delete(`/api/v1/crisis/playbooks/${id}`),
  duplicatePlaybook: (id: number) => api.post(`/api/v1/crisis/playbooks/${id}/duplicate`),
  // Sessions
  listSessions: (params?: Record<string, string | number | boolean>) => api.get('/api/v1/crisis/sessions', { params }),
  getSession: (id: number) => api.get(`/api/v1/crisis/sessions/${id}`),
  createSession: (data: Record<string, unknown>) => api.post('/api/v1/crisis/sessions', data),
  updateSession: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/crisis/sessions/${id}`, data),
  resolveSession: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/crisis/sessions/${id}/resolve`, data),
  getSessionReport: (id: number) => api.get(`/api/v1/crisis/sessions/${id}/report`),
  // Session steps
  updateSessionStep: (sessionId: number, stepId: number, data: Record<string, unknown>) =>
    api.put(`/api/v1/crisis/sessions/${sessionId}/steps/${stepId}`, data),
  // Session assets
  addSessionAsset: (sessionId: number, data: Record<string, unknown>) =>
    api.post(`/api/v1/crisis/sessions/${sessionId}/assets`, data),
  removeSessionAsset: (sessionId: number, assetId: number) =>
    api.delete(`/api/v1/crisis/sessions/${sessionId}/assets/${assetId}`),
  // Session timeline
  addTimelineEntry: (sessionId: number, data: Record<string, unknown>) =>
    api.post(`/api/v1/crisis/sessions/${sessionId}/timeline`, data),
  // Session steps (manual add/delete/reorder)
  addSessionStep: (sessionId: number, data: Record<string, unknown>) =>
    api.post(`/api/v1/crisis/sessions/${sessionId}/steps`, data),
  removeSessionStep: (sessionId: number, stepId: number) =>
    api.delete(`/api/v1/crisis/sessions/${sessionId}/steps/${stepId}`),
  reorderSessionStep: (sessionId: number, stepId: number, newStepNumber: number) =>
    api.put(`/api/v1/crisis/sessions/${sessionId}/steps/${stepId}/reorder`, { new_step_number: newStepNumber }),
  // AI chat
  chatWithAI: (sessionId: number, message: string) =>
    api.post(`/api/v1/crisis/sessions/${sessionId}/chat`, { message }),
  // Restore archived session
  restoreSession: (sessionId: number) =>
    api.put(`/api/v1/crisis/sessions/${sessionId}/restore`),
}

// ── Governance ──
export const governanceApi = {
  policies: (params?: Record<string, string>) => api.get('/api/v1/governance/policies', { params }),
  getPolicy: (id: number) => api.get(`/api/v1/governance/policies/${id}`),
  policyVersions: (id: number) => api.get(`/api/v1/governance/policies/${id}/versions`),
  createPolicy: (data: Record<string, unknown>) => api.post('/api/v1/governance/policies', data),
  updatePolicy: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/policies/${id}`, data),
  deletePolicy: (id: number) => api.delete(`/api/v1/governance/policies/${id}`),
  submitPolicyReview: (id: number) => api.post(`/api/v1/governance/policies/${id}/submit-review`),
  approvePolicy: (id: number, data?: Record<string, unknown>) =>
    api.patch(`/api/v1/governance/policies/${id}/approve`, data ?? {}),
  rejectPolicy: (id: number, data: Record<string, unknown>) =>
    api.patch(`/api/v1/governance/policies/${id}/reject`, data),
  acknowledgePolicy: (id: number, version: string) =>
    api.post(`/api/v1/governance/policies/${id}/acknowledge`, { version }),
  policyAcknowledgments: (id: number) => api.get(`/api/v1/governance/policies/${id}/acknowledgments`),
  remediationActions: (params?: Record<string, string>) => api.get('/api/v1/governance/remediation-actions', { params }),
  createRemediation: (data: Record<string, unknown>) => api.post('/api/v1/governance/remediation-actions', data),
  updateRemediation: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/remediation-actions/${id}`, data),
  dataClassification: (params?: Record<string, string>) => api.get('/api/v1/governance/data-classification', { params }),
  createDataClassification: (data: Record<string, unknown>) => api.post('/api/v1/governance/data-classification', data),
  deleteDataClassification: (id: number) => api.delete(`/api/v1/governance/data-classification/${id}`),
  trainings: (params?: Record<string, string>) => api.get('/api/v1/governance/trainings', { params }),
  createTraining: (data: Record<string, unknown>) => api.post('/api/v1/governance/trainings', data),
  updateTraining: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/trainings/${id}`, data),
  deleteTraining: (id: number) => api.delete(`/api/v1/governance/trainings/${id}`),
  trainingAttendance: (id: number) => api.get(`/api/v1/governance/trainings/${id}/attendance`),
  committee: (params?: Record<string, string>) => api.get('/api/v1/governance/committee', { params }),
  createCommittee: (data: Record<string, unknown>) => api.post('/api/v1/governance/committee', data),
  updateCommittee: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/committee/${id}`, data),
  deleteCommittee: (id: number) => api.delete(`/api/v1/governance/committee/${id}`),
  decisions: (params?: Record<string, string>) => api.get('/api/v1/governance/decisions', { params }),
  createDecision: (data: Record<string, unknown>) => api.post('/api/v1/governance/decisions', data),
  updateDecision: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/decisions/${id}`, data),
  deleteDecision: (id: number) => api.delete(`/api/v1/governance/decisions/${id}`),
  raci: (params?: Record<string, string>) => api.get('/api/v1/governance/raci', { params }),
  createRaci: (data: Record<string, unknown>) => api.post('/api/v1/governance/raci', data),
  updateRaci: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/raci/${id}`, data),
  deleteRaci: (id: number) => api.delete(`/api/v1/governance/raci/${id}`),
  vendors: (params?: Record<string, string>) => api.get('/api/v1/governance/vendors', { params }),
  createVendor: (data: Record<string, unknown>) => api.post('/api/v1/governance/vendors', data),
  updateVendor: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance/vendors/${id}`, data),
  deleteVendor: (id: number) => api.delete(`/api/v1/governance/vendors/${id}`),
  calendar: (params?: Record<string, string>) => api.get('/api/v1/governance/calendar', { params }),
  controlVersions: (params: Record<string, string>) => api.get('/api/v1/governance/control-versions', { params }),
}

// ── Policy Documents (library) ──
export const policyDocumentsApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/policies/documents', { params }),
  get: (id: number) => api.get(`/api/v1/policies/documents/${id}`),
  upload: (formData: FormData) => api.post('/api/v1/policies/documents', formData, { headers: { 'Content-Type': undefined }, timeout: 300000 }),
  uploadRef: (formData: FormData) => api.post('/api/v1/policies/documents', formData, { headers: { 'Content-Type': undefined }, timeout: 300000 }),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/policies/documents/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/policies/documents/${id}`),
  download: (id: number) => api.get(`/api/v1/policies/documents/${id}/download`, { responseType: 'blob' }),
  approve: (id: number) => api.put(`/api/v1/policies/documents/${id}/approve`),
  analyze: (id: number) => api.post(`/api/v1/policies/documents/${id}/analyze`, null, { timeout: 300000 }),
  getAnalysis: (id: number) => api.get(`/api/v1/policies/documents/${id}/analysis`),
  // Audit trail
  getAudit: (id: number) => api.get(`/api/v1/policies/documents/${id}/audit`),
  listAudit: (params?: Record<string, string>) => api.get('/api/v1/policies/audit', { params }),
  // Wizard
  wizardSteps: (category: string) => api.get('/api/v1/policies/wizard/steps', { params: { category } }),
  wizardGenerate: (data: Record<string, unknown>) => api.post('/api/v1/policies/generate', data),
  wizardFinalize: (data: Record<string, unknown>) => api.post('/api/v1/policies/wizard/finalize', data),
  // Review workflow
  reviewDsi: (id: number) => api.put(`/api/v1/policies/documents/${id}/review/dsi`),
  reviewDirection: (id: number) => api.put(`/api/v1/policies/documents/${id}/review/direction`),
  // Page-by-page analysis
  analyzePages: (id: number) => api.post(`/api/v1/policies/documents/${id}/analyze-pages`),
  stopAnalysis: (id: number) => api.post(`/api/v1/policies/documents/${id}/stop-analysis`),
  analysisProgress: (id: number) => api.get(`/api/v1/policies/documents/${id}/analysis-progress`),
  analysisResults: (id: number) => api.get(`/api/v1/policies/documents/${id}/analysis-results`),
  analysisDownload: (id: number) => api.get(`/api/v1/policies/documents/${id}/analysis-download`, { responseType: 'blob' }),
  compileAnalysis: (id: number) => api.post(`/api/v1/policies/documents/${id}/compile-analysis`),
  parseRequirements: (id: number) => api.post(`/api/v1/policies/documents/${id}/parse-requirements`),
  analyzePage: (id: number, page: number) => api.post(`/api/v1/policies/documents/${id}/analyze-page/${page}`),
  analyzeErrorPages: (id: number) => api.post(`/api/v1/policies/documents/${id}/analyze-error-pages`),
}

export const requirementsApi = {
  list: (params?: Record<string, string | number>) => api.get('/api/v1/policies/requirements', { params }),
  stats: () => api.get('/api/v1/policies/requirements/stats'),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/policies/requirements/${id}`, data),
  export: (params?: Record<string, string>) => api.get('/api/v1/policies/requirements/export', { params, responseType: 'blob' }),
}

// ── CMDB ──
export const cmdbApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/cmdb', { params }),
  stats: () => api.get('/api/v1/cmdb/stats'),
  get: (id: number) => api.get(`/api/v1/cmdb/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/cmdb', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/cmdb/${id}`, data),
  updateHierarchy: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/cmdb/${id}/hierarchy`, data),
  delete: (id: number) => api.delete(`/api/v1/cmdb/${id}`),
  events: (id: number) => api.get(`/api/v1/cmdb/${id}/events`),
  availableAssets: () => api.get('/api/v1/cmdb/available-assets'),
  tree: () => api.get('/api/v1/cmdb/tree'),
  types: () => api.get('/api/v1/cmdb/types'),
  availableParents: (excludeId?: number) => api.get('/api/v1/cmdb/available-parents', { params: excludeId ? { exclude_id: excludeId } : undefined }),
}

// ── CMDB GRC (Governance) ──
export const cmdbGrcApi = {
  listAssets: (params?: Record<string, string>) => api.get('/api/v1/cmdb/assets', { params }),
  getAsset: (id: number) => api.get(`/api/v1/cmdb/assets/${id}`),
  updateAsset: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/cmdb/assets/${id}`, data),
  exportAssets: () => api.get('/api/v1/cmdb/assets/export', { responseType: 'blob' }),
  deleteAsset: (id: number) => api.delete(`/api/v1/cmdb/assets/${id}`),
  stats: () => api.get('/api/v1/cmdb/stats'),
  // App↔Infra links
  listAppInfra: () => api.get('/api/v1/cmdb/links/app-infra'),
  createAppInfra: (data: Record<string, unknown>) => api.post('/api/v1/cmdb/links/app-infra', data),
  deleteAppInfra: (id: number) => api.delete(`/api/v1/cmdb/links/app-infra/${id}`),
  // Requirement links
  listRequirements: () => api.get('/api/v1/cmdb/links/requirements'),
  createRequirement: (data: Record<string, unknown>) => api.post('/api/v1/cmdb/links/requirements', data),
  updateRequirement: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/cmdb/links/requirements/${id}`, data),
  deleteRequirement: (id: number) => api.delete(`/api/v1/cmdb/links/requirements/${id}`),
  // Inherited criticality
  inheritedCriticality: () => api.get('/api/v1/cmdb/inherited-criticality'),
  // Asset-centric action plan
  assetActionPlan: (assetId: number, params?: Record<string, string>) =>
    api.get(`/api/v1/cmdb/assets/${assetId}/action-plan`, { params }),
  actionPlansOverview: () => api.get('/api/v1/cmdb/action-plans-overview'),
  exportOverview: () => api.get('/api/v1/cmdb/action-plans-overview/export', { responseType: 'blob' }),
}

// ── AI ──
export const aiApi = {
  listInsights: (params?: Record<string, string>) => api.get('/api/v1/insights', { params }),
  getInsight: (id: number) => api.get(`/api/v1/insights/${id}`),
  createInsight: (data: Record<string, unknown>) => api.post('/api/v1/insights', data),
  dismissInsight: (id: number) => api.put(`/api/v1/insights/${id}`, { is_dismissed: true }),
  deleteInsight: (id: number) => api.delete(`/api/v1/insights/${id}`),
  insightsStats: () => api.get('/api/v1/insights/stats/summary'),
  analyze: () => api.post('/api/v1/insights/analyze'),
}

// ── Agent Config ──
export const agentConfigApi = {
  getPolicy: () => api.get('/api/v1/agent-config/policy'),
  updatePolicy: (data: Record<string, unknown>) => api.put('/api/v1/agent-config/policy', data),
  getAgentPolicyOverride: (agentId: string) => api.get(`/api/v1/agent-config/policy/agents/${agentId}`),
  upsertAgentPolicyOverride: (agentId: string, data: Record<string, unknown>) => api.put(`/api/v1/agent-config/policy/agents/${agentId}`, data),
  deleteAgentPolicyOverride: (agentId: string) => api.delete(`/api/v1/agent-config/policy/agents/${agentId}`),
  policyAudit: (params: Record<string, string>) => api.get('/api/v1/agent-config/policy/audit', { params }),
  policyAuditGet: (auditId: number) => api.get(`/api/v1/agent-config/policy/audit/${auditId}`),
  policyAuditExport: () => api.get('/api/v1/agent-config/policy/audit/export', { responseType: 'blob' }),
}

// ── System ──
export const systemApi = {
  health: () => api.get('/api/v1/system/health'),
}

// ── Infrastructure ──
export const infrastructureApi = {
  retention: {
    list: () => api.get('/api/v1/infrastructure/retention'),
    update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/infrastructure/retention/${id}`, data),
    stats: () => api.get('/api/v1/infrastructure/retention/stats'),
  },
  backups: {
    list: (params?: Record<string, string>) => api.get('/api/v1/infrastructure/backups', { params }),
    create: (data: Record<string, unknown>) => api.post('/api/v1/infrastructure/backups', data),
    delete: (id: number) => api.delete(`/api/v1/infrastructure/backups/${id}`),
  },
  health: () => api.get('/api/v1/infrastructure/health'),
}

// ── Onboarding ──
export const onboardingApi = {
  submit: (data: Record<string, unknown>) => api.post('/api/v1/onboarding', data),
  getStatus: () => api.get('/api/v1/onboarding'),
}

// ── Integrations ──
export const integrationsApi = {
  webhooks: {
    list: () => api.get('/api/v1/integrations/webhooks'),
    create: (data: Record<string, unknown>) => api.post('/api/v1/integrations/webhooks', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/integrations/webhooks/${id}`, data),
    delete: (id: number) => api.delete(`/api/v1/integrations/webhooks/${id}`),
    test: (id: number) => api.post(`/api/v1/integrations/webhooks/${id}/test`),
  },
  siem: {
    list: () => api.get('/api/v1/integrations/siem'),
    create: (data: Record<string, unknown>) => api.post('/api/v1/integrations/siem', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/integrations/siem/${id}`, data),
    delete: (id: number) => api.delete(`/api/v1/integrations/siem/${id}`),
  },
  itsm: {
    list: () => api.get('/api/v1/integrations/itsm'),
    create: (data: Record<string, unknown>) => api.post('/api/v1/integrations/itsm', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/integrations/itsm/${id}`, data),
    delete: (id: number) => api.delete(`/api/v1/integrations/itsm/${id}`),
  },
  notifications: {
    list: () => api.get('/api/v1/integrations/notifications'),
    create: (data: Record<string, unknown>) => api.post('/api/v1/integrations/notifications', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/integrations/notifications/${id}`, data),
    delete: (id: number) => api.delete(`/api/v1/integrations/notifications/${id}`),
    test: (id: number) => api.post(`/api/v1/integrations/notifications/${id}/test`),
  },
}

// ── GRC-CMDB Bridge ──
export const grcBridgeApi = {
  matrix: (params?: Record<string, string | number>) => api.get('/api/v1/grc/matrix', { params }),
  actionPlan: (params?: Record<string, string | number>) => api.get('/api/v1/grc/action-plan', { params }),
  assetComplianceScore: (assetId: number) => api.get(`/api/v1/grc/assets/${assetId}/compliance-score`),
  createLink: (data: { asset_id: number; requirement_id: number; link_type?: string }) =>
    api.post('/api/v1/grc/links', data),
  updateLink: (linkId: number, data: Record<string, unknown>) =>
    api.put(`/api/v1/grc/links/${linkId}`, data),
  deleteLink: (linkId: number) => api.delete(`/api/v1/grc/links/${linkId}`),
  assetRequirements: (assetId: number) => api.get(`/api/v1/grc/links/${assetId}/requirements`),
  source: (requirementId: number) => api.get(`/api/v1/grc/source/${requirementId}`),
  exportMatrix: (params?: Record<string, string | number>) => api.get('/api/v1/grc/matrix/export', { params, responseType: 'blob' }),
  autoAssociate: (assetId: number) => api.post(`/api/v1/grc/auto-associate/${assetId}`),
  listRules: () => api.get('/api/v1/grc/rules'),
  createRule: (data: Record<string, unknown>) => api.post('/api/v1/grc/rules', data),
  updateRule: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/grc/rules/${id}`, data),
  deleteRule: (id: number) => api.delete(`/api/v1/grc/rules/${id}`),
  auditLog: (params?: Record<string, string | number>) => api.get('/api/v1/grc/audit-log', { params }),
  alerts: (params?: Record<string, string | number>) => api.get('/api/v1/grc/alerts', { params }),
  resolveAlert: (id: number) => api.put(`/api/v1/grc/alerts/${id}/resolve`),
  timeline: (assetId: number) => api.get(`/api/v1/grc/assets/${assetId}/timeline`),
  exportActionPlan: (params?: Record<string, string | number>) => api.get('/api/v1/grc/action-plan/export', { params, responseType: 'blob' }),
  propagateInherited: (appId: number) => api.post(`/api/v1/grc/propagate-inherited/${appId}`),
  // Governance action plan (enterprise-level)
  governanceActionPlan: (params?: Record<string, string | number>) => api.get('/api/v1/grc/governance-action-plan', { params }),
  updateGovernanceStatus: (requirementId: number, complianceStatus: string) =>
    api.put(`/api/v1/grc/governance-action-plan/${requirementId}/status`, { compliance_status: complianceStatus }),
  deliverables: (params?: Record<string, string | boolean>) => api.get('/api/v1/grc/deliverables', { params }),
  createDeliverable: (data: Record<string, unknown>) => api.post('/api/v1/grc/deliverables', data),
  updateDeliverable: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/grc/deliverables/${id}`, data),
  deleteDeliverable: (id: number) => api.delete(`/api/v1/grc/deliverables/${id}`),
  toggleNotApplicable: (id: number, isNotApplicable: boolean) =>
    api.put(`/api/v1/grc/deliverables/${id}/not-applicable`, { is_not_applicable: isNotApplicable }),
  relinkOrphans: () => api.post('/api/v1/grc/deliverables/relink-orphans', {}),
}

// ── Appartenance services (user_service_links, 13/09) ──
export const serviceMembersApi = {
  mine: () => api.get('/api/v1/services/mine'),
  members: (serviceId: number) => api.get(`/api/v1/services/${serviceId}/members`),
  addMember: (serviceId: number, userId: number, isOwner = false) =>
    api.post(`/api/v1/services/${serviceId}/members`, { user_id: userId, is_owner: isOwner }),
  updateMember: (serviceId: number, userId: number, isOwner: boolean) =>
    api.put(`/api/v1/services/${serviceId}/members/${userId}`, { user_id: userId, is_owner: isOwner }),
  removeMember: (serviceId: number, userId: number) =>
    api.delete(`/api/v1/services/${serviceId}/members/${userId}`),
}

// ── Action Plans ──
export const actionPlansApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/action-plans', { params }),
  get: (id: number) => api.get(`/api/v1/action-plans/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/action-plans', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/action-plans/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/action-plans/${id}`),
  changeStatus: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/action-plans/${id}/status`, data),
  updateProgress: (id: number, progress: number) => api.put(`/api/v1/action-plans/${id}/progress`, { progress }),
  uploadProof: (id: number, formData: FormData) => api.post(`/api/v1/action-plans/${id}/proof`, formData, { headers: { 'Content-Type': undefined } }),
  downloadProof: (id: number) => api.get(`/api/v1/action-plans/${id}/proof`, { responseType: 'blob' }),
  extend: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/action-plans/${id}/extend`, data),
  history: (id: number) => api.get(`/api/v1/action-plans/${id}/history`),
  export: (params?: Record<string, string>) => api.get('/api/v1/action-plans/export', { params, responseType: 'blob' }),
  users: () => api.get('/api/v1/action-plans/users'),
  fromRequirement: (data: Record<string, unknown>) => api.post('/api/v1/action-plans/from-requirement', data),
}
// ── Governance Actions ──
export const governanceActionsApi = {
  list: (params?: Record<string, string | number>) => api.get('/api/v1/governance-actions', { params }),
  get: (id: number) => api.get(`/api/v1/governance-actions/${id}`),
  updateStatus: (id: number, status: string) => api.put(`/api/v1/governance-actions/${id}/status`, { status }),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/governance-actions/${id}`, data),
  seed: () => api.post('/api/v1/governance-actions/seed'),
  reseed: () => api.post('/api/v1/governance-actions/reseed'),
  // Recurring tasks (generated from reference_requirements)
  recurringTasks: (pilotRole?: string) => api.get('/api/v1/governance-actions/recurring-tasks', { params: pilotRole ? { pilot_role: pilotRole } : {} }),
  completeTask: (taskKey: string, comment?: string) => api.post(`/api/v1/governance-actions/recurring-tasks/${encodeURIComponent(taskKey)}/complete`, { comment: comment || '' }),
  taskHistory: (taskKey: string) => api.get(`/api/v1/governance-actions/recurring-tasks/${encodeURIComponent(taskKey)}/history`),
  deleteCompletion: (completionId: number) => api.delete(`/api/v1/governance-actions/recurring-tasks/completions/${completionId}`),
}

// Governance Documents — IA generation + OnlyOffice editing
export const governanceDocsApi = {
  generate: (deliverableId: number) => api.post(`/api/v1/governance-docs/${deliverableId}/generate`),
  status: (deliverableId: number) => api.get(`/api/v1/governance-docs/${deliverableId}/status`),
  editorConfig: (deliverableId: number, opts?: { view?: boolean; file?: string }) =>
    api.get(`/api/v1/governance-docs/${deliverableId}/editor-config`, {
      params: { ...(opts?.view ? { view: true } : {}), ...(opts?.file ? { file: opts.file } : {}) },
    }),
  fileUrl: (deliverableId: number) => `/api/v1/governance-docs/${deliverableId}/file`,
  submit: (deliverableId: number) => api.post(`/api/v1/governance-docs/${deliverableId}/submit`),
  convertPdf: (deliverableId: number) => api.post(`/api/v1/governance-docs/${deliverableId}/convert-pdf`),
  pdfUrl: (deliverableId: number) => `/api/v1/governance-docs/${deliverableId}/pdf`,
  signedPdfUrl: (deliverableId: number) => `/api/v1/governance-docs/${deliverableId}/signed-pdf`,
  sign: (deliverableId: number) => api.post(`/api/v1/governance-docs/${deliverableId}/sign`),
  countersign: (deliverableId: number) => api.post(`/api/v1/governance-docs/${deliverableId}/countersign`),
  verify: (deliverableId: number) => api.get(`/api/v1/governance-docs/${deliverableId}/verify`),
}

// Pre-analysis and reclassify for policy documents
export const policyDocumentsPreAnalyze = (id: number) => api.post(`/api/v1/policies/documents/${id}/pre-analyze`)
export const policyDocumentsReclassify = (id: number, framework: string) => api.put(`/api/v1/policies/documents/${id}/reclassify`, { regulatory_framework: framework })

// Domain Skills — wizard, assistance, definition
export const domainSkillsApi = {
  list: (framework?: string, skill_type?: string) =>
    api.get('/api/v1/domain-skills', { params: { framework, skill_type } }),
  get: (id: number) => api.get(`/api/v1/domain-skills/${id}`),
  frameworks: () => api.get('/api/v1/domain-skills/frameworks/list'),
  wizard: (data: { framework: string; skill_type: string; skill_name?: string; message: string; history?: Array<{ role: string; content: string }> }) =>
    api.post('/api/v1/domain-skills/wizard', data),
  assist: (data: { framework: string; skill_type: string; skill_name?: string; message: string; history?: Array<{ role: string; content: string }> }, config?: { timeout?: number }) =>
    api.post('/api/v1/domain-skills/assist', data, config),
  define: (data: { framework: string; skill_type: string; skill_name?: string; message: string; history?: Array<{ role: string; content: string }> }) =>
    api.post('/api/v1/domain-skills/define', data),
}

// Wizard de cadrage — IA proactive, profil d'organisation
export const wizardApi = {
  start: () => api.post('/api/v1/wizard/start'),
  chat: (data: { message?: string }) => api.post('/api/v1/wizard/chat', data),
  session: () => api.get('/api/v1/wizard/session'),
  status: () => api.get('/api/v1/wizard/status'),
  profile: () => api.get('/api/v1/wizard/profile'),
  generateProfile: () => api.post('/api/v1/wizard/profile/generate'),
  validateProfile: () => api.put('/api/v1/wizard/profile/validate'),
  updateProfile: (data: { profile_data?: Record<string, unknown>; summary?: string; status?: string }) =>
    api.put('/api/v1/wizard/profile', data),
  reset: () => api.post('/api/v1/wizard/reset'),
}

// DPO Registries — processing, breaches, PIA, rights requests
export const dpoApi = {
  // Processing registry (article 30)
  listProcessing: (params?: Record<string, string>) => api.get('/api/v1/dpo/processing', { params }),
  createProcessing: (data: Record<string, unknown>) => api.post('/api/v1/dpo/processing', data),
  updateProcessing: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/dpo/processing/${id}`, data),
  deleteProcessing: (id: number) => api.delete(`/api/v1/dpo/processing/${id}`),
  // Breach registry (article 33)
  listBreaches: (params?: Record<string, string>) => api.get('/api/v1/dpo/breaches', { params }),
  createBreach: (data: Record<string, unknown>) => api.post('/api/v1/dpo/breaches', data),
  updateBreach: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/dpo/breaches/${id}`, data),
  deleteBreach: (id: number) => api.delete(`/api/v1/dpo/breaches/${id}`),
  // PIA / DPIA (article 35)
  listPia: (params?: Record<string, string>) => api.get('/api/v1/dpo/pia', { params }),
  createPia: (data: Record<string, unknown>) => api.post('/api/v1/dpo/pia', data),
  updatePia: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/dpo/pia/${id}`, data),
  deletePia: (id: number) => api.delete(`/api/v1/dpo/pia/${id}`),
  // Rights requests (articles 15-22)
  listRights: (params?: Record<string, string>) => api.get('/api/v1/dpo/rights', { params }),
  createRight: (data: Record<string, unknown>) => api.post('/api/v1/dpo/rights', data),
  updateRight: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/dpo/rights/${id}`, data),
  deleteRight: (id: number) => api.delete(`/api/v1/dpo/rights/${id}`),
  // PIA AI pre-fill
  aiPrefillPia: (processingId: number) => api.post(`/api/v1/dpo/pia/ai-prefill/${processingId}`),
  // Actions status auto
  actionsStatus: () => api.get('/api/v1/dpo/actions-status'),
}

// Business Services (homologation)
export const businessServicesApi = {
  list: () => api.get('/api/v1/cmdb/services'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/cmdb/services', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/cmdb/services/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/cmdb/services/${id}`),
  listAssets: (serviceId: number) => api.get(`/api/v1/cmdb/services/${serviceId}/assets`),
  linkAsset: (serviceId: number, assetId: number) => api.post(`/api/v1/cmdb/services/${serviceId}/assets/${assetId}`),
  unlinkAsset: (serviceId: number, assetId: number) => api.delete(`/api/v1/cmdb/services/${serviceId}/assets/${assetId}`),
  listAssetServices: (assetId: number) => api.get(`/api/v1/cmdb/assets/${assetId}/services`),
}

// Target → Asset mappings
export const targetMappingApi = {
  list: () => api.get('/api/v1/cmdb/target-mappings'),
  update: (target: string, data: Record<string, unknown>) => api.post('/api/v1/cmdb/target-mappings/update', { target_text: target, ...data }),
  apply: () => api.post('/api/v1/cmdb/target-mappings/apply'),
}

// Asset capabilities (mapping automatique déterministe)
export const capabilitiesApi = {
  catalog: () => api.get('/api/v1/cmdb/capabilities/catalog'),
  getForAsset: (assetId: number) => api.get(`/api/v1/cmdb/assets/${assetId}/capabilities`),
  setForAsset: (assetId: number, capabilities: string[]) => api.put(`/api/v1/cmdb/assets/${assetId}/capabilities`, { capabilities }),
  dictionary: () => api.get('/api/v1/cmdb/capabilities/dictionary'),
  addDictionaryEntry: (data: Record<string, unknown>) => api.post('/api/v1/cmdb/capabilities/dictionary', data),
  deleteDictionaryEntry: (id: number) => api.delete(`/api/v1/cmdb/capabilities/dictionary/${id}`),
}

// Homologation ANSSI
export const homologationApi = {
  list: (params?: Record<string, string>) => api.get('/api/v1/homologations', { params }),
  get: (id: number) => api.get(`/api/v1/homologations/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/v1/homologations', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/homologations/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/homologations/${id}`),
  // Committee
  listCommittee: (id: number) => api.get(`/api/v1/homologations/${id}/committee`),
  addCommittee: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/homologations/${id}/committee`, data),
  removeCommittee: (id: number, memberId: number) => api.delete(`/api/v1/homologations/${id}/committee/${memberId}`),
  // Assessment
  assess: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/homologations/${id}/assess`, data),
  // Documents
  validateDoc: (id: number, docId: number) => api.put(`/api/v1/homologations/${id}/documents/${docId}/validate`),
  rejectDoc: (id: number, docId: number) => api.put(`/api/v1/homologations/${id}/documents/${docId}/reject`),
  // Decision
  decide: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/homologations/${id}/decision`, data),
  // Reservations
  addReservation: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/homologations/${id}/reservations`, data),
  liftReservation: (id: number, resId: number) => api.post(`/api/v1/homologations/${id}/reservations/${resId}/lift`),
}

// Governance Committees (Codir, Comex)
export const committeesApi = {
  list: () => api.get('/api/v1/committees'),
  create: (data: Record<string, unknown>) => api.post('/api/v1/committees', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/api/v1/committees/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/committees/${id}`),
  listMembers: (id: number) => api.get(`/api/v1/committees/${id}/members`),
  addMember: (id: number, data: Record<string, unknown>) => api.post(`/api/v1/committees/${id}/members`, data),
  removeMember: (id: number, memberId: number) => api.delete(`/api/v1/committees/${id}/members/${memberId}`),
}
