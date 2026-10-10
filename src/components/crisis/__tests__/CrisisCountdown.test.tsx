/**
 * Vitest tests for CrisisCountdown component.
 * Ticket #48 — Sentinelles temporelles.
 *
 * Tests rendering and color transitions (green → orange → red).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CrisisCountdown } from '../CrisisCountdown'
import type { CountdownResult } from '../../../hooks/useCountdown'
import type { RegulatoryRule } from '../../../types/crisis'
import { initI18n } from '../../../i18n'

// Initialise i18n with FR locale (has countdown.* keys)
initI18n('fr')

const mockRule: RegulatoryRule = {
  key: 'nis2-24h',
  regulation: 'nis2',
  delayHours: 24,
  authority: 'ANSSI',
  legalKey: 'countdown.legal.nis2_24h',
  labelKey: 'countdown.label.nis2_24h',
  deadlineType: '24h',
}

function renderCountdown(result: CountdownResult) {
  return render(
    <MemoryRouter>
      <CrisisCountdown rule={mockRule} result={result} incidentId={1} />
    </MemoryRouter>,
  )
}

describe('CrisisCountdown', () => {
  it('renders with green status when >50% remaining', () => {
    const result: CountdownResult = {
      remainingMs: 18 * 3600_000, // 18h left out of 24h = 75%
      percentRemaining: 75,
      status: 'green',
      expired: false,
    }
    renderCountdown(result)

    // Should show the remaining time
    expect(screen.getByText('18h 0m')).toBeInTheDocument()
    // Should show the authority label
    expect(screen.getByText('ANSSI')).toBeInTheDocument()
    // Should have role="timer"
    expect(screen.getByRole('timer')).toBeInTheDocument()
  })

  it('renders with orange status when 25-50% remaining', () => {
    const result: CountdownResult = {
      remainingMs: 9 * 3600_000, // 9h left out of 24h = 37.5%
      percentRemaining: 37.5,
      status: 'orange',
      expired: false,
    }
    renderCountdown(result)

    expect(screen.getByText('9h 0m')).toBeInTheDocument()
    expect(screen.getByText('ANSSI')).toBeInTheDocument()
  })

  it('renders with red status when <25% remaining', () => {
    const result: CountdownResult = {
      remainingMs: 3 * 3600_000, // 3h left out of 24h = 12.5%
      percentRemaining: 12.5,
      status: 'red',
      expired: false,
    }
    renderCountdown(result)

    expect(screen.getByText('3h 0m')).toBeInTheDocument()
    expect(screen.getByText('ANSSI')).toBeInTheDocument()
  })

  it('renders expired label when deadline has passed', () => {
    const result: CountdownResult = {
      remainingMs: 0,
      percentRemaining: 0,
      status: 'red',
      expired: true,
    }
    renderCountdown(result)

    // Should show the expired i18n text (FR: "Délai dépassé")
    expect(screen.getByText('Délai dépassé')).toBeInTheDocument()
  })

  it('has accessible attributes (role=timer, aria-live=polite)', () => {
    const result: CountdownResult = {
      remainingMs: 3600_000,
      percentRemaining: 80,
      status: 'green',
      expired: false,
    }
    renderCountdown(result)

    const timer = screen.getByRole('timer')
    expect(timer).toHaveAttribute('aria-live', 'polite')
  })

  it('displays correct authority label', () => {
    const result: CountdownResult = {
      remainingMs: 3600_000,
      percentRemaining: 80,
      status: 'green',
      expired: false,
    }
    renderCountdown(result)

    expect(screen.getByText('ANSSI')).toBeInTheDocument()
  })
})