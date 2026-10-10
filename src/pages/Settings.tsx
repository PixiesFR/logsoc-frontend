import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, Button, Input, Select, Tabs, Badge } from '../components/ui'
import { api } from '../api'
import { MfaSection } from '../components/settings/MfaSection'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'
import { useOnboardingStore } from '../stores/onboardingStore'
import { useAuthStore } from '../stores'
import { useCrisisStore } from '../stores/crisisStore'
import type { TimelineSortOrder } from '../stores/crisisStore'
import { assetsApi, infrastructureApi, settingsLlmApi, aiAssistApi, mfaPolicyApi, iaPromptsApi, settingsSmtpApi, settingsSeedApi } from '../api'

export function SettingsPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const resetOnboarding = useOnboardingStore((s) => s.reset)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [activeTab, setActiveTab] = useState('general')

  // General
  const [siemName, setSiemName] = useState('')
  // Fréquence d'audit par défaut (13/09): les pratiques non_defini héritent
  const [auditFreqDefault, setAuditFreqDefault] = useState('annuel')
  const [auditFreqLoaded, setAuditFreqLoaded] = useState(false)
  const saveAuditFreqMutation = useMutation({
    mutationFn: (freq: string) => api.put('/api/v1/settings/practices', { audit_frequency_default: freq }),
    onSuccess: () => toast('success', 'Fréquence d’audit par défaut enregistrée'),
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const [timezone, setTimezone] = useState('Europe/Paris')
  const [defaultLang, setDefaultLang] = useState('fr')

  // MFA
  const [mfaPolicy, setMfaPolicy] = useState('optional')

  // API Keys
  const [apiKeyName, setApiKeyName] = useState('')

  // LLM / Ollama
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaApiKey, setOllamaApiKey] = useState('')
  const [ollamaTimeout, setOllamaTimeout] = useState('30')
  const [ollamaModel, setOllamaModel] = useState('')
  const [ollamaTemperature, setOllamaTemperature] = useState('0.1')
  const [ollamaContextLength, setOllamaContextLength] = useState('4096')
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [thinkingLevel, setThinkingLevel] = useState('low')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [testVersion, setTestVersion] = useState('')
  const [testModels, setTestModels] = useState<Array<{ name: string; context_length?: number | null }>>([])
  // Flag: empêche le useEffect d'écraser les champs après que l'utilisateur a saisi des valeurs
  // Surtout important pour l'api_key: si l'utilisateur teste puis sauvegarde, le refresh
  // du GET ne doit pas écraser la clé saisie
  const [llmFieldsLoaded, setLlmFieldsLoaded] = useState(false)

  // Appearance
  const [defaultTheme, setDefaultTheme] = useState('dark')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [brandName, setBrandName] = useState('')

  // Notifications
  const [notifEmail, setNotifEmail] = useState('')
  const [notifSlack, setNotifSlack] = useState('')

  // Crisis
  const autoLockTimeoutSec = useCrisisStore((s) => s.autoLockTimeoutSec)
  const setAutoLockTimeoutSec = useCrisisStore((s) => s.setAutoLockTimeoutSec)
  const timelineSortOrder = useCrisisStore((s) => s.timelineSortOrder)
  const setTimelineSortOrder = useCrisisStore((s) => s.setTimelineSortOrder)

  // Network Scan
  const [nmapPath, setNmapPath] = useState('/usr/bin/nmap')
  const [nmapPathLoaded, setNmapPathLoaded] = useState(false)

  // Maintenance - Retention
  const qc = useQueryClient()
  const [editingRetentionId, setEditingRetentionId] = useState<number | null>(null)
  const [editHotDays, setEditHotDays] = useState('')
  const [editAnonymizeDays, setEditAnonymizeDays] = useState('')
  const [editEraseDays, setEditEraseDays] = useState('')
  const [editAutoPurge, setEditAutoPurge] = useState(false)

  // Maintenance - Backup
  const [backupMethod, setBackupMethod] = useState('none')
  const [backupFrequency, setBackupFrequency] = useState('daily')
  const [backupPath, setBackupPath] = useState('')
  // ── Référentiel (seed) ──
  const [seedRepoUrl, setSeedRepoUrl] = useState('')
  const [seedAuthUser, setSeedAuthUser] = useState('')
  const [seedAuthToken, setSeedAuthToken] = useState('')
  const [seedCheckResult, setSeedCheckResult] = useState<any>(null)
  const [seedLoaded, setSeedLoaded] = useState(false)

  // IA Prompts
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [editPromptText, setEditPromptText] = useState('')
  const [showNewPrompt, setShowNewPrompt] = useState(false)
  const [newPromptKey, setNewPromptKey] = useState('')
  const [newPromptLabel, setNewPromptLabel] = useState('')
  const [newPromptDescription, setNewPromptDescription] = useState('')
  const [newPromptText, setNewPromptText] = useState('')

  interface RetentionPolicy { id: number; name: string; data_domain: string; hot_days: number; anonymize_after_days: number | null; erase_after_days: number | null; auto_purge: boolean; is_active: boolean; [key: string]: unknown }
  interface IaPromptItem { id: number; prompt_key: string; label: string; description: string | null; prompt_text: string; variables: { name: string; description: string }[] | null; is_system: boolean; created_at: string | null; updated_at: string | null }
  function normalizeList(data: unknown): unknown[] {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && 'items' in (data as Record<string, unknown>)) return (data as Record<string, unknown>).items as unknown[]
    if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) { const inner = (data as Record<string, unknown>).data; if (Array.isArray(inner)) return inner }
    return []
  }

  const { data: retentionPolicies } = useQuery({
    queryKey: ['infrastructure', 'retention'],
    queryFn: () => infrastructureApi.retention.list().then((r) => normalizeList(r.data) as RetentionPolicy[]),
    enabled: activeTab === 'maintenance',
  })

  const saveRetentionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => infrastructureApi.retention.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['infrastructure', 'retention'] }); setEditingRetentionId(null); toast('success', t('maintenance.retentionUpdateSuccess')) },
    onError: () => toast('error', t('maintenance.retentionUpdateError')),
  })

  const saveBackupConfigMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => infrastructureApi.backups.create(data),
    onSuccess: () => { toast('success', t('maintenance.backupCreateSuccess')) },
    onError: () => toast('error', t('maintenance.backupCreateError')),
  })

  // Load LLM settings when tab is active
  const { data: llmSettings } = useQuery({
    queryKey: ['settings', 'llm'],
    queryFn: () => settingsLlmApi.get().then((r) => r.data),
    enabled: activeTab === 'llm',
  })

  // Load MFA policy when tab is active
  const { data: mfaPolicyData } = useQuery({
    queryKey: ['mfa', 'policy'],
    queryFn: () => mfaPolicyApi.get().then((r) => r.data as { required: boolean; enforce_for_roles: string[] }),
    enabled: activeTab === 'mfa',
  })

  // ── SMTP settings ──
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpEncryption, setSmtpEncryption] = useState('starttls')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('LogSOC')
  const [smtpLoaded, setSmtpLoaded] = useState(false)

  const { data: smtpSettings } = useQuery({
    queryKey: ['settings', 'smtp'],
    queryFn: () => settingsSmtpApi.get().then((r) => r.data),
    enabled: activeTab === 'notifications',
  })

  useEffect(() => {
    if (smtpSettings && !smtpLoaded) {
      setSmtpHost(smtpSettings.host || '')
      setSmtpPort(String(smtpSettings.port || 587))
      setSmtpEncryption(smtpSettings.encryption || 'starttls')
      setSmtpUser(smtpSettings.user || '')
      setSmtpFromName(smtpSettings.from_name || 'LogSOC')
      setSmtpLoaded(true)
    }
  }, [smtpSettings, smtpLoaded])

  useEffect(() => { if (activeTab !== 'notifications') setSmtpLoaded(false) }, [activeTab])

  const saveSmtpMutation = useMutation({
    mutationFn: () => settingsSmtpApi.update({
      host: smtpHost, port: Number(smtpPort) || 587, encryption: smtpEncryption,
      user: smtpUser, password: smtpPassword || undefined,
      from_addr: smtpUser, from_name: smtpFromName,
    }),
    onSuccess: () => {
      toast('success', 'Paramètres SMTP enregistrés')
      setSmtpPassword('')
      qc.invalidateQueries({ queryKey: ['settings', 'smtp'] })
    },
    onError: () => toast('error', "Erreur d'enregistrement SMTP"),
  })

  const testSmtpMutation = useMutation({
    mutationFn: () => settingsSmtpApi.test({}),
    onSuccess: (res: any) => toast('success', res.data?.message || 'Email test envoyé'),
    onError: (err: any) => toast('error', err?.response?.data?.detail || 'Erreur envoi test'),
  })

  // ── Référentiel (seed) : chargement + mutations ──
  const { data: seedSettings } = useQuery({
    queryKey: ['settings', 'seed'],
    queryFn: () => settingsSeedApi.get().then((r) => r.data),
    enabled: activeTab === 'maintenance',
  })

  useEffect(() => {
    if (seedSettings && !seedLoaded) {
      setSeedRepoUrl(seedSettings.repo_url || '')
      setSeedAuthUser(seedSettings.auth_user || '')
      setSeedLoaded(true)
    }
  }, [seedSettings, seedLoaded])
  useEffect(() => { if (activeTab !== 'maintenance') setSeedLoaded(false) }, [activeTab])

  const saveSeedMutation = useMutation({
    mutationFn: () => settingsSeedApi.update({
      repo_url: seedRepoUrl,
      auth_user: seedAuthUser,
      auth_token: seedAuthToken || undefined,
    }),
    onSuccess: () => {
      toast('success', 'Dépôt référentiel enregistré')
      setSeedAuthToken('')
      qc.invalidateQueries({ queryKey: ['settings', 'seed'] })
    },
    onError: () => toast('error', "Erreur d'enregistrement"),
  })

  const seedCheckMutation = useMutation({
    mutationFn: () => settingsSeedApi.check(),
    onSuccess: (res: any) => {
      setSeedCheckResult(res.data)
      toast(res.data?.up_to_date ? 'success' : 'info',
        res.data?.up_to_date ? 'Référentiel à jour' : 'Mise à jour disponible')
    },
    onError: (err: any) => toast('error', err?.response?.data?.detail || 'Vérification impossible'),
  })

  const seedApplyMutation = useMutation({
    mutationFn: () => settingsSeedApi.apply(),
    onSuccess: (res: any) => {
      toast('success', res.data?.message || 'Mise à jour appliquée')
      setSeedCheckResult(null)
      qc.invalidateQueries({ queryKey: ['settings', 'seed'] })
    },
    onError: (err: any) => toast('error', err?.response?.data?.detail || 'Application impossible'),
  })

  useEffect(() => {
    if (mfaPolicyData) {
      if (mfaPolicyData.required) {
        setMfaPolicy('required')
      } else if (mfaPolicyData.enforce_for_roles && mfaPolicyData.enforce_for_roles.length > 0) {
        setMfaPolicy('required_admin')
      } else {
        setMfaPolicy('optional')
      }
    }
  }, [mfaPolicyData])

  useEffect(() => {
    // Ne peupler les champs qu'une seule fois au premier chargement
    // Empêche le refresh du GET d'écraser les valeurs saisies par l'utilisateur
    // (notamment l'api_key après un test)
    if (llmSettings && !llmFieldsLoaded) {
      const s = llmSettings as Record<string, unknown>
      setOllamaUrl(s.url as string || '')
      setOllamaModel(s.model as string || '')
      setOllamaTimeout(String(s.timeout || '30'))
      setOllamaApiKey(s.api_key as string || '')
      setOllamaTemperature(String(s.temperature || '0.1'))
      setOllamaContextLength(String(s.context_length || '4096'))
      setThinkingEnabled(s.thinking !== undefined ? Boolean(s.thinking) : true)
      setThinkingLevel(String(s.thinking_level || 'low'))
      setLlmFieldsLoaded(true)
    }
  }, [llmSettings, llmFieldsLoaded])

  useEffect(() => {
    // Reset le flag quand on quitte l'onglet LLM pour permettre un re-chargement propre
    if (activeTab !== 'llm') {
      setLlmFieldsLoaded(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'network' && !nmapPathLoaded) {
      assetsApi.getNmapPath().then((res) => {
        const data = res.data as { nmap_path: string }
        setNmapPath(data.nmap_path || '/usr/bin/nmap')
        setNmapPathLoaded(true)
      }).catch(() => {
        // Use default
        setNmapPathLoaded(true)
      })
    }
  }, [activeTab, nmapPathLoaded])

  // Fréquence d'audit par défaut: charge à l'ouverture de l'onglet Général
  useEffect(() => {
    if (activeTab === 'general' && !auditFreqLoaded) {
      api.get('/api/v1/settings/practices').then((res) => {
        setAuditFreqDefault((res.data as { audit_frequency_default: string }).audit_frequency_default || 'annuel')
        setAuditFreqLoaded(true)
      }).catch(() => setAuditFreqLoaded(true))
    }
  }, [activeTab, auditFreqLoaded])

  const saveGeneralMutation = useMutation({
    mutationFn: async () => { /* API call placeholder */ },
    onSuccess: () => toast('success', t('settings.saveSuccess')),
    onError: () => toast('error', t('settings.saveError')),
  })

  const saveMfaMutation = useMutation({
    mutationFn: async () => {
      const payload: { required?: boolean; enforce_for_roles?: string[] } = {}
      if (mfaPolicy === 'required') {
        payload.required = true
        payload.enforce_for_roles = ['superadmin', 'admin', 'soc_analyst', 'auditor', 'dpo', 'rssi', 'compliance_officer', 'viewer']
      } else if (mfaPolicy === 'required_admin') {
        payload.required = false
        payload.enforce_for_roles = ['admin', 'superadmin']
      } else {
        payload.required = false
        payload.enforce_for_roles = []
      }
      return mfaPolicyApi.update(payload)
    },
    onSuccess: () => toast('success', t('settings.saveSuccess')),
    onError: () => toast('error', t('settings.saveError')),
  })

  const createApiKeyMutation = useMutation({
    mutationFn: async () => { /* API call placeholder */ },
    onSuccess: () => { setApiKeyName(''); toast('success', t('settings.apiKeyCreateSuccess')) },
    onError: () => toast('error', t('settings.apiKeyCreateError')),
  })

  // Test Ollama connection
  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestMessage('')
    setTestVersion('')
    setTestModels([])
    try {
      const res = await settingsLlmApi.test({ url: ollamaUrl, api_key: ollamaApiKey })
      const data = res.data as { status: string; version?: string; models?: string[]; message?: string }
      if (data.status === 'ok') {
        setTestStatus('ok')
        setTestVersion(data.version || '')
        const modelNames = data.models || []
        setTestModels(modelNames.map((n: string) => ({ name: n, context_length: null })))
        // Auto-select model if current model is not in the list
        if (modelNames.length > 0 && !modelNames.includes(ollamaModel)) {
          setOllamaModel(modelNames[0])
        }
      } else {
        setTestStatus('error')
        setTestMessage(data.message || t('settings.connectionFailed'))
      }
    } catch (err: unknown) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : t('settings.connectionFailed'))
    }
  }

  // Save LLM settings
  const saveLlmMutation = useMutation({
    mutationFn: () => settingsLlmApi.update({
      url: ollamaUrl,
      model: ollamaModel,
      api_key: ollamaApiKey,
      timeout: Number(ollamaTimeout) || 30,
      temperature: Number(ollamaTemperature) || 0.1,
      context_length: Number(ollamaContextLength) || 4096,
      thinking: thinkingEnabled,
      thinking_level: thinkingLevel,
    }),
    onSuccess: () => {
      toast('success', t('settings.llmSaved'))
      qc.invalidateQueries({ queryKey: ['settings', 'llm'] })
    },
    onError: () => toast('error', t('settings.saveError')),
  })

  const saveAppearanceMutation = useMutation({
    mutationFn: async () => { /* API call placeholder */ },
    onSuccess: () => toast('success', t('settings.saveSuccess')),
    onError: () => toast('error', t('settings.saveError')),
  })

  const saveNotifMutation = useMutation({
    mutationFn: async () => { /* API call placeholder */ },
    onSuccess: () => toast('success', t('settings.saveSuccess')),
    onError: () => toast('error', t('settings.saveError')),
  })

  const saveNmapPathMutation = useMutation({
    mutationFn: async () => assetsApi.updateNmapPath(nmapPath),
    onSuccess: () => toast('success', t('settings.saveSuccess')),
    onError: () => toast('error', t('settings.saveError')),
  })

  // IA Prompts queries & mutations
  const { data: iaPrompts, refetch: refetchPrompts } = useQuery({
    queryKey: ['settings', 'ia-prompts'],
    queryFn: () => iaPromptsApi.list().then((r) => r.data as IaPromptItem[]),
    enabled: activeTab === 'iaprompts',
  })

  const savePromptMutation = useMutation({
    mutationFn: ({ key, prompt_text }: { key: string; prompt_text: string }) => iaPromptsApi.update(key, { prompt_text }),
    onSuccess: () => { toast('success', t('settings.promptSaved')); setEditingPrompt(null); refetchPrompts() },
    onError: () => toast('error', t('settings.saveError')),
  })

  const resetPromptMutation = useMutation({
    mutationFn: (key: string) => iaPromptsApi.reset(key),
    onSuccess: () => { toast('success', t('settings.promptResetDone')); refetchPrompts() },
    onError: () => toast('error', t('settings.saveError')),
  })

  const deletePromptMutation = useMutation({
    mutationFn: (key: string) => iaPromptsApi.delete(key),
    onSuccess: () => { toast('success', t('settings.promptDeleted')); refetchPrompts() },
    onError: () => toast('error', t('settings.saveError')),
  })

  const createPromptMutation = useMutation({
    mutationFn: (data: { prompt_key: string; label: string; description?: string; prompt_text: string }) => iaPromptsApi.create(data),
    onSuccess: () => { toast('success', t('settings.promptSaved')); setShowNewPrompt(false); setNewPromptKey(''); setNewPromptLabel(''); setNewPromptDescription(''); setNewPromptText(''); refetchPrompts() },
    onError: () => toast('error', t('settings.saveError')),
  })

  const canModify = canEdit('admin')

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const expertMode = useAuthStore((s) => s.expertMode)

  const tabs = [
    { key: 'general', label: t('settings.general') },
    { key: 'mfa', label: t('settings.mfa') },
    { key: 'apikeys', label: t('settings.apiKeys') },
    { key: 'llm', label: t('settings.llm') },
    ...(expertMode ? [{ key: 'iaprompts', label: t('settings.iaPrompts') }] : []),
    { key: 'appearance', label: t('settings.appearance') },
    { key: 'notifications', label: t('settings.notifications') },
    { key: 'crisis', label: t('settings.crisis') },
    { key: 'network', label: t('assets.scanNetwork') },
    { key: 'maintenance', label: t('settings.maintenance') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.title')}</h1>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.general')}</h2>
            <Input label={t('settings.siemName')} value={siemName} onChange={setSiemName} placeholder="LogSOC" disabled={!canModify} />
            <Select label={t('settings.timezone')} value={timezone} onChange={setTimezone} disabled={!canModify} options={[
              { label: 'UTC', value: 'UTC' },
              { label: 'Europe/Paris', value: 'Europe/Paris' },
              { label: 'America/New_York', value: 'America/New_York' },
              { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
            ]} />
            <Select label={t('settings.defaultLanguage')} value={defaultLang} onChange={setDefaultLang} disabled={!canModify} options={[
              { label: 'Français', value: 'fr' },
              { label: 'English', value: 'en' },
              { label: 'Deutsch', value: 'de' },
              { label: 'Español', value: 'es' },
            ]} />
            {auditFreqLoaded && canModify && (
              <Select
                label="Fréquence d’audit par défaut (pratiques non réglées)"
                value={auditFreqDefault}
                onChange={(v: string) => {
                  setAuditFreqDefault(v)
                  saveAuditFreqMutation.mutate(v)
                }}
                options={[
                  { label: 'Annuel (1 fois par an — minimum)', value: 'annuel' },
                  { label: 'Biennal (tous les 2 ans)', value: 'biennal' },
                  { label: 'Ponctuel (pas de récurrence)', value: 'ponctuel' },
                ]}
              />
            )}
            {auditFreqLoaded && canModify && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0' }}>
                Les pratiques sans fréquence explicite héritent de cette valeur (38 pratiques de gouvernance).
                Le réglage individuel d’une pratique prime toujours sur ce défaut.
              </p>
            )}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '8px' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                {t('onboarding.reconfigureDescription')}
              </p>
              {canModify && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetOnboarding()
                    setShowOnboarding(true)
                  }}
                >
                  {t('onboarding.reconfigure')}
                </Button>
              )}
            </div>
            {canModify && <Button onClick={() => saveGeneralMutation.mutate()} disabled={saveGeneralMutation.isPending}>{t('common.save')}</Button>}
          </div>
        </Card>
      )}

      {activeTab === 'mfa' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.mfa')}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('settings.mfaDescription')}</p>
            <MfaSection />
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('settings.mfaPolicy')}</h3>
              <Select label={t('settings.mfaPolicy')} value={mfaPolicy} onChange={setMfaPolicy} disabled={!canModify} options={[
                { label: t('settings.mfaOptional'), value: 'optional' },
                { label: t('settings.mfaRequired'), value: 'required' },
                { label: t('settings.mfaRequiredAdmin'), value: 'required_admin' },
              ]} />
              {canModify && <Button onClick={() => saveMfaMutation.mutate()} disabled={saveMfaMutation.isPending}>{t('common.save')}</Button>}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'apikeys' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.apiKeys')}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('settings.apiKeysDescription')}</p>
            {canModify && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <Input label={t('settings.keyName')} value={apiKeyName} onChange={setApiKeyName} />
                <Button onClick={() => createApiKeyMutation.mutate()} disabled={!apiKeyName || createApiKeyMutation.isPending}>{t('settings.createKey')}</Button>
              </div>
            )}
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              {t('settings.noApiKeys')}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'llm' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.ollamaConfig')}</h2>
            <Input
              label={t('settings.ollamaUrl')}
              value={ollamaUrl}
              onChange={setOllamaUrl}
              disabled={!canModify}
              placeholder="http://localhost:11434"
            />
            <Input
              label={t('settings.ollamaApiKey')}
              value={ollamaApiKey}
              onChange={setOllamaApiKey}
              disabled={!canModify}
              type="password"
              placeholder={t('settings.apiKeyHint')}
            />
            <Input
              label={t('settings.ollamaTimeout')}
              value={ollamaTimeout}
              onChange={setOllamaTimeout}
              disabled={!canModify}
              type="number"
              placeholder="30"
            />
            <Input
              label={t('settings.ollamaTemperature') || 'Temperature (0-1)'}
              value={ollamaTemperature}
              onChange={setOllamaTemperature}
              disabled={!canModify}
              type="number"
              placeholder="0.1"
            />
            <Input
              label={t('settings.ollamaContextLength') || 'Context length (tokens)'}
              value={ollamaContextLength}
              onChange={setOllamaContextLength}
              disabled={!canModify}
              type="number"
              placeholder="4096"
            />
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {canModify && (
                <Button
                  onClick={handleTestConnection}
                  disabled={!ollamaUrl || testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? t('settings.testing') : t('settings.testConnection')}
                </Button>
              )}
              {canModify && (
                <Button
                  variant="primary"
                  onClick={() => saveLlmMutation.mutate()}
                  disabled={!ollamaUrl || !ollamaModel || saveLlmMutation.isPending}
                >
                  {t('common.save')}
                </Button>
              )}
            </div>

            {/* Test result status */}
            {testStatus === 'ok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-success-bg, #ecfdf5)', borderRadius: '8px', border: '1px solid var(--color-success, #10b981)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant="success">✓</Badge>
                  <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 600 }}>{t('settings.connectionSuccess')}</span>
                </div>
                {testVersion && (
                  <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    {t('settings.version')}: {testVersion}
                  </span>
                )}
              </div>
            )}
            {testStatus === 'error' && (
              <div style={{ padding: '12px', background: 'var(--color-error-bg, #fef2f2)', borderRadius: '8px', border: '1px solid var(--color-error, #ef4444)' }}>
                <Badge variant="danger">✗</Badge>
                <span style={{ color: 'var(--color-error, #ef4444)', fontWeight: 600, marginLeft: '8px' }}>{t('settings.connectionFailed')}</span>
                {testMessage && (
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>{testMessage}</p>
                )}
              </div>
            )}

            {/* Model selection dropdown — always shown, reloads models on click */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {t('settings.ollamaModel')}
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={ollamaModel}
                  onFocus={handleTestConnection}
                  onClick={handleTestConnection}
                  onChange={async (e) => {
                    setOllamaModel(e.target.value)
                    // Fetch context_length for selected model only
                    if (e.target.value) {
                      try {
                        const infoResp = await aiAssistApi.modelInfo(e.target.value)
                        const info = infoResp.data as { context_length?: number | null }
                        if (info.context_length) {
                          setOllamaContextLength(String(info.context_length))
                        }
                      } catch { /* silent */ }
                    }
                  }}
                  data-testid="ollama-model-select"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">{t('settings.ollamaModelSelect')}</option>
                  {/* Show currently saved model even if not in fresh test list */}
                  {ollamaModel && !testModels.find(m => m.name === ollamaModel) && (
                    <option key="current" value={ollamaModel}>{ollamaModel} {testStatus === 'ok' ? '(non listé)' : ''}</option>
                  )}
                  {testModels.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}{m.context_length ? ` (ctx: ${m.context_length.toLocaleString()})` : ''}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !ollamaUrl}
                  size="sm"
                >
                  {testStatus === 'testing' ? '...' : '↻'}
                </Button>
              </div>
              {testStatus === 'ok' && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {t('settings.availableModels')}: {testModels.length}
                  {testVersion && ` · Ollama ${testVersion}`}
                </span>
              )}
              {testStatus === 'testing' && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {t('settings.testing')}...
                </span>
              )}
            </div>

            {/* Thinking (raisonnement) — GLM-5.3, gpt-oss, kimi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Mode réflexion (thinking)</span>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                    Requiert un modèle avec la capacité « thinking » (GLM-5.3, gpt-oss, kimi…). Recommandé avec GLM-5.3 : sans ce paramètre, le raisonnement pollue les réponses.
                  </p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, cursor: canModify ? 'pointer' : 'not-allowed', opacity: canModify ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                    disabled={!canModify}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '12px', transition: 'background 0.2s',
                    background: thinkingEnabled ? 'var(--color-accent)' : 'var(--color-border)',
                  }} />
                  <span style={{
                    position: 'absolute', top: '3px', left: thinkingEnabled ? '23px' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </label>
              </div>
              {thinkingEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', minWidth: '90px' }}>Niveau requis</span>
                  <select
                    value={thinkingLevel}
                    onChange={(e) => setThinkingLevel(e.target.value)}
                    disabled={!canModify}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: '14px',
                    }}
                  >
                    <option value="low">Low — rapide, raisonnement court</option>
                    <option value="medium">Medium — équilibré</option>
                    <option value="high">High — raisonnement approfondi</option>
                    <option value="max">Max — raisonnement maximal (lent)</option>
                  </select>
                </div>
              )}
            </div>
            {/* Warning if context_length is insufficient for document generation */}
            {ollamaModel && Number(ollamaContextLength) < 65536 && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid var(--color-warning, #f59e0b)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--color-warning, #f59e0b)',
              }}>
                ⚠️ Le contexte de ce modèle ({Number(ollamaContextLength).toLocaleString()} tokens) est inférieur au minimum recommandé (65 536 tokens). 
                La génération de documents de gouvernance et l'analyse de référentiels peuvent être limitées ou tronquées.
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'iaprompts' && (
        <Card>
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.iaPrompts')}</h2>
              {canModify && (
                <Button onClick={() => setShowNewPrompt(true)} size="sm">{t('settings.newPrompt')}</Button>
              )}
            </div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('settings.iaPromptsDesc')}</p>

            {/* Prompt list table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {(iaPrompts ?? []).length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
                  No prompts found
                </p>
              ) : (iaPrompts ?? []).map((p) => (
                <div
                  key={p.prompt_key}
                  onClick={() => { setEditingPrompt(p.prompt_key); setEditPromptText(p.prompt_text) }}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-secondary, #1e293b)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</span>
                      <Badge variant={p.is_system ? 'info' : 'default'}>
                        {p.is_system ? t('settings.promptSystem') : t('settings.promptCustom')}
                      </Badge>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {p.prompt_key} — {p.description || ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Edit prompt modal */}
            {editingPrompt && (() => {
              const prompt = (iaPrompts ?? []).find((p) => p.prompt_key === editingPrompt)
              if (!prompt) return null
              return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingPrompt(null)}>
                  <div style={{ background: 'var(--color-bg-primary)', borderRadius: '12px', padding: '24px', width: '640px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{prompt.label}</h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {prompt.is_system && canModify && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(t('settings.resetPromptConfirm'))) {
                                resetPromptMutation.mutate(prompt.prompt_key)
                              }
                            }}
                          >
                            {t('settings.resetPrompt')}
                          </Button>
                        )}
                        {!prompt.is_system && canModify && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(t('settings.promptDeleteConfirm'))) {
                                deletePromptMutation.mutate(prompt.prompt_key)
                                setEditingPrompt(null)
                              }
                            }}
                          >
                            {t('common.delete') || 'Delete'}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('settings.promptKey')}</label>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{prompt.prompt_key}</div>
                      </div>

                      {prompt.description && (
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('settings.promptDescription')}</label>
                          <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{prompt.description}</div>
                        </div>
                      )}

                      {prompt.variables && prompt.variables.length > 0 && (
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('settings.promptVariables')}</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                            {prompt.variables.map((v) => (
                              <div key={v.name} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                                <code style={{ background: 'var(--color-bg-secondary, #1e293b)', padding: '2px 6px', borderRadius: '4px', color: 'var(--color-primary, #6366f1)' }}>{`{${v.name}}`}</code>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{v.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('settings.promptText')}</label>
                        <textarea
                          value={editPromptText}
                          onChange={(e) => setEditPromptText(e.target.value)}
                          disabled={!canModify}
                          style={{
                            width: '100%',
                            minHeight: '200px',
                            padding: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            resize: 'vertical',
                          }}
                        />
                      </div>

                      {canModify && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <Button variant="secondary" onClick={() => setEditingPrompt(null)}>{t('common.cancel') || 'Cancel'}</Button>
                          <Button
                            onClick={() => savePromptMutation.mutate({ key: prompt.prompt_key, prompt_text: editPromptText })}
                            disabled={savePromptMutation.isPending}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* New prompt modal */}
            {showNewPrompt && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowNewPrompt(false)}>
                <div style={{ background: 'var(--color-bg-primary)', borderRadius: '12px', padding: '24px', width: '640px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>{t('settings.newPrompt')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Input label={t('settings.promptNewKey')} value={newPromptKey} onChange={setNewPromptKey} placeholder="my_custom_prompt" />
                    <Input label={t('settings.promptNewLabel')} value={newPromptLabel} onChange={setNewPromptLabel} placeholder={t('settings.promptNewLabel')} />
                    <Input label={t('settings.promptNewDescription')} value={newPromptDescription} onChange={setNewPromptDescription} placeholder={t('settings.promptNewDescription')} />
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('settings.promptNewText')}</label>
                      <textarea
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '150px',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-primary)',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" onClick={() => setShowNewPrompt(false)}>{t('common.cancel') || 'Cancel'}</Button>
                      <Button
                        onClick={() => createPromptMutation.mutate({
                          prompt_key: newPromptKey,
                          label: newPromptLabel,
                          description: newPromptDescription || undefined,
                          prompt_text: newPromptText,
                        })}
                        disabled={!newPromptKey || !newPromptLabel || !newPromptText || createPromptMutation.isPending}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'appearance' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.appearance')}</h2>
            <Select label={t('settings.defaultTheme')} value={defaultTheme} onChange={setDefaultTheme} disabled={!canModify} options={[
              { label: t('common.dark'), value: 'dark' },
              { label: t('common.light'), value: 'light' },
            ]} />
            <Input label={t('settings.primaryColor')} value={primaryColor} onChange={setPrimaryColor} disabled={!canModify} />
            <Input label={t('settings.brandName')} value={brandName} onChange={setBrandName} disabled={!canModify} />
            {canModify && <Button onClick={() => saveAppearanceMutation.mutate()} disabled={saveAppearanceMutation.isPending}>{t('common.save')}</Button>}
          </div>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.notifications')}</h2>

            {/* ── Serveur SMTP (expédition des demandes de validation) ── */}
            <div style={{
              padding: '16px', borderRadius: '8px',
              border: `1px solid ${(smtpSettings as any)?.configured ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)'}`,
              background: 'var(--color-bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  Serveur SMTP — validation des documents par email
                </h3>
                {(smtpSettings as any)?.configured ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-success, #10b981)', fontWeight: 600 }}>✓ Configuré</span>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-warning, #f59e0b)', fontWeight: 600 }}>⚠ Non configuré</span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Utilisé pour envoyer les demandes de validation de documents aux signataires (avec PDF en pièce jointe et lien de validation sans connexion).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <Input label="Serveur SMTP (hôte)" value={smtpHost} onChange={setSmtpHost} disabled={!canModify} placeholder="smtp.votredomaine.fr" />
                <Input label="Port" value={smtpPort} onChange={setSmtpPort} disabled={!canModify} type="number" placeholder="587" />
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>Chiffrement</label>
                  <select
                    value={smtpEncryption}
                    onChange={(e) => setSmtpEncryption(e.target.value)}
                    disabled={!canModify}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  >
                    <option value="starttls">STARTTLS (recommandé)</option>
                    <option value="ssl">SSL/TLS</option>
                    <option value="none">Aucun</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <Input label="Utilisateur (email)" value={smtpUser} onChange={setSmtpUser} disabled={!canModify} type="email" placeholder="logsoc@votredomaine.fr" />
                <Input
                  label={(smtpSettings as any)?.password_set ? 'Mot de passe (configuré — laisser vide pour garder)' : 'Mot de passe'}
                  value={smtpPassword}
                  onChange={setSmtpPassword}
                  disabled={!canModify}
                  type="password"
                  placeholder={(smtpSettings as any)?.password_set ? '••••••••' : ''}
                />
                <Input label="Nom de l'expéditeur" value={smtpFromName} onChange={setSmtpFromName} disabled={!canModify} placeholder="LogSOC Gouvernance" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {canModify && (
                  <Button onClick={() => saveSmtpMutation.mutate()} disabled={saveSmtpMutation.isPending}>
                    {saveSmtpMutation.isPending ? '...' : 'Enregistrer'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => testSmtpMutation.mutate()}
                  disabled={testSmtpMutation.isPending || !(smtpSettings as any)?.configured}
                >
                  {testSmtpMutation.isPending ? 'Envoi...' : 'Tester l\'envoi'}
                </Button>
              </div>
            </div>

            <Input label={t('settings.notificationEmail')} value={notifEmail} onChange={setNotifEmail} disabled={!canModify} type="email" />
            <Input label={t('settings.notificationSlack')} value={notifSlack} onChange={setNotifSlack} disabled={!canModify} placeholder="https://hooks.slack.com/..." />
            {canModify && <Button onClick={() => saveNotifMutation.mutate()} disabled={saveNotifMutation.isPending}>{t('common.save')}</Button>}
          </div>
        </Card>
      )}

      {activeTab === 'crisis' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.crisis')}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{t('settings.crisisDescription')}</p>
            <Input
              label={t('settings.crisisAutoLockTimeout')}
              value={String(autoLockTimeoutSec)}
              onChange={(v) => setAutoLockTimeoutSec(Number(v) || 0)}
              disabled={!canModify}
              type="number"
              placeholder="60"
            />
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '-8px 0 0 0' }}>
              {t('settings.crisisAutoLockHint')}
            </p>
            <Select
              label={t('settings.crisisTimelineSort')}
              value={timelineSortOrder}
              onChange={(v) => setTimelineSortOrder(v as TimelineSortOrder)}
              disabled={!canModify}
              options={[
                { label: t('settings.crisisSortNewestFirst'), value: 'desc' },
                { label: t('settings.crisisSortNewestLast'), value: 'asc' },
              ]}
            />
          </div>
        </Card>
      )}

      {activeTab === 'network' && (
        <Card>
          <div style={sectionStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('assets.scanNetwork')}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Configure the path to nmap binary used for network scanning and asset discovery.
            </p>
            <Input
              label={t('assets.nmapPath')}
              value={nmapPath}
              onChange={setNmapPath}
              disabled={!canModify}
              placeholder="/usr/bin/nmap"
            />
            {canModify && (
              <Button onClick={() => saveNmapPathMutation.mutate()} disabled={saveNmapPathMutation.isPending}>
                {t('common.save')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'maintenance' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ── Référentiel de gouvernance (mises à jour depuis git) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Référentiel de gouvernance</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                Mises à jour des référentiels (exigences, livrables, dictionnaire de mappage) depuis un dépôt git.
                Version locale : <code style={{ background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{(seedSettings as any)?.local_version || '—'}</code>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <Input label="URL du dépôt" value={seedRepoUrl} onChange={setSeedRepoUrl} disabled={!canModify} placeholder="https://git.exemple.fr/.../logsoc-web" />
                <Input label="Utilisateur" value={seedAuthUser} onChange={setSeedAuthUser} disabled={!canModify} placeholder="pixies" />
                <Input
                  label={(seedSettings as any)?.auth_token_set ? 'Token (configuré — laisser vide)' : 'Token / mot de passe'}
                  value={seedAuthToken}
                  onChange={setSeedAuthToken}
                  disabled={!canModify}
                  type="password"
                  placeholder={(seedSettings as any)?.auth_token_set ? '••••••••' : ''}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {canModify && (
                  <Button onClick={() => saveSeedMutation.mutate()} disabled={saveSeedMutation.isPending}>
                    {saveSeedMutation.isPending ? '...' : 'Enregistrer'}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => seedCheckMutation.mutate()} disabled={seedCheckMutation.isPending || !seedRepoUrl}>
                  {seedCheckMutation.isPending ? 'Vérification...' : 'Vérifier les mises à jour'}
                </Button>
                {seedCheckResult && !seedCheckResult.up_to_date && canModify && (
                  <Button variant="primary" onClick={() => seedApplyMutation.mutate()} disabled={seedApplyMutation.isPending}>
                    {seedApplyMutation.isPending ? 'Application...' : `Appliquer la mise à jour (${seedCheckResult.remote_version})`}
                  </Button>
                )}
              </div>
              {seedCheckResult && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                  background: seedCheckResult.up_to_date ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${seedCheckResult.up_to_date ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)'}`,
                  color: seedCheckResult.up_to_date ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)',
                }}>
                  {seedCheckResult.up_to_date
                    ? `✓ Référentiel à jour (${seedCheckResult.files_found} fichiers, version ${seedCheckResult.remote_version})`
                    : `⚠ Mise à jour disponible : locale ${seedCheckResult.local_version} → distante ${seedCheckResult.remote_version} (${seedCheckResult.files_found} fichiers)`}
                  {seedCheckResult.warnings?.length > 0 && (
                    <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>Avertissements: {seedCheckResult.warnings.join('; ')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Retention config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.retentionConfig')}</h2>
              {(retentionPolicies ?? []).length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{t('maintenance.noRetentionPolicies')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(retentionPolicies ?? []).map((policy) => (
                    <div key={policy.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{policy.name}</span>
                          <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{policy.data_domain}</span>
                        </div>
                        <Badge variant={policy.is_active ? 'success' : 'default'}>{policy.is_active ? t('common.yes') : t('common.no')}</Badge>
                      </div>
                      {editingRetentionId === policy.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <Input label={t('maintenance.hotDays')} value={editHotDays} onChange={setEditHotDays} type="number" />
                          <Input label={t('maintenance.anonymizeAfterDays')} value={editAnonymizeDays} onChange={setEditAnonymizeDays} type="number" />
                          <Input label={t('maintenance.eraseAfterDays')} value={editEraseDays} onChange={setEditEraseDays} type="number" />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                            <input type="checkbox" checked={editAutoPurge} onChange={(e) => setEditAutoPurge(e.target.checked)} />
                            {t('maintenance.autoPurge')}
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button size="sm" onClick={() => saveRetentionMutation.mutate({
                              id: policy.id,
                              data: {
                                hot_days: Number(editHotDays) || policy.hot_days,
                                anonymize_after_days: editAnonymizeDays ? Number(editAnonymizeDays) : null,
                                erase_after_days: editEraseDays ? Number(editEraseDays) : null,
                                auto_purge: editAutoPurge,
                              }
                            })} disabled={saveRetentionMutation.isPending}>{t('common.save')}</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingRetentionId(null)}>{t('common.cancel')}</Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          <div><span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('maintenance.hotDays')}</span><br /><span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{policy.hot_days}</span></div>
                          <div><span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('maintenance.anonymizeAfterDays')}</span><br /><span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{policy.anonymize_after_days ?? '—'}</span></div>
                          <div><span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('maintenance.eraseAfterDays')}</span><br /><span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{policy.erase_after_days ?? '—'}</span></div>
                          <div><span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('maintenance.autoPurge')}</span><br /><Badge variant={policy.auto_purge ? 'success' : 'default'}>{policy.auto_purge ? t('common.yes') : t('common.no')}</Badge></div>
                        </div>
                      )}
                      {canModify && editingRetentionId !== policy.id && (
                        <Button size="sm" variant="secondary" onClick={() => {
                          setEditingRetentionId(policy.id)
                          setEditHotDays(String(policy.hot_days ?? ''))
                          setEditAnonymizeDays(String(policy.anonymize_after_days ?? ''))
                          setEditEraseDays(String(policy.erase_after_days ?? ''))
                          setEditAutoPurge(!!policy.auto_purge)
                        }}>{t('common.edit')}</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Backup config */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('settings.backupConfig')}</h2>
              <Select label={t('settings.backupMethod')} value={backupMethod} onChange={setBackupMethod} disabled={!canModify} options={[
                { label: t('maintenance.backupMethodNone'), value: 'none' },
                { label: t('maintenance.backupMethodManual'), value: 'manual' },
                { label: t('maintenance.backupMethodAuto'), value: 'automatic' },
              ]} />
              {backupMethod === 'automatic' && (
                <Select label={t('settings.backupFrequency')} value={backupFrequency} onChange={setBackupFrequency} disabled={!canModify} options={[
                  { label: t('maintenance.freqDaily'), value: 'daily' },
                  { label: t('maintenance.freqWeekly'), value: 'weekly' },
                  { label: t('maintenance.freqMonthly'), value: 'monthly' },
                ]} />
              )}
              <Input label={t('settings.backupPath')} value={backupPath} onChange={setBackupPath} disabled={!canModify} placeholder="/var/backups/logsoc" />
              {canModify && (
                <Button onClick={() => saveBackupConfigMutation.mutate({
                  method: backupMethod,
                  frequency: backupFrequency,
                  path: backupPath,
                })} disabled={saveBackupConfigMutation.isPending}>{t('common.save')}</Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {showOnboarding && (
        <OnboardingWizard onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}