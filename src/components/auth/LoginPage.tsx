import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores'
import { authApi, mfaApi, usersApi } from '../../api'
import { useTranslation } from '../../i18n/useTranslation'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [step, setStep] = useState<'login' | 'mfa' | 'backup' | 'mfa_setup' | 'mfa_verify'>('login')
  const [tempToken, setTempToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupData, setSetupData] = useState<{ secret: string; qr_code_url: string; backup_codes: string[] } | null>(null)
  const [setupCode, setSetupCode] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(username, password)
      if (data.mfa_required) {
        setTempToken(data.temp_token)
        setStep('mfa')
      } else if (data.mfa_setup_required) {
        // Force MFA setup flow
        setTempToken(data.temp_token)
        // Initiate MFA setup with the temp token
        try {
          const { data: setupRes } = await mfaApi.forceSetup(data.temp_token)
          setSetupData(setupRes)
          setStep('mfa_setup')
        } catch (setupErr: unknown) {
          const axiosErr = setupErr as { response?: { data?: { detail?: string } } }
          setError(axiosErr.response?.data?.detail || t('mfa.setupError'))
        }
      } else {
        // Set token FIRST so the axios interceptor has it for getMe
        setAuth(data.access_token, data.refresh_token, null)
        // Then fetch user profile with the token now in the store
        const { data: user } = await usersApi.getMe()
        setAuth(data.access_token, data.refresh_token, user)
        navigate('/')
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail
      if (status === 401) {
        setError(t('auth.loginError'))
      } else if (detail) {
        setError(String(detail))
      } else {
        setError(t('auth.loginError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await mfaApi.login(tempToken, mfaCode)
      // Set token FIRST so the axios interceptor has it for getMe
      setAuth(data.access_token, data.refresh_token, null)
      const { data: user } = await usersApi.getMe()
      setAuth(data.access_token, data.refresh_token, user)
      navigate('/')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      const detail = axiosErr.response?.data?.detail
      setError(detail ? String(detail) : t('auth.mfaError'))
    } finally {
      setLoading(false)
    }
  }

  const handleBackupCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await mfaApi.login(tempToken, backupCode)
      setAuth(data.access_token, data.refresh_token, null)
      const { data: user } = await usersApi.getMe()
      setAuth(data.access_token, data.refresh_token, user)
      navigate('/')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      const detail = axiosErr.response?.data?.detail
      setError(detail ? String(detail) : t('auth.mfaError'))
    } finally {
      setLoading(false)
    }
  }

  const handleForceVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await mfaApi.forceVerifySetup(tempToken, setupCode)
      // force-verify-setup returns full JWT tokens
      setAuth(data.access_token, data.refresh_token, null)
      const { data: user } = await usersApi.getMe()
      setAuth(data.access_token, data.refresh_token, user)
      navigate('/')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      const detail = axiosErr.response?.data?.detail
      setError(detail ? String(detail) : t('mfa.verifyError'))
    } finally {
      setLoading(false)
    }
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
  }

  const linkStyle: React.CSSProperties = {
    color: 'var(--color-accent)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '13px',
    background: 'none',
    border: 'none',
    padding: 0,
  }

  const buttonStyle: React.CSSProperties = {
    padding: '10px',
    backgroundColor: loading ? 'var(--color-bg-hover)' : 'var(--color-accent)',
    color: 'var(--color-text-primary)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s ease',
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: step === 'mfa_setup' ? '500px' : '400px',
          padding: '32px',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-accent)',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          LogSOC
        </h1>

        {step === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                {t('auth.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.username')}
                style={inputStyle}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                }}
              >
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                style={inputStyle}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-danger)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? t('common.loading') : t('auth.loginButton')}
            </button>
          </form>
        ) : step === 'mfa' ? (
          <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              {t('auth.mfaPrompt')}
            </p>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder={t('auth.mfaCode')}
              style={inputStyle}
              autoComplete="one-time-code"
              required
              autoFocus
            />
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-danger)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? t('common.loading') : t('auth.mfaVerify')}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { setStep('backup'); setError('') }}
                style={linkStyle}
              >
                {t('mfa.useBackupCode')}
              </button>
            </div>
          </form>
        ) : step === 'backup' ? (
          <form onSubmit={handleBackupCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              {t('mfa.backupCodePrompt')}
            </p>
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder={t('mfa.backupCodePlaceholder')}
              style={inputStyle}
              autoComplete="off"
              required
              autoFocus
            />
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-danger)',
                  color: 'var(--color-text-primary)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? t('common.loading') : t('mfa.useBackupCode')}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { setStep('mfa'); setError('') }}
                style={linkStyle}
              >
                {t('mfa.backToTotp')}
              </button>
            </div>
          </form>
        ) : step === 'mfa_setup' && setupData ? (
          /* Force MFA setup flow */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, textAlign: 'center' }}>
              {t('mfa.setupRequired')}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
              {t('mfa.setupRequiredDesc')}
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
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  placeholder={t('mfa.enterCode')}
                  style={{ ...inputStyle, maxWidth: '200px' }}
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                />
                <button
                  onClick={handleForceVerifySetup}
                  disabled={!setupCode || loading}
                  style={buttonStyle}
                >
                  {loading ? t('common.loading') : t('auth.mfaVerify')}
                </button>
              </div>
              {error && <div style={{ padding: '8px 12px', backgroundColor: 'var(--color-danger)', color: 'var(--color-text-primary)', borderRadius: '6px', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}