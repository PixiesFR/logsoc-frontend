import { auditApi } from '../api'

export interface AuditCrossMappingItem {
  control_id: string
  control_title: string
  status: string
  linked_policy: string | null
  acknowledgment_rate: number
  ebpf_alerts_count: number
}

export interface AuditExportResult {
  blob: Blob
  filename: string
}

/**
 * Fetch cross-mapping data for the auditor view.
 * Returns an empty array on API error (degraded mode).
 */
export async function fetchAuditCrossMapping(framework: string): Promise<AuditCrossMappingItem[]> {
  try {
    const { data } = await auditApi.crossMapping(framework)
    if (Array.isArray(data)) return data as AuditCrossMappingItem[]
    return []
  } catch {
    return []
  }
}

/**
 * Export the audit report as PDF or DOCX.
 * Returns the blob and suggested filename.
 */
export async function exportAuditReport(format: string): Promise<AuditExportResult> {
  const { data } = await auditApi.exportReport(format)
  const ext = format === 'docx' ? 'docx' : 'pdf'
  const date = new Date().toISOString().split('T')[0]
  return {
    blob: data as Blob,
    filename: `audit-report-${date}.${ext}`,
  }
}