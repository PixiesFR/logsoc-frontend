/**
 * Notification types for crisis regulatory notifications.
 * Ticket #49 — War Room notification pre-fill editor.
 */

/** Template slug identifying the regulatory framework. */
export type NotificationTemplate = 'nis2' | 'rgpd' | 'dora' | 'nis2_1m'

/** Authority receiving the notification. */
export interface NotificationAuthority {
  /** Short code (ANSSI, CNIL, DORA). */
  code: string
  /** Full display name. */
  name: string
  /** Regulatory reference (e.g. "NIS2 Art.32"). */
  legalReference: string
  /** Email address of the authority (recipient). */
  email: string
}

/** Draft notification — the editable form state. */
export interface NotificationDraft {
  /** Template slug. */
  template: NotificationTemplate
  /** Recipient authority. */
  authority: NotificationAuthority
  /** Email subject line. */
  subject: string
  /** Recipient email (to). */
  to: string
  /** CC emails (comma-separated). */
  cc: string
  /** Detection timestamp (ISO 8601). */
  detectionTime: string
  /** Affected machines/assets (free text). */
  affectedAssets: string
  /** Alert description (≥ 50 chars required). */
  description: string
  /** Measures already taken (≥ 30 chars required). */
  measuresTaken: string
  /** Summary of the crisis timeline. */
  timelineSummary: string
  /** Organization name. */
  organizationName: string
  /** Organization country. */
  organizationCountry: string
  /** RSSI contact (name + email). */
  rssiContact: string
  /** Email body (generated from fields above). */
  body: string
}

/** Result of sending a notification. */
export interface SendNotificationResult {
  success: boolean
  /** Backend-assigned notification ID. */
  id?: string
  /** Timeline entry hash for audit trail. */
  hash?: string
  /** Error message if failed. */
  error?: string
}

/** Payload for POST /api/v1/crisis/:id/notifications. */
export interface SendNotificationPayload {
  template: string
  to: string
  cc: string
  subject: string
  body: string
}

/** Valid template strings accepted from query params. */
export const VALID_TEMPLATES = new Set<NotificationTemplate>([
  'nis2',
  'rgpd',
  'dora',
  'nis2_1m',
])

/** Minimum character lengths for validation. */
export const VALIDATION_MIN_LENGTHS = {
  description: 50,
  measuresTaken: 30,
} as const