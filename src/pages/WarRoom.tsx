/**
 * WarRoomPage — route component for /crisis/:incidentId
 *
 * Ticket #51 — War Room shell mode crise (CDC Part6 §24.1+24.8).
 * Wraps CrisisShell with CrisisThemeProvider so the deep-dark crisis theme
 * is applied when this route is active.
 */
import { CrisisShell } from '../components/crisis/CrisisShell'
import { CrisisThemeProvider } from '../components/crisis/CrisisThemeProvider'

export function WarRoomPage() {
  return (
    <CrisisThemeProvider>
      <CrisisShell />
    </CrisisThemeProvider>
  )
}