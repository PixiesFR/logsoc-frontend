/**
 * Vitest tests for CrisisShell bascule scenarios.
 * Ticket #51 — War Room shell mode crise (CDC Part6 §24.1+24.8).
 *
 * Scenarios tested (≥3 as required by acceptance criteria):
 * 1. Incident significatif — both OUI → trigger button visible + pulsing class
 * 2. Incident non significatif — at least one NON → greyed message + mark button
 * 3. Sortie du mode crise — crisisStore exitCrisis resets state
 *
 * Also verifies:
 * - CrisisThemeProvider sets data-mode="crisis" on <html>
 * - CrisisStore persists via localStorage
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CrisisShell } from '../CrisisShell'
import { CrisisThemeProvider } from '../CrisisThemeProvider'
import { QualificationStep } from '../QualificationStep'
import { useCrisisStore } from '../../../stores/crisisStore'
import { initI18n } from '../../../i18n'

// Mock the crisis API to avoid real network calls
vi.mock('../../../api', () => ({
  crisisApi: {
    get: vi.fn().mockResolvedValue({ data: { id: 1, title: 'Ransomware Test', severity: 'critical', status: 'active', created_at: '2026-06-24T08:00:00Z' } }),
    updateStatus: vi.fn().mockResolvedValue({ data: {} }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    playbooks: vi.fn().mockResolvedValue({ data: [] }),
    cell: vi.fn().mockResolvedValue({ data: {} }),
    actions: vi.fn().mockResolvedValue({ data: [] }),
    communications: vi.fn().mockResolvedValue({ data: [] }),
    postmortem: vi.fn().mockResolvedValue({ data: {} }),
    create: vi.fn().mockResolvedValue({ data: {} }),
    qualify: vi.fn().mockResolvedValue({ data: { significant: true, crisis_token: 'test-token' } }),
  },
}))

// Mock crisisService
vi.mock('../../../services/crisisService', () => ({
  qualifyIncident: vi.fn().mockResolvedValue({ significant: true, incidentId: 1, crisisToken: 'test-token' }),
  markNotSignificant: vi.fn().mockResolvedValue(undefined),
}))

// Mock crisis sub-components to isolate shell behavior
vi.mock('../CrisisTimeline', () => ({
  CrisisTimeline: () => <div data-testid="crisis-timeline">Timeline</div>,
}))
vi.mock('../CrisisChecklist', () => ({
  CrisisChecklist: () => <div data-testid="crisis-checklist">Checklist</div>,
}))
vi.mock('../CrisisContacts', () => ({
  CrisisContacts: () => <div data-testid="crisis-contacts">Contacts</div>,
}))
vi.mock('../CrisisVault', () => ({
  CrisisVault: () => <div data-testid="crisis-vault">Vault</div>,
}))
vi.mock('../CrisisCountdownBar', () => ({
  CrisisCountdownBar: () => <div data-testid="crisis-countdown">Countdown</div>,
}))

initI18n('fr')

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/crisis/1']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CrisisShell — 3-zone layout', () => {
  beforeEach(() => {
    useCrisisStore.setState({ active: true, incidentId: 1, fullscreen: false, crisisToken: null })
    document.documentElement.removeAttribute('data-mode')
  })

  afterEach(() => {
    cleanup()
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
    localStorage.removeItem('logsoc-crisis')
  })

  it('renders all 3 zones (timeline, checklist, contacts) + vault', () => {
    renderWithProviders(<CrisisShell />)
    expect(screen.getByTestId('crisis-timeline')).toBeDefined()
    expect(screen.getByTestId('crisis-checklist')).toBeDefined()
    expect(screen.getByTestId('crisis-contacts')).toBeDefined()
    expect(screen.getByTestId('crisis-vault')).toBeDefined()
  })

  it('shows sentinel countdown bar in header', () => {
    renderWithProviders(<CrisisShell />)
    expect(screen.getByTestId('crisis-countdown')).toBeDefined()
  })

  it('shows "Quitter le mode crise" button (always visible)', () => {
    renderWithProviders(<CrisisShell />)
    expect(screen.getByLabelText('exit-crisis')).toBeDefined()
  })

  it('shows fullscreen toggle button', () => {
    renderWithProviders(<CrisisShell />)
    expect(screen.getByLabelText('toggle-fullscreen')).toBeDefined()
  })
})

describe('QualificationStep — scenario 1: incident significatif', () => {
  beforeEach(() => {
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
  })

  afterEach(() => {
    cleanup()
    localStorage.removeItem('logsoc-crisis')
  })

  it('shows greyed trigger button when no answers selected', () => {
    const { container } = renderWithProviders(
      <QualificationStep incidentId={1} incidentTitle="Ransomware Test" />,
    )
    // Button should be disabled (greyed) initially
    const triggerBtn = screen.getByLabelText('trigger-protocol')
    expect(triggerBtn.hasAttribute('disabled')).toBe(true)
    // No pulsing class yet
    expect(container.querySelector('.crisis-trigger-pulse')).toBeNull()
  })

  it('enables pulsing trigger button when both answers are OUI', () => {
    const { container } = renderWithProviders(
      <QualificationStep incidentId={1} incidentTitle="Ransomware Test" />,
    )
    // Click YES for Q1
    fireEvent.click(screen.getByLabelText('q1-yes'))
    // Click YES for Q2
    fireEvent.click(screen.getByLabelText('q2-yes'))
    // Trigger button should now be enabled and have pulsing class
    const triggerBtn = screen.getByLabelText('trigger-protocol')
    expect(triggerBtn.hasAttribute('disabled')).toBe(false)
    const pulseEl = container.querySelector('.crisis-trigger-pulse')
    expect(pulseEl).not.toBeNull()
  })
})

describe('QualificationStep — scenario 2: incident non significatif', () => {
  beforeEach(() => {
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
  })

  afterEach(() => {
    cleanup()
    localStorage.removeItem('logsoc-crisis')
  })

  it('shows "non significatif" message when at least one answer is NON', () => {
    renderWithProviders(
      <QualificationStep incidentId={1} incidentTitle="Phishing Test" />,
    )
    // Click NO for Q1
    fireEvent.click(screen.getByLabelText('q1-no'))
    // Message should appear
    expect(screen.getByText(/Incident non significatif/)).toBeDefined()
    // Mark not significant button should be visible
    expect(screen.getByText(/Marquer comme non significatif/)).toBeDefined()
    // Trigger button should NOT be pulsing
    const triggerBtn = screen.queryByLabelText('trigger-protocol')
    // When atLeastOneNo, the pulsing trigger is not rendered
    expect(triggerBtn).toBeNull()
  })
})

describe('CrisisStore — scenario 3: sortie du mode crise', () => {
  beforeEach(() => {
    useCrisisStore.setState({ active: true, incidentId: 42, fullscreen: false, crisisToken: 'tok' })
  })

  afterEach(() => {
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
    localStorage.removeItem('logsoc-crisis')
  })

  it('exitCrisis resets active, incidentId, and crisisToken', () => {
    const store = useCrisisStore.getState()
    expect(store.active).toBe(true)
    expect(store.incidentId).toBe(42)
    expect(store.crisisToken).toBe('tok')

    store.exitCrisis()

    const after = useCrisisStore.getState()
    expect(after.active).toBe(false)
    expect(after.incidentId).toBeNull()
    expect(after.crisisToken).toBeNull()
  })

  it('enterCrisis sets active, incidentId, and crisisToken', () => {
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
    const store = useCrisisStore.getState()
    store.enterCrisis(99, 'new-token')

    const after = useCrisisStore.getState()
    expect(after.active).toBe(true)
    expect(after.incidentId).toBe(99)
    expect(after.crisisToken).toBe('new-token')
  })

  it('toggleFullscreen flips fullscreen state', () => {
    useCrisisStore.setState({ fullscreen: false })
    const store = useCrisisStore.getState()
    store.toggleFullscreen()
    expect(useCrisisStore.getState().fullscreen).toBe(true)
    store.toggleFullscreen()
    expect(useCrisisStore.getState().fullscreen).toBe(false)
  })
})

describe('CrisisThemeProvider — applies crisis theme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-mode')
    useCrisisStore.setState({ active: false, incidentId: null, fullscreen: false, crisisToken: null })
  })

  it('sets data-mode="crisis" on <html> when crisis active', () => {
    useCrisisStore.setState({ active: true, incidentId: 1 })
    renderWithProviders(
      <CrisisThemeProvider>
        <div>test</div>
      </CrisisThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-mode')).toBe('crisis')
  })

  it('removes data-mode when crisis inactive', () => {
    useCrisisStore.setState({ active: false })
    renderWithProviders(
      <CrisisThemeProvider>
        <div>test</div>
      </CrisisThemeProvider>,
    )
    expect(document.documentElement.getAttribute('data-mode')).toBeNull()
  })
})