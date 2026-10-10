/**
 * Crisis Service — API calls for incident qualification and crisis mode.
 * Used by the QualificationModal before entering War Room.
 */
import { crisisApi } from '../api'

export interface QualifyResult {
  significant: boolean
  incidentId: number
  /** Optional crisis token returned by backend for vault access. */
  crisisToken?: string
}

/**
 * Qualify an incident as significant (triggers regulatory protocol).
 * POST /api/v1/incidents/:id/qualify { significant: true }
 */
export async function qualifyIncident(
  incidentId: number,
  significant: boolean,
): Promise<QualifyResult> {
  const res = await crisisApi.qualify(incidentId, { significant })
  const raw = (res.data ?? {}) as Record<string, unknown>
  return {
    significant: Boolean(raw.significant ?? significant),
    incidentId,
    crisisToken: raw.crisis_token != null ? String(raw.crisis_token) : undefined,
  }
}

/**
 * Mark an incident as not significant (PATCH status + close).
 */
export async function markNotSignificant(
  incidentId: number,
): Promise<void> {
  await crisisApi.updateStatus(incidentId, {
    status: 'closed',
    qualification: 'not_significant',
  })
}