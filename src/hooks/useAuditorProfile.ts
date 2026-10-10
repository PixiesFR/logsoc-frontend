import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api'
import { useAuthStore } from '../stores'

export interface AuditorProfile {
  username: string
  role: string
  role_expires_at: string | null
}

/**
 * Hook for reading the auditor profile and role expiration.
 * Falls back to the auth store user if the API endpoint is not available (404).
 */
export function useAuditorProfile() {
  const user = useAuthStore((s) => s.user)

  const query = useQuery<AuditorProfile>({
    queryKey: ['audit', 'profile'],
    queryFn: async () => {
      try {
        const { data } = await auditApi.profile()
        return data as AuditorProfile
      } catch {
        // Fallback to auth store user data
        return {
          username: user?.username ?? '',
          role: user?.role ?? 'auditor',
          role_expires_at: user?.role_expires_at ?? null,
        }
      }
    },
    staleTime: 60000,
    retry: 0,
  })

  return query
}

/**
 * Compute days remaining until role expiration.
 * Returns null if no expiration date is set.
 */
export function getDaysUntilExpiration(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}