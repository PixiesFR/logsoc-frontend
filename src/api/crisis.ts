/**
 * Crisis Timeline API client.
 * Ticket #44 — endpoints for timeline CRUD, lock, and PDF export.
 *
 * Endpoints:
 *   GET    /api/v1/incidents/:id/crisis/timeline          — list entries
 *   POST   /api/v1/incidents/:id/crisis/timeline          — add entry
 *   PATCH  /api/v1/incidents/:id/crisis/timeline/:entryId/lock — lock entry
 *   GET    /api/v1/incidents/:id/crisis/timeline/export   — export PDF (binary)
 */
import { api } from './index'
import type { TimelineEntry, CreateTimelineEntryPayload } from '../types/crisis'
import type { ChecklistTask, CheckTaskPayload, ChecklistPriority } from '../types/crisis'
import type { CrisisContact, ContactCategory } from '../types/crisis'

export const crisisTimelineApi = {
  /** Fetch all timeline entries for an incident (chronological order). */
  list: (incidentId: number) =>
    api.get(`/api/v1/incidents/${incidentId}/crisis/timeline`),

  /** Add a new timeline entry. */
  add: (incidentId: number, payload: CreateTimelineEntryPayload) =>
    api.post(`/api/v1/incidents/${incidentId}/crisis/timeline`, payload),

  /** Lock a timeline entry (makes it immutable). */
  lock: (incidentId: number, entryId: string) =>
    api.patch(`/api/v1/incidents/${incidentId}/crisis/timeline/${entryId}/lock`),

  /** Export the full timeline as a PDF (binary response). */
  exportPdf: (incidentId: number) =>
    api.get(`/api/v1/incidents/${incidentId}/crisis/timeline/export`, {
      responseType: 'blob',
    }),
}

/** Type guard to normalize an arbitrary API response item into a TimelineEntry. */
export function normalizeTimelineEntry(raw: Record<string, unknown>): TimelineEntry {
  const type = String(raw.type ?? 'user') === 'system' ? 'system' : 'user'
  return {
    id: String(raw.id ?? raw.entry_id ?? crypto.randomUUID()),
    timestamp: String(raw.timestamp ?? raw.created_at ?? new Date().toISOString()),
    author: String(raw.author ?? raw.author_name ?? raw.username ?? '—'),
    authorRole: String(raw.author_role ?? raw.role ?? '—'),
    content: String(raw.content ?? raw.message ?? raw.text ?? ''),
    locked: Boolean(raw.locked ?? raw.is_locked ?? false),
    type,
    systemSource: raw.system_source != null ? String(raw.system_source) : undefined,
  }
}

export type { TimelineEntry, CreateTimelineEntryPayload }

// ── Crisis Checklist API (ticket #45) ──

/**
 * Crisis Checklist API client.
 * Ticket #45 — Checklist réflexe (zone centre).
 *
 * Endpoints:
 *   GET    /api/v1/crisis/:id/checklist           — list tasks + state
 *   POST   /api/v1/crisis/:id/checklist/:taskId/check   → body { user_id }
 *   POST   /api/v1/crisis/:id/checklist/:taskId/uncheck → body { user_id }
 *
 * WebSocket channel: crisis:{id} — events task_checked, task_unchecked
 */
export const crisisChecklistApi = {
  /** Fetch the reflex checklist for a crisis incident. */
  list: (crisisId: number) =>
    api.get(`/api/v1/crisis/${crisisId}/checklist`),

  /** Check a checklist task (mark as done). */
  check: (crisisId: number, taskId: number, payload: CheckTaskPayload) =>
    api.post(`/api/v1/crisis/${crisisId}/checklist/${taskId}/check`, payload),

  /** Uncheck a checklist task (mark as not done). */
  uncheck: (crisisId: number, taskId: number, payload: CheckTaskPayload) =>
    api.post(`/api/v1/crisis/${crisisId}/checklist/${taskId}/uncheck`, payload),
}

/** Valid priority strings accepted from the backend. */
const VALID_PRIORITIES = new Set(['CRITIQUE', 'HAUTE', 'MOYENNE', 'BAS'])

/**
 * Type guard that normalizes an arbitrary API response item into a ChecklistTask.
 * Handles missing fields, unknown priority values, and various key name conventions.
 */
export function normalizeChecklistTask(raw: Record<string, unknown>): ChecklistTask {
  const rawPriority = String(raw.priority ?? raw.severity ?? 'MOYENNE').toUpperCase()
  const priority = (VALID_PRIORITIES.has(rawPriority) ? rawPriority : 'MOYENNE') as ChecklistPriority

  return {
    id: Number(raw.id ?? raw.task_id ?? 0),
    text: String(raw.text ?? raw.label ?? raw.title ?? raw.description ?? ''),
    priority,
    assignedTo: String(raw.assigned_to ?? raw.assignee ?? raw.assignedTo ?? raw.role ?? ''),
    checked: Boolean(raw.checked ?? raw.done ?? raw.is_done ?? false),
    checkedBy: raw.checked_by != null ? Number(raw.checked_by) : null,
    checkedByName: raw.checked_by_name != null ? String(raw.checked_by_name) : null,
    checkedAt: raw.checked_at != null ? String(raw.checked_at) : null,
  }
}

export type { ChecklistTask, CheckTaskPayload, ChecklistPriority }

// ── Crisis Contacts API (ticket #46) ──

/**
 * Crisis Contacts API client.
 * Ticket #46 — Annuaire de crise (zone droite partie contacts).
 *
 * Endpoint:
 *   GET /api/v1/crisis/contacts?country=FR → { contacts: [...] }
 */
export const crisisContactsApi = {
  /** Fetch crisis contacts filtered by country code. */
  list: (country?: string) =>
    api.get('/api/v1/crisis/contacts', { params: country ? { country } : {} }),
}

/** Valid category strings accepted from the backend. */
const VALID_CATEGORIES = new Set(['interne', 'juridique', 'assurance', 'autorites'])

/**
 * Type guard that normalizes an arbitrary API response item into a CrisisContact.
 * Handles missing fields, unknown category values, and various key name conventions.
 * Ticket #54 — extended fields support.
 */
export function normalizeCrisisContact(raw: Record<string, unknown>): CrisisContact {
  const rawCategory = String(raw.category ?? 'interne').toLowerCase()
  const category = (VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'interne') as ContactCategory

  // Extended fields (ticket #54)
  const first_name = String(raw.first_name ?? '')
  const last_name = String(raw.last_name ?? '')
  const name = first_name || last_name
    ? `${first_name} ${last_name}`.trim()
    : String(raw.name ?? raw.full_name ?? raw.display_name ?? '—')

  const phone_pro = String(raw.phone_pro ?? raw.phone ?? raw.phone_number ?? raw.telephone ?? '')
  const phone_astreinte = String(raw.phone_astreinte ?? '')
  const mobile = String(raw.mobile ?? '')

  return {
    id: Number(raw.id ?? 0),
    first_name,
    last_name,
    name,
    role: String(raw.role ?? raw.function ?? raw.title ?? '—'),
    phone_pro,
    phone_astreinte,
    mobile,
    phone: phone_pro, // backward compat
    email: String(raw.email ?? raw.mail ?? ''),
    organization: raw.organization != null ? String(raw.organization) : undefined,
    category,
    priority: Boolean(raw.priority ?? raw.is_priority ?? raw.urgent ?? false),
    available_24_7: Boolean(raw.available_24_7 ?? raw.available247 ?? false),
    notes: raw.notes != null ? String(raw.notes) : undefined,
  }
}