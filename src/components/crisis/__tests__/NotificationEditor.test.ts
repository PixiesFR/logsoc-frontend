/**
 * Vitest tests for crisisNotificationService + validation + local fallback.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Tests:
 * 1. normalizeTemplate maps 'gdpr' → 'rgpd'
 * 2. generateLocalDraft produces a pre-filled draft with authority
 * 3. validateDraft rejects short description and measures
 * 4. generateEmailBody contains all key fields
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeTemplate,
  generateLocalDraft,
  validateDraft,
  generateEmailBody,
  getAuthority,
} from '../../../services/crisisNotificationService'
import type { NotificationDraft } from '../../../types/notification'

describe('normalizeTemplate', () => {
  it('returns "nis2" for unknown values', () => {
    expect(normalizeTemplate('unknown')).toBe('nis2')
  })

  it('maps "gdpr" to "rgpd" (countdown regulation field)', () => {
    expect(normalizeTemplate('gdpr')).toBe('rgpd')
  })

  it('passes through valid templates', () => {
    expect(normalizeTemplate('nis2')).toBe('nis2')
    expect(normalizeTemplate('rgpd')).toBe('rgpd')
    expect(normalizeTemplate('dora')).toBe('dora')
    expect(normalizeTemplate('nis2_1m')).toBe('nis2_1m')
  })
})

describe('getAuthority', () => {
  it('returns ANSSI for nis2', () => {
    const auth = getAuthority('nis2')
    expect(auth.code).toBe('ANSSI')
    expect(auth.legalReference).toBe('NIS2 Art.32')
  })

  it('returns CNIL for rgpd', () => {
    const auth = getAuthority('rgpd')
    expect(auth.code).toBe('CNIL')
    expect(auth.legalReference).toBe('RGPD Art.33')
  })

  it('returns DORA Joint Committee for dora', () => {
    const auth = getAuthority('dora')
    expect(auth.legalReference).toBe('DORA Art.19')
  })
})

describe('generateLocalDraft', () => {
  it('produces a draft with authority and pre-filled fields from crisis context', () => {
    const context = {
      created_at: '2026-06-24T10:00:00Z',
      title: 'Ransomware attack on SRV-01',
      affected_assets: 'SRV-01, SRV-03',
      description: 'Ransomware detected on file servers',
      measures_taken: 'Isolated affected machines, activated incident response plan',
      timeline_summary: 'Detection at 10:00, containment at 10:15',
      organization_name: 'ACME Corp',
      country: 'France',
      rssi_contact: 'John Doe (jdoe@acme.com)',
    }
    const draft = generateLocalDraft('nis2', context)
    expect(draft.template).toBe('nis2')
    expect(draft.authority.code).toBe('ANSSI')
    expect(draft.detectionTime).toBe('2026-06-24T10:00:00Z')
    expect(draft.affectedAssets).toBe('SRV-01, SRV-03')
    expect(draft.organizationName).toBe('ACME Corp')
    expect(draft.organizationCountry).toBe('France')
    expect(draft.rssiContact).toBe('John Doe (jdoe@acme.com)')
    expect(draft.body).toContain('NIS2 Art.32')
    expect(draft.body).toContain('ACME Corp')
    expect(draft.body).toContain('Ransomware detected on file servers')
  })

  it('falls back to empty strings for missing context fields', () => {
    const draft = generateLocalDraft('rgpd', {})
    expect(draft.template).toBe('rgpd')
    expect(draft.authority.code).toBe('CNIL')
    expect(draft.affectedAssets).toBe('')
    expect(draft.organizationName).toBe('')
  })
})

describe('validateDraft', () => {
  const validDraft: NotificationDraft = {
    template: 'nis2',
    authority: getAuthority('nis2'),
    subject: 'Test subject',
    to: 'test@example.com',
    cc: '',
    detectionTime: '2026-06-24T10:00:00Z',
    affectedAssets: 'SRV-01',
    description: 'A'.repeat(50),
    measuresTaken: 'B'.repeat(30),
    timelineSummary: '',
    organizationName: 'ACME',
    organizationCountry: 'FR',
    rssiContact: 'test@test.com',
    body: '',
  }

  it('returns no errors when description ≥ 50 and measures ≥ 30', () => {
    const errors = validateDraft(validDraft)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error for short description', () => {
    const errors = validateDraft({ ...validDraft, description: 'short' })
    expect(errors.description).toBeDefined()
  })

  it('returns error for short measures', () => {
    const errors = validateDraft({ ...validDraft, measuresTaken: 'short' })
    expect(errors.measuresTaken).toBeDefined()
  })

  it('trims whitespace before checking length', () => {
    const errors = validateDraft({
      ...validDraft,
      description: '   '.repeat(50),
      measuresTaken: '   '.repeat(30),
    })
    expect(errors.description).toBeDefined()
    expect(errors.measuresTaken).toBeDefined()
  })
})

describe('generateEmailBody', () => {
  it('contains legal reference, organization, and all key fields', () => {
    const draft = {
      template: 'nis2' as const,
      authority: getAuthority('nis2'),
      subject: 'Test',
      to: 'test@example.com',
      cc: '',
      detectionTime: '2026-06-24T10:00:00Z',
      affectedAssets: 'SRV-01, SRV-02',
      description: 'Incident description here',
      measuresTaken: 'Isolated machines',
      timelineSummary: 'Timeline summary',
      organizationName: 'ACME Corp',
      organizationCountry: 'France',
      rssiContact: 'John Doe',
    }
    const body = generateEmailBody(draft)
    expect(body).toContain('NIS2 Art.32')
    expect(body).toContain('ANSSI')
    expect(body).toContain('ACME Corp')
    expect(body).toContain('France')
    expect(body).toContain('John Doe')
    expect(body).toContain('2026-06-24T10:00:00Z')
    expect(body).toContain('SRV-01, SRV-02')
    expect(body).toContain('Incident description here')
    expect(body).toContain('Isolated machines')
    expect(body).toContain('Timeline summary')
    expect(body).toContain('LogSOC War Room')
  })
})