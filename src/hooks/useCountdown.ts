/**
 * useCountdown — real-time countdown hook for War Room regulatory sentinels.
 * Ticket #48 — Sentinelles temporelles.
 *
 * Features:
 * - Single shared setInterval via useSharedTick (all countdowns use one timer)
 * - Returns { remainingMs, percentRemaining, status, expired }
 * - status: 'green' (>50%), 'orange' (25-50%), 'red' (<25% or expired)
 * - Updates every 1 second
 */
import { useSyncExternalStore } from 'react'

/** Countdown status based on percentage remaining. */
export type CountdownStatus = 'green' | 'orange' | 'red'

export interface CountdownResult {
  /** Remaining milliseconds (0 if expired). */
  remainingMs: number
  /** Percentage remaining (0-100). */
  percentRemaining: number
  /** Status: green >50%, orange 25-50%, red <25% or expired. */
  status: CountdownStatus
  /** Whether the deadline has passed. */
  expired: boolean
}

// ── Shared tick store (single setInterval for all countdowns) ──

let tickListeners: (() => void)[] = []
let tickInterval: ReturnType<typeof setInterval> | null = null
let currentTick = Date.now()

function subscribeTick(listener: () => void): () => void {
  tickListeners = [...tickListeners, listener]
  if (tickInterval === null) {
    tickInterval = setInterval(() => {
      currentTick = Date.now()
      for (const l of tickListeners) l()
    }, 1000)
  }
  return () => {
    tickListeners = tickListeners.filter((l) => l !== listener)
    if (tickListeners.length === 0 && tickInterval !== null) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }
}

function getTickSnapshot(): number {
  return currentTick
}

/**
 * Hook to subscribe to the shared 1-second tick.
 * Returns the current timestamp, updated every second.
 * Only one setInterval runs regardless of how many countdowns are mounted.
 */
export function useSharedTick(): number {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickSnapshot)
}

/**
 * Compute countdown result from a deadline timestamp and total duration.
 *
 * @param deadlineMs — epoch milliseconds of the deadline (null = no deadline yet)
 * @param totalMs — total duration of the countdown (e.g. 24h = 86400000)
 * @param now — current timestamp (from useSharedTick)
 * @returns countdown result with remainingMs, percentRemaining, status, expired
 */
export function computeCountdown(
  deadlineMs: number | null,
  totalMs: number,
  now: number,
): CountdownResult {
  if (deadlineMs === null) {
    return { remainingMs: 0, percentRemaining: 0, status: 'green', expired: false }
  }

  const remainingMs = Math.max(0, deadlineMs - now)
  const percentRemaining = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0
  const expired = remainingMs === 0

  let status: CountdownStatus = 'green'
  if (expired || percentRemaining < 25) {
    status = 'red'
  } else if (percentRemaining < 50) {
    status = 'orange'
  }

  return { remainingMs, percentRemaining, status, expired }
}

/**
 * Format remaining milliseconds as `Xh Ym` (or `Ym`, or `Xs` if under a minute).
 * Used for display in countdown chips.
 */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return '0m'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  const seconds = totalSeconds % 60
  return `${seconds}s`
}