/**
 * Crisis Timeline types.
 * Ticket #44 — War Room Timeline de crise verrouillée (zone gauche).
 */

/** Entry type: user action or automatic system entry (eBPF, incident status). */
export type TimelineEntryType = 'user' | 'system'

/** A single timeline entry — the locked journal of record for crisis management. */
export interface TimelineEntry {
  id: string
  /** ISO 8601 timestamp */
  timestamp: string
  /** Author display name */
  author: string
  /** Author role (e.g. analyst, admin) */
  authorRole: string
  /** Entry content (lightweight markdown allowed) */
  content: string
  /** Whether the entry is locked (immutable after lock) */
  locked: boolean
  /** Entry origin: manual user input or automatic system event */
  type: TimelineEntryType
  /** Optional system source label (eBPF, incident_status, auto_trigger) */
  systemSource?: string
}

/** WebSocket messages received on the crisis:{incidentId} channel. */
export type CrisisWebSocketMessage =
  | { type: 'entry_added'; entry: TimelineEntry }
  | { type: 'entry_locked'; entry_id: string }
  | { type: 'incident_status'; status: string }
  | { type: 'task_checked'; task_id: number; checked_by: number; checked_by_name: string; checked_at: string }
  | { type: 'task_unchecked'; task_id: number }

// ── Crisis Checklist (ticket #45) ──

/** Priority levels ordered from highest to lowest urgency. */
export type ChecklistPriority = 'CRITIQUE' | 'HAUTE' | 'MOYENNE' | 'BAS'

/** Ordered list of priorities from most to least urgent. Used for sorting. */
export const PRIORITY_ORDER: ChecklistPriority[] = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'BAS']

/**
 * A single reflex checklist task — contextual to the crisis type
 * (ransomware / phishing / intrusion).
 */
export interface ChecklistTask {
  id: number
  /** Task label / instruction. */
  text: string
  /** Priority level for sorting and visual emphasis. */
  priority: ChecklistPriority
  /** User or role the task is assigned to. */
  assignedTo: string
  /** Whether the task has been checked off. */
  checked: boolean
  /** User ID of the person who checked the task (null if unchecked). */
  checkedBy: number | null
  /** Display name of the person who checked the task. */
  checkedByName: string | null
  /** ISO 8601 timestamp when the task was checked (null if unchecked). */
  checkedAt: string | null
}

/** Payload for checking a checklist task. */
export interface CheckTaskPayload {
  user_id: number
}

/** Payload to create a new timeline entry. */
export interface CreateTimelineEntryPayload {
  content: string
  type?: TimelineEntryType
}

/** Lock timeout in milliseconds before an unlocked entry auto-locks. */
export const LOCK_TIMEOUT_MS = 60_000

// ── Crisis Contacts (ticket #46) ──

/** Contact categories for the crisis directory (War Room zone droite). */
export type ContactCategory = 'interne' | 'juridique' | 'assurance' | 'autorites'

/** Ordered list of categories for consistent display. */
export const CATEGORY_ORDER: ContactCategory[] = ['interne', 'juridique', 'assurance', 'autorites']

/**
 * A single crisis contact — displayed in the War Room right zone (annuaire).
 * Ticket #54 — extended fields: first_name, last_name, phone_pro, phone_astreinte, mobile, priority, available_24_7, notes
 */
export interface CrisisContact {
  /** Unique identifier. */
  id: number
  /** First name. */
  first_name: string
  /** Last name. */
  last_name: string
  /** Full display name (backward compat — "first_name last_name"). */
  name: string
  /** Role or function (e.g. DPO, RSSI, avocat). */
  role: string
  /** Office phone (jours ouvrés). */
  phone_pro: string
  /** On-call phone (astreinte — hors heures, le numéro qui sonne à 3h). */
  phone_astreinte: string
  /** Mobile phone. */
  mobile: string
  /** Backward compat phone (alias for phone_pro). */
  phone: string
  /** Email address. */
  email: string
  /** Organization name (optional). */
  organization?: string
  /** Category for grouping. */
  category: ContactCategory
  /** Whether this contact is high-priority (badge shown). */
  priority: boolean
  /** Whether this contact is available 24/7. */
  available_24_7: boolean
  /** Free-form notes (e.g. "Ne pas appeler après 22h, préférer SMS"). */
  notes?: string
}

// ── Crisis Countdown (ticket #48 — Sentinelles temporelles) ──

/** Countdown status: green >50%, orange 25-50%, red <25% or expired. */
export type CountdownStatus = 'green' | 'orange' | 'red'

/** Result of a countdown computation. */
export interface Countdown {
  /** Remaining milliseconds (0 if expired). */
  remainingMs: number
  /** Percentage remaining (0-100). */
  percentRemaining: number
  /** Status based on thresholds. */
  status: CountdownStatus
  /** Whether the deadline has passed. */
  expired: boolean
}

/** A regulatory deadline rule (NIS2, RGPD, DORA). */
export interface RegulatoryRule {
  /** Unique key identifying the rule. */
  key: string
  /** Regulation slug for notification routing. */
  regulation: string
  /** Delay in hours from incident start to deadline. */
  delayHours: number
  /** Authority label (uppercase, displayed as-is). */
  authority: string
  /** i18n key for the legal tooltip text. */
  legalKey: string
  /** i18n key for the countdown label. */
  labelKey: string
  /** Notification deadline_type parameter. */
  deadlineType: string
}

// ── Crisis Vault (ticket #47) ──

/** Document types for icon selection in the vault. */
export type VaultDocType = 'pdf' | 'vcard' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'img' | 'other'

/**
 * A single document in the crisis vault — displayed in the War Room right zone.
 */
export interface VaultDocument {
  /** Unique identifier. */
  id: number
  /** Filename or document title. */
  filename: string
  /** Document type for icon selection. */
  type: VaultDocType
  /** File size in bytes (optional). */
  size?: number
  /** MIME type (optional). */
  mimeType?: string
  /** Human-readable description (optional). */
  description?: string
  /** ISO 8601 upload timestamp (optional). */
  uploadedAt?: string
}