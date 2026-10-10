/**
 * Vitest tests for the countdown logic.
 * Ticket #48 — Sentinelles temporelles.
 *
 * Tests the computeCountdown function (pure, no React) for the
 * green → orange → red threshold transitions.
 */
import { describe, it, expect } from 'vitest'
import { computeCountdown, formatRemaining } from '../useCountdown'

describe('computeCountdown', () => {
  const TOTAL_MS = 24 * 3600_000 // 24h
  const START = Date.parse('2026-06-24T00:00:00Z')
  const DEADLINE = START + TOTAL_MS

  it('returns green status when >50% remaining', () => {
    // 75% remaining = 18h left → now = start + 6h
    const now = START + 6 * 3600_000
    const result = computeCountdown(DEADLINE, TOTAL_MS, now)
    expect(result.expired).toBe(false)
    expect(result.percentRemaining).toBeGreaterThan(50)
    expect(result.status).toBe('green')
  })

  it('returns orange status when 25-50% remaining', () => {
    // 37.5% remaining = 9h left → now = start + 15h
    const now = START + 15 * 3600_000
    const result = computeCountdown(DEADLINE, TOTAL_MS, now)
    expect(result.expired).toBe(false)
    expect(result.percentRemaining).toBeLessThan(50)
    expect(result.percentRemaining).toBeGreaterThanOrEqual(25)
    expect(result.status).toBe('orange')
  })

  it('returns red status when <25% remaining', () => {
    // 12.5% remaining = 3h left → now = start + 21h
    const now = START + 21 * 3600_000
    const result = computeCountdown(DEADLINE, TOTAL_MS, now)
    expect(result.expired).toBe(false)
    expect(result.percentRemaining).toBeLessThan(25)
    expect(result.status).toBe('red')
  })

  it('returns red status and expired=true when deadline has passed', () => {
    // 1h past deadline
    const now = DEADLINE + 3600_000
    const result = computeCountdown(DEADLINE, TOTAL_MS, now)
    expect(result.expired).toBe(true)
    expect(result.remainingMs).toBe(0)
    expect(result.percentRemaining).toBe(0)
    expect(result.status).toBe('red')
  })

  it('returns green status with no expired when deadline is null', () => {
    const result = computeCountdown(null, TOTAL_MS, Date.now())
    expect(result.expired).toBe(false)
    expect(result.status).toBe('green')
    expect(result.remainingMs).toBe(0)
  })
})

describe('formatRemaining', () => {
  it('formats hours and minutes', () => {
    expect(formatRemaining(23 * 3600_000 + 59 * 60_000)).toBe('23h 59m')
  })

  it('formats minutes only when under 1 hour', () => {
    expect(formatRemaining(45 * 60_000)).toBe('45m')
  })

  it('formats seconds when under 1 minute', () => {
    expect(formatRemaining(30_000)).toBe('30s')
  })

  it('returns 0m when expired', () => {
    expect(formatRemaining(0)).toBe('0m')
  })
})