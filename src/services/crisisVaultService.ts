/**
 * Crisis Vault API client.
 * Ticket #47 — Coffre-fort documentaire (zone droite, documents).
 *
 * Endpoints:
 *   GET /api/v1/crisis/vault                 — list documents (requires X-Crisis-Token)
 *   GET /api/v1/crisis/vault/:docId/download — download a document (requires X-Crisis-Token)
 */
import { api } from '../api/index'
import type { VaultDocument, VaultDocType } from '../types/crisis'

export const crisisVaultApi = {
  /** List all documents in the crisis vault. Requires a valid crisis token. */
  list: (crisisToken: string) =>
    api.get('/api/v1/crisis/vault', {
      headers: { 'X-Crisis-Token': crisisToken },
    }),

  /** Download a single document by ID. Returns a blob for the browser to handle. */
  download: (docId: number, crisisToken: string) =>
    api.get(`/api/v1/crisis/vault/${docId}/download`, {
      headers: { 'X-Crisis-Token': crisisToken },
      responseType: 'blob',
    }),
}

/** Valid document types for icon selection. */
const VALID_DOC_TYPES = new Set(['pdf', 'vcard', 'doc', 'docx', 'xls', 'xlsx', 'img', 'other'])

/**
 * Derive a document type from a filename or explicit type field.
 * Falls back to 'other' if the type is unknown.
 */
export function deriveDocType(filename: string, rawType?: string): VaultDocType {
  if (rawType) {
    const lt = rawType.toLowerCase()
    if (VALID_DOC_TYPES.has(lt)) return lt as VaultDocType
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'pdf': return 'pdf'
    case 'vcf':
    case 'vcard': return 'vcard'
    case 'doc': return 'doc'
    case 'docx': return 'docx'
    case 'xls': return 'xls'
    case 'xlsx': return 'xlsx'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg': return 'img'
    default: return 'other'
  }
}

/**
 * Type guard that normalizes an arbitrary API response item into a VaultDocument.
 * Handles missing fields and various key name conventions.
 */
export function normalizeVaultDocument(raw: Record<string, unknown>): VaultDocument {
  const filename = String(raw.filename ?? raw.name ?? raw.file_name ?? raw.title ?? '—')
  const rawType = raw.type != null ? String(raw.type) : undefined
  return {
    id: Number(raw.id ?? raw.doc_id ?? 0),
    filename,
    type: deriveDocType(filename, rawType),
    size: raw.size != null ? Number(raw.size) : undefined,
    mimeType: raw.mime_type != null ? String(raw.mime_type) : undefined,
    description: raw.description != null ? String(raw.description) : undefined,
    uploadedAt: raw.uploaded_at != null ? String(raw.uploaded_at) : undefined,
  }
}