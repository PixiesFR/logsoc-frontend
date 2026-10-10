/**
 * useCrisisContacts — fetch crisis contacts with 5 min cache + country filtering.
 * Ticket #46 — Annuaire de crise (zone droite partie contacts).
 *
 * Features:
 * - Fetches contacts via crisisContactsApi.list(country)
 * - Country derived from onboardingStore config (pays principal)
 * - 5-minute stale time (no refetch on every render)
 * - Grouped by category for display
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crisisContactsApi, normalizeCrisisContact } from '../api/crisis'
import { useOnboardingStore } from '../stores/onboardingStore'
import type { OnboardingCountry } from '../stores/onboardingStore'
import type { CrisisContact, ContactCategory } from '../types/crisis'
import { CATEGORY_ORDER } from '../types/crisis'

/** Cache duration: 5 minutes (in milliseconds). */
const CACHE_STALE_TIME = 5 * 60 * 1000

/** Map onboarding country code to ISO country code for API filtering. */
function countryToCode(country: OnboardingCountry | null): string | undefined {
  if (!country) return undefined
  return country
}

export interface GroupedContacts {
  category: ContactCategory
  contacts: CrisisContact[]
}

interface UseCrisisContactsReturn {
  contacts: CrisisContact[]
  groupedContacts: GroupedContacts[]
  isLoading: boolean
  error: unknown
}

export function useCrisisContacts(): UseCrisisContactsReturn {
  const country = useOnboardingStore((s) => s.country)
  const countryCode = countryToCode(country)

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['crisis', 'contacts', countryCode ?? 'all'],
    queryFn: () => crisisContactsApi.list(countryCode).then((r) => r.data),
    staleTime: CACHE_STALE_TIME,
    gcTime: CACHE_STALE_TIME,
  })

  // Normalize raw API response into CrisisContact[]
  const contacts = useMemo<CrisisContact[]>(() => {
    if (!rawData) return []
    const list = Array.isArray(rawData)
      ? rawData
      : ((rawData as Record<string, unknown>)?.contacts ?? [])
    return (list as Record<string, unknown>[]).map(normalizeCrisisContact)
  }, [rawData])

  // Group contacts by category (preserving CATEGORY_ORDER)
  const groupedContacts = useMemo<GroupedContacts[]>(() => {
    const groups: Record<string, CrisisContact[]> = {}
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = []
    }
    for (const contact of contacts) {
      if (!groups[contact.category]) {
        groups[contact.category] = []
      }
      groups[contact.category].push(contact)
    }
    return CATEGORY_ORDER.filter((cat) => groups[cat].length > 0).map((category) => ({
      category,
      contacts: groups[category],
    }))
  }, [contacts])

  return {
    contacts,
    groupedContacts,
    isLoading,
    error,
  }
}