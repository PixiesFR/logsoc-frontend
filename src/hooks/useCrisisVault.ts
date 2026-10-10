/**
 * useCrisisVault — hook for fetching crisis vault documents.
 * Ticket #47 — Coffre-fort documentaire (zone droite, documents).
 *
 * Features:
 * - Fetches documents via crisisVaultApi.list() with X-Crisis-Token header
 * - 4 states: loading / ok / empty / error
 * - Handles 401/403 (token expired) and 404 (no documents) gracefully
 * - No refetch on every render (5 min stale time)
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crisisVaultApi, normalizeVaultDocument } from '../services/crisisVaultService'
import type { VaultDocument } from '../types/crisis'

/** Cache duration: 5 minutes (in milliseconds). */
const CACHE_STALE_TIME = 5 * 60 * 1000

/** State machine for vault content. */
export type VaultState = 'loading' | 'ok' | 'empty' | 'tokenExpired' | 'tokenMissing' | 'error'

interface UseCrisisVaultReturn {
  documents: VaultDocument[]
  state: VaultState
  isLoading: boolean
  error: unknown
}

export function useCrisisVault(crisisToken: string | null): UseCrisisVaultReturn {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['crisis', 'vault', crisisToken ?? 'no-token'],
    queryFn: () => {
      if (!crisisToken) {
        return Promise.reject(new Error('NO_TOKEN'))
      }
      return crisisVaultApi.list(crisisToken).then((r) => r.data)
    },
    enabled: !!crisisToken,
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_STALE_TIME,
    retry: false,
  })

  // Normalize raw API response into VaultDocument[]
  const documents = useMemo<VaultDocument[]>(() => {
    if (!rawData) return []
    const list = Array.isArray(rawData)
      ? rawData
      : ((rawData as Record<string, unknown>)?.documents ?? (rawData as Record<string, unknown>)?.vault ?? [])
    return (list as Record<string, unknown>[]).map(normalizeVaultDocument)
  }, [rawData])

  // Derive vault state from loading / error / data
  const state = useMemo<VaultState>(() => {
    if (isLoading) return 'loading'
    if (!crisisToken) return 'tokenMissing'
    if (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) return 'tokenExpired'
      if (status === 404) return 'empty'
      const errMsg = (error as Error)?.message
      if (errMsg === 'NO_TOKEN') return 'tokenMissing'
      return 'error'
    }
    if (documents.length === 0) return 'empty'
    return 'ok'
  }, [isLoading, error, crisisToken, documents.length])

  return {
    documents,
    state,
    isLoading,
    error,
  }
}