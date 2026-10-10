import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui/Toast'
import { mfaApi } from '../../api'

type MfaStep = 'idle' | 'setup_password' | 'setup_qr' | 'setup_verify' | 'disable_password' | 'backup_codes' | 'regenerate_verify'

export function MfaSection() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [step, setStep] = useState<MfaStep>('idle')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [setupData, setSetupData] = useState<{ secret: string; qr_code_url: string; backup_codes: string[] } | null>(null)
  const [error, setError] = useState('')

  // Fetch MFA status
  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa', 'status'],
    queryFn: () => mfaApi.status().then((r) => r.data as { enabled: boolean; last_used_at: string | null; setup_required: boolean; policy_required: boolean; policy_roles: string[] }),
  })

  const mfaEnabled = mfaStatus?.enabled ?? false
  const setupRequired = mfaStatus?.setup_required ?? false

  // Setup MFA (step 1: verify password)
  const setupMutation = useMutation({
    mutationFn: (pwd: string) => mfaApi.setup(pwd),
    onSuccess: (res) => {
      const data = res.data as { secret: string; qr_code_url: string; backup_codes: string[] }
      setSetupData(data)
      setStep('setup_qr')
      setError('')
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || t('mfa.setupError'))
    },
  })

  // Verify TOTP code (step 2: enable MFA)
  const verifyMutation = useMutation({
    mutationFn: (code: string) => mfaApi.verify(code),
    onSuccess: () => {
      toast('success', t('mfa.enabled'))
      setStep('idle')
      setPassword('')
      setTotpCode('')
      setSetupData(null)
      qc.invalidateQueries({ queryKey: ['mfa', 'status'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || t('mfa.verifyError'))
    },
  })

  // Disable MFA
  const disableMutation = useMutation({
    mutationFn: (pwd: string) => mfaApi.disable(pwd),
    onSuccess: () => {
      toast('success', t('mfa.disabled'))
      setStep('idle')
      setPassword('')
      qc.invalidateQueries({ queryKey: ['mfa', 'status'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || t('mfa.disableError'))
    },
  })

  // Regenerate MFA (step 1: verify current TOTP)
  const regenerateMutation = useMutation({
    mutationFn: (code: string) => mfaApi.regenerate(code),
    onSuccess: (res) => {
      const data = res.data as { secret: string; qr_code_url: string; backup_codes: string[] }
      setSetupData(data)
      setStep('setup_qr')
      setError('')
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || t('mfa.setupError'))
    },
  })

  // Regenerate backup codes
  const backupCodesMutation = useMutation({
    mutationFn: () => mfaApi.backupCodes(),
    onSuccess: (res) => {
      const data = res.data as { backup_codes: string[] }
      setSetupData((prev) => prev ? { ...prev, backup_codes: data.backup_codes } : null)
      setStep('backup_codes')
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || t('mfa.backupCodesError'))
    },
  })

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    color: 'var(--color-text-primary)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  }

  const buttonSecondaryStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  }

  const errorStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--color-danger)',
    color: 'var(--color-text-primary)',
    borderRadius: '6px',
    fontSize: '13px',
  }

  const badgeEnabledStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: 'var(--color-success, #10b981)',
    color: '#fff',
  }

  const badgeDisabledStyle: React.CSSProperties = {
    ...badgeEnabledStyle,
    backgroundColor: 'var(--color-bg-hover, #374151)',
    color: 'var(--color-text-secondary)',
  }

  const badgeRequiredStyle: React.CSSProperties = {
    ...badgeEnabledStyle,
    backgroundColor: 'var(--color-warning, #f59e0b)',
    color: '#000',
  }

  if (step === 'setup_password') {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.enable')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('mfa.confirmPassword')}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          style={inputStyle}
          autoComplete="current-password"
          required
        />
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setupMutation.mutate(password)}
            disabled={!password || setupMutation.isPending}
            style={buttonStyle}
          >
            {setupMutation.isPending ? t('common.loading') : t('common.confirm')}
          </button>
          <button
            onClick={() => { setStep('idle'); setError(''); setPassword('') }}
            style={buttonSecondaryStyle}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'setup_qr' && setupData) {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.enable')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('mfa.scanQrCode')}
        </p>
        <div style={{ textAlign: 'center' }}>
          <img src={setupData.qr_code_url} alt="MFA QR Code" style={{ maxWidth: '200px' }} />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>
          <strong>Secret:</strong> {setupData.secret}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>
            {t('mfa.backupCodes')}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
            {t('mfa.backupCodesHint')}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            padding: '8px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
          }}>
            {setupData.backup_codes.map((code) => (
              <code key={code} style={{ fontSize: '13px', color: 'var(--color-accent)', textAlign: 'center' }}>
                {code}
              </code>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
            {t('mfa.enterCode')}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder={t('mfa.enterCode')}
              style={{ ...inputStyle, maxWidth: '200px' }}
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
            />
            <button
              onClick={() => verifyMutation.mutate(totpCode)}
              disabled={!totpCode || verifyMutation.isPending}
              style={buttonStyle}
            >
              {verifyMutation.isPending ? t('common.loading') : t('auth.mfaVerify')}
            </button>
          </div>
          {error && <div style={{ ...errorStyle, marginTop: '8px' }}>{error}</div>}
        </div>
        <button
          onClick={() => { setStep('idle'); setError(''); setPassword(''); setTotpCode(''); setSetupData(null) }}
          style={buttonSecondaryStyle}
        >
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  if (step === 'disable_password') {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.disable')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('mfa.confirmPassword')}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          style={inputStyle}
          autoComplete="current-password"
          required
        />
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => disableMutation.mutate(password)}
            disabled={!password || disableMutation.isPending}
            style={{ ...buttonStyle, backgroundColor: 'var(--color-danger)' }}
          >
            {disableMutation.isPending ? t('common.loading') : t('mfa.disable')}
          </button>
          <button
            onClick={() => { setStep('idle'); setError(''); setPassword('') }}
            style={buttonSecondaryStyle}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'backup_codes' && setupData) {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.backupCodes')}
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('mfa.backupCodesHint')}
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          padding: '8px',
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
        }}>
          {setupData.backup_codes.map((code) => (
            <code key={code} style={{ fontSize: '13px', color: 'var(--color-accent)', textAlign: 'center' }}>
              {code}
            </code>
          ))}
        </div>
        <button
          onClick={() => { setStep('idle'); setSetupData(null) }}
          style={buttonStyle}
        >
          {t('common.close')}
        </button>
      </div>
    )
  }

  if (step === 'regenerate_verify') {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.regenerate')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('mfa.regenerateConfirm')}
        </p>
        <input
          type="text"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          placeholder={t('mfa.enterCode')}
          style={inputStyle}
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
        />
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => regenerateMutation.mutate(totpCode)}
            disabled={!totpCode || regenerateMutation.isPending}
            style={buttonStyle}
          >
            {regenerateMutation.isPending ? t('common.loading') : t('mfa.regenerate')}
          </button>
          <button
            onClick={() => { setStep('idle'); setError(''); setTotpCode('') }}
            style={buttonSecondaryStyle}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Idle state: show status + actions
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('mfa.title')}
        </h3>
        {setupRequired && !mfaEnabled ? (
          <span style={badgeRequiredStyle}>
            ⚠ {t('mfa.setupRequired')}
          </span>
        ) : mfaEnabled ? (
          <span style={badgeEnabledStyle}>
            ✓ {t('mfa.enabled')}
          </span>
        ) : (
          <span style={badgeDisabledStyle}>
            {t('mfa.disabled')}
          </span>
        )}
      </div>

      {mfaEnabled ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setStep('regenerate_verify'); setError(''); setTotpCode('') }}
            style={buttonStyle}
          >
            {t('mfa.regenerate')}
          </button>
          <button
            onClick={() => backupCodesMutation.mutate()}
            disabled={backupCodesMutation.isPending}
            style={buttonSecondaryStyle}
          >
            {backupCodesMutation.isPending ? t('common.loading') : t('mfa.viewBackupCodes')}
          </button>
          <button
            onClick={() => { setStep('disable_password'); setError('') }}
            style={{ ...buttonStyle, backgroundColor: 'var(--color-danger)' }}
          >
            {t('mfa.disable')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setStep('setup_password'); setError(''); setPassword('') }}
          style={buttonStyle}
        >
          {t('mfa.enable')}
        </button>
      )}
    </div>
  )
}