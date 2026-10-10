/**
 * Crisis Notification Service — generate, validate, and send regulatory notifications.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Endpoints:
 *   POST /api/v1/crisis/:id/notifications/generate  — AI-generate draft from crisis context
 *   POST /api/v1/crisis/:id/notifications            — send notification via SMTP
 *   GET  /api/v1/crisis/:id/notifications/preview    — preview email (to/cc/subject/body)
 */
import { api } from '../api'
import {
  type NotificationTemplate,
  type NotificationAuthority,
  type NotificationDraft,
  type SendNotificationResult,
  type SendNotificationPayload,
  VALIDATION_MIN_LENGTHS,
} from '../types/notification'

/** Authority metadata per template. */
const AUTHORITIES: Record<NotificationTemplate, NotificationAuthority> = {
  nis2: {
    code: 'ANSSI',
    name: 'ANSSI',
    legalReference: 'NIS2 Art.32',
    email: 'alerte@ssi.gouv.fr',
  },
  rgpd: {
    code: 'CNIL',
    name: 'CNIL',
    legalReference: 'RGPD Art.33',
    email: 'notification@cnil.fr',
  },
  dora: {
    code: 'DORA',
    name: 'DORA Joint Committee',
    legalReference: 'DORA Art.19',
    email: 'dora-reporting@esa.europa.eu',
  },
  nis2_1m: {
    code: 'ANSSI',
    name: 'ANSSI',
    legalReference: 'NIS2 Art.32.3',
    email: 'rapport@ssi.gouv.fr',
  },
}

/** Get the authority metadata for a template. */
export function getAuthority(template: NotificationTemplate): NotificationAuthority {
  return AUTHORITIES[template]
}

/** Normalize a string into a valid NotificationTemplate. */
export function normalizeTemplate(value: string): NotificationTemplate {
  // 'gdpr' from the countdown regulation field maps to 'rgpd' template
  if (value === 'gdpr') return 'rgpd'
  if (value === 'nis2' || value === 'rgpd' || value === 'dora' || value === 'nis2_1m') {
    return value
  }
  return 'nis2'
}

/**
 * Generate the email body from draft fields.
 * This builds a structured email body suitable for regulatory notification.
 */
export function generateEmailBody(draft: Omit<NotificationDraft, 'body'>): string {
  const lines: string[] = []
  lines.push(`${draft.authority.legalReference} — Notification d'incident`)
  lines.push('')
  lines.push(`Autorité destinataire : ${draft.authority.name} (${draft.authority.email})`)
  lines.push(`Référence réglementaire : ${draft.authority.legalReference}`)
  lines.push('')
  lines.push(`Organisation : ${draft.organizationName}`)
  lines.push(`Pays : ${draft.organizationCountry}`)
  lines.push(`Contact RSSI : ${draft.rssiContact}`)
  lines.push('')
  lines.push(`Heure de détection : ${draft.detectionTime}`)
  lines.push(`Machines touchées : ${draft.affectedAssets}`)
  lines.push('')
  lines.push('Description de l\'incident :')
  lines.push(draft.description)
  lines.push('')
  lines.push('Mesures prises :')
  lines.push(draft.measuresTaken)
  lines.push('')
  lines.push('Résumé de la timeline :')
  lines.push(draft.timelineSummary)
  lines.push('')
  lines.push('—')
  lines.push('Cette notification a été générée par LogSOC War Room.')
  return lines.join('\n')
}

/** Generate the default subject for a notification template. */
export function generateSubject(template: NotificationTemplate): string {
  const authority = getAuthority(template)
  return `[${authority.legalReference}] Notification d'incident — ${authority.name}`
}

/**
 * Generate a pre-filled draft from crisis context (local fallback).
 * Used when the backend generate endpoint is not available (404).
 */
export function generateLocalDraft(
  template: NotificationTemplate,
  crisisContext: Record<string, unknown>,
): NotificationDraft {
  const authority = getAuthority(template)
  const now = new Date().toISOString()

  const draft: NotificationDraft = {
    template,
    authority,
    subject: generateSubject(template),
    to: authority.email,
    cc: '',
    detectionTime: String(crisisContext.created_at ?? crisisContext.started_at ?? now),
    affectedAssets: String(crisisContext.affected_assets ?? crisisContext.assets ?? ''),
    description: String(crisisContext.description ?? crisisContext.title ?? ''),
    measuresTaken: String(crisisContext.measures_taken ?? ''),
    timelineSummary: String(crisisContext.timeline_summary ?? ''),
    organizationName: String(crisisContext.organization_name ?? ''),
    organizationCountry: String(crisisContext.country ?? ''),
    rssiContact: String(crisisContext.rssi_contact ?? crisisContext.rssi ?? ''),
    body: '',
  }
  draft.body = generateEmailBody(draft)
  return draft
}

/** Normalize an API response into a NotificationDraft. */
export function normalizeNotificationDraft(
  raw: Record<string, unknown>,
  template: NotificationTemplate,
): NotificationDraft {
  const authority = getAuthority(template)
  const draft: NotificationDraft = {
    template,
    authority,
    subject: String(raw.subject ?? generateSubject(template)),
    to: String(raw.to ?? authority.email),
    cc: String(raw.cc ?? ''),
    detectionTime: String(raw.detection_time ?? raw.detectionTime ?? new Date().toISOString()),
    affectedAssets: String(raw.affected_assets ?? raw.affectedAssets ?? ''),
    description: String(raw.description ?? ''),
    measuresTaken: String(raw.measures_taken ?? raw.measuresTaken ?? ''),
    timelineSummary: String(raw.timeline_summary ?? raw.timelineSummary ?? ''),
    organizationName: String(raw.organization_name ?? raw.organizationName ?? ''),
    organizationCountry: String(raw.country ?? raw.organizationCountry ?? ''),
    rssiContact: String(raw.rssi_contact ?? raw.rssiContact ?? raw.rssi ?? ''),
    body: '',
  }
  draft.body = String(raw.body ?? generateEmailBody(draft))
  return draft
}

/** Crisis Notification API client. */
export const crisisNotificationApi = {
  /** AI-generate a pre-filled draft from crisis context. */
  generate: (crisisId: number, template: string) =>
    api.post(`/api/v1/crisis/${crisisId}/notifications/generate`, { template }),

  /** Send a notification via SMTP. */
  send: (crisisId: number, payload: SendNotificationPayload) =>
    api.post(`/api/v1/crisis/${crisisId}/notifications`, payload),

  /** Preview the email that will be sent (server-side rendering). */
  preview: (crisisId: number, payload: SendNotificationPayload) =>
    api.post(`/api/v1/crisis/${crisisId}/notifications/preview`, payload),
}

/** Validate a notification draft. Returns an object of field → error message. */
export function validateDraft(draft: NotificationDraft): Partial<Record<keyof NotificationDraft, string>> {
  const errors: Partial<Record<keyof NotificationDraft, string>> = {}
  if (draft.description.trim().length < VALIDATION_MIN_LENGTHS.description) {
    errors.description = `validation.min_${VALIDATION_MIN_LENGTHS.description}`
  }
  if (draft.measuresTaken.trim().length < VALIDATION_MIN_LENGTHS.measuresTaken) {
    errors.measuresTaken = `validation.min_${VALIDATION_MIN_LENGTHS.measuresTaken}`
  }
  return errors
}

export type { SendNotificationResult }