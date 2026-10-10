/**
 * useNotificationPrefill — hook to generate the initial notification draft.
 * Ticket #49 — War Room notification pre-fill editor.
 *
 * Flow:
 * 1. Fetch crisis detail via crisisApi.get(crisesId)
 * 2. Try POST /api/v1/crisis/:id/notifications/generate (AI-assisted pre-fill)
 * 3. On 404 or error → fallback to generateLocalDraft using crisis context
 * 4. Return draft + loading + fallback flag
 */
import { useQuery } from '@tanstack/react-query'
import { crisisApi } from '../api'
import {
  crisisNotificationApi,
  normalizeNotificationDraft,
  generateLocalDraft,
  normalizeTemplate,
} from '../services/crisisNotificationService'
import type { NotificationDraft } from '../types/notification'

interface PrefillResult {
  draft: NotificationDraft
  fallbackUsed: boolean
}

export function useNotificationPrefill(
  crisisId: number,
  templateParam: string,
): {
  draft: NotificationDraft | undefined
  fallbackUsed: boolean
  isLoading: boolean
  isError: boolean
} {
  const template = normalizeTemplate(templateParam)

  const { data, isLoading, isError } = useQuery<PrefillResult>({
    queryKey: ['crisis', 'notification-prefill', crisisId, template],
    queryFn: async (): Promise<PrefillResult> => {
      // Fetch crisis detail for local fallback
      let crisisContext: Record<string, unknown> = {}
      try {
        const detailRes = await crisisApi.get(crisisId)
        crisisContext = (detailRes.data ?? {}) as Record<string, unknown>
      } catch {
        // If even crisis detail fails, we'll use an empty context
      }

      // Try AI-generate endpoint
      try {
        const genRes = await crisisNotificationApi.generate(crisisId, template)
        const raw = (genRes.data ?? {}) as Record<string, unknown>
        // Merge crisis context into the generated draft for any missing fields
        const merged = { ...crisisContext, ...raw }
        return {
          draft: normalizeNotificationDraft(merged, template),
          fallbackUsed: false,
        }
      } catch {
        // 404 or error — use local fallback with crisis context
        return {
          draft: generateLocalDraft(template, crisisContext),
          fallbackUsed: true,
        }
      }
    },
    enabled: !!crisisId,
    staleTime: 0,
    retry: false,
  })

  return {
    draft: data?.draft,
    fallbackUsed: data?.fallbackUsed ?? false,
    isLoading,
    isError,
  }
}