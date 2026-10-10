/**
 * CrisisVault — main component for the War Room right zone (documents part).
 * Ticket #47 — Coffre-fort documentaire (zone droite, documents).
 *
 * Features:
 * - Fetches vault documents via useCrisisVault hook (requires X-Crisis-Token)
 * - 4 states: loading / ok / empty / error (tokenExpired / tokenMissing)
 * - Graceful fallback when no documents or API 404/401
 * - Download button per document
 * - Token status indicator (green/red) in zone header
 * - Cohabits with CrisisContacts in the right zone (tab toggle)
 */
import { ShieldCheck, ShieldX, FolderOpen, Lock } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useCrisisVault } from '../../hooks/useCrisisVault'
import { useCrisisStore } from '../../stores/crisisStore'
import { VaultDocumentItem } from './VaultDocumentItem'
import type { VaultDocument } from '../../types/crisis'

export function CrisisVault() {
  const { t } = useTranslation()
  const crisisToken = useCrisisStore((s) => s.crisisToken)
  const { documents, state } = useCrisisVault(crisisToken)

  const tokenValid = crisisToken != null && state !== 'tokenExpired'
  const isTokenExpired = state === 'tokenExpired'

  const renderStateMessage = () => {
    switch (state) {
      case 'loading':
        return <div className="warroom-vault-empty">{t('common.loading')}</div>
      case 'tokenMissing':
        return (
          <div className="warroom-vault-empty warroom-vault-message">
            <Lock size={20} style={{ color: 'var(--color-crisis-border)' }} />
            <span>{t('vault.tokenMissing')}</span>
          </div>
        )
      case 'tokenExpired':
        return (
          <div className="warroom-vault-empty warroom-vault-message warroom-vault-error">
            <ShieldX size={20} style={{ color: 'var(--color-crisis-danger)' }} />
            <span>{t('vault.tokenExpired')}</span>
          </div>
        )
      case 'empty':
        return (
          <div className="warroom-vault-empty warroom-vault-message">
            <FolderOpen size={20} style={{ color: 'var(--color-crisis-border)' }} />
            <span>{t('vault.empty')}</span>
          </div>
        )
      case 'error':
        return (
          <div className="warroom-vault-empty warroom-vault-message warroom-vault-error">
            <span style={{ color: 'var(--color-crisis-danger)' }}>{t('vault.error')}</span>
          </div>
        )
      default:
        return null
    }
  }

  const renderDocumentList = (docs: VaultDocument[], disabled: boolean) => (
    <div className={`warroom-vault-list ${disabled ? 'warroom-vault-list-disabled' : ''}`}>
      {docs.map((doc) => (
        <VaultDocumentItem
          key={doc.id}
          document={doc}
          crisisToken={crisisToken ?? ''}
          disabled={disabled}
        />
      ))}
    </div>
  )

  return (
    <div className="warroom-zone">
      <div className="warroom-zone-header">
        <FolderOpen size={16} style={{ color: 'var(--color-crisis-text)' }} />
        {t('vault.title')}
        {/* Token status indicator */}
        <span
          className="warroom-vault-token-indicator"
          title={tokenValid ? t('vault.tokenValid') : t('vault.tokenExpired')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            fontSize: '11px',
            color: tokenValid ? 'var(--color-crisis-success)' : 'var(--color-crisis-danger)',
          }}
        >
          {tokenValid ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
        </span>
      </div>

      <div className="warroom-zone-content" aria-live="polite" aria-label={t('vault.title')}>
        {/* State messages (loading / empty / error / token) */}
        {state !== 'ok' && renderStateMessage()}

        {/* Normal documents list */}
        {state === 'ok' && renderDocumentList(documents, false)}

        {/* Greyed-out list when token expired (docs may have been cached) */}
        {isTokenExpired && documents.length > 0 && renderDocumentList(documents, true)}
      </div>
    </div>
  )
}