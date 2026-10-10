/**
 * useThresholdToasts — fires toasts when countdown crosses threshold boundaries.
 * Ticket #48 — Sentinelles temporelles.
 *
 * Fires:
 * - warning toast when percentRemaining drops below 50% (first crossing)
 * - critical toast when percentRemaining drops below 25% (first crossing)
 * - critical toast when deadline is exceeded (expired)
 *
 * Each threshold fires only once per mount to avoid spam.
 */
import { useRef, useCallback } from 'react'
import type { CountdownResult } from './useCountdown'

interface ThresholdToastOptions {
  /** i18n label for the countdown (e.g. "NIS2 24h"). */
  label: string
  /** Authority label (e.g. ANSSI). */
  authority: string
}

interface ToastFn {
  (type: 'success' | 'error' | 'warning' | 'info', message: string): void
}

/**
 * Fire toasts at threshold crossings.
 * Returns a function to call on every tick with the current countdown result.
 */
export function useThresholdToasts(
  toast: ToastFn,
  t: (key: string, params?: Record<string, string | number>) => string,
  opts: ThresholdToastOptions,
) {
  const fired50 = useRef(false)
  const fired25 = useRef(false)
  const firedExpired = useRef(false)

  return useCallback(
    (result: CountdownResult) => {
      if (result.expired && !firedExpired.current) {
        firedExpired.current = true
        toast('error', t('countdown.toastExpired', { label: opts.label, authority: opts.authority }))
        return
      }
      if (result.percentRemaining < 25 && !result.expired && !fired25.current) {
        fired25.current = true
        toast('warning', t('countdown.toastCritical', { label: opts.label, authority: opts.authority }))
        return
      }
      if (result.percentRemaining < 50 && result.percentRemaining >= 25 && !fired50.current) {
        fired50.current = true
        toast('warning', t('countdown.toastWarning', { label: opts.label, authority: opts.authority }))
      }
    },
    [toast, t, opts.label, opts.authority],
  )
}