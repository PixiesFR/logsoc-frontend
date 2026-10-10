/**
 * VaultDocumentItem — a single document in the crisis vault.
 * Ticket #47 — Coffre-fort documentaire (zone droite, documents).
 *
 * Displays: type icon + filename + optional size/description
 * Action: Download button (triggers blob download via API)
 */
import { useState, useCallback } from 'react'
import { FileText, FileSpreadsheet, Contact as ContactIcon, Image, File, Download, Loader2 } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useToast } from '../ui/Toast'
import { crisisVaultApi } from '../../services/crisisVaultService'
import type { VaultDocument, VaultDocType } from '../../types/crisis'

interface VaultDocumentItemProps {
  document: VaultDocument
  crisisToken: string
  /** When true, disables interactions (e.g. token expired → greyed out). */
  disabled?: boolean
}

/** Map document type to the appropriate lucide icon. */
function getDocIcon(type: VaultDocType) {
  switch (type) {
    case 'pdf': return FileText
    case 'doc':
    case 'docx': return FileText
    case 'xls':
    case 'xlsx': return FileSpreadsheet
    case 'vcard': return ContactIcon
    case 'img': return Image
    default: return File
  }
}

/** Format file size in bytes to a human-readable string. */
function formatSize(bytes?: number): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function VaultDocumentItem({ document: doc, crisisToken, disabled = false }: VaultDocumentItemProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)

  const Icon = getDocIcon(doc.type)

  const handleDownload = useCallback(async () => {
    if (disabled || downloading) return
    setDownloading(true)
    try {
      const res = await crisisVaultApi.download(doc.id, crisisToken)
      // Create a blob URL and trigger download
      const blob = new Blob([res.data as BlobPart])
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = doc.filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast('error', t('vault.downloadError'))
    } finally {
      setDownloading(false)
    }
  }, [disabled, downloading, doc, crisisToken, toast, t])

  const sizeStr = formatSize(doc.size)
  const downloadAriaLabel = t('vault.downloadAria', { name: doc.filename })

  return (
    <div className={`warroom-vault-item ${disabled ? 'warroom-vault-item-disabled' : ''}`}>
      <div className="warroom-vault-item-icon">
        <Icon size={16} style={{ color: 'var(--color-crisis-text)' }} />
      </div>
      <div className="warroom-vault-item-info">
        <div className="warroom-vault-item-name">{doc.filename}</div>
        {sizeStr && (
          <div className="warroom-vault-item-size">{sizeStr}</div>
        )}
        {doc.description && (
          <div className="warroom-vault-item-desc">{doc.description}</div>
        )}
      </div>
      <button
        className="warroom-vault-btn"
        onClick={handleDownload}
        disabled={disabled || downloading}
        aria-label={downloadAriaLabel}
      >
        {downloading ? <Loader2 size={13} className="warroom-spin" /> : <Download size={13} />}
        <span>{t('vault.download')}</span>
      </button>
    </div>
  )
}