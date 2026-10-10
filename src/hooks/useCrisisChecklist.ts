/**
 * useCrisisChecklist — fetch + WebSocket subscribe for the reflex checklist.
 * Ticket #45 — Checklist réflexe (zone centre).
 *
 * Features:
 * - Fetches checklist tasks via crisisChecklistApi.list
 * - Sorts by priority (CRITIQUE > HAUTE > MOYENNE > BAS)
 * - WebSocket: listens for task_checked / task_unchecked events
 * - Provides check() and uncheck() mutations
 * - Tracks progress (completed / total / percentage)
 */
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crisisChecklistApi, normalizeChecklistTask } from '../api/crisis'
import { useCrisisWebSocket } from './useCrisisWebSocket'
import { useAuthStore } from '../stores'
import type { ChecklistTask, CrisisWebSocketMessage } from '../types/crisis'
import { PRIORITY_ORDER } from '../types/crisis'

interface UseCrisisChecklistReturn {
  tasks: ChecklistTask[]
  isLoading: boolean
  completedCount: number
  totalCount: number
  progressPercent: number
  check: (taskId: number) => void
  uncheck: (taskId: number) => void
  isChecking: boolean
  error: unknown
}

const PRIORITY_RANK: Record<string, number> = {
  CRITIQUE: 0,
  HAUTE: 1,
  MOYENNE: 2,
  BAS: 3,
}

export function useCrisisChecklist(crisisId: number): UseCrisisChecklistReturn {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [tasks, setTasks] = useState<ChecklistTask[]>([])
  const [isChecking, setIsChecking] = useState(false)

  // Fetch checklist
  const { data: rawTasks, isLoading, error } = useQuery({
    queryKey: ['crisis', 'checklist', crisisId],
    queryFn: () => crisisChecklistApi.list(crisisId).then((r) => r.data),
    enabled: !!crisisId,
  })

  // Normalize + sort by priority
  useEffect(() => {
    if (!rawTasks) return
    const list = Array.isArray(rawTasks)
      ? rawTasks
      : ((rawTasks as Record<string, unknown>)?.items ?? [])
    const normalized = (list as Record<string, unknown>[]).map(normalizeChecklistTask)
    normalized.sort((a, b) => {
      const rankA = PRIORITY_RANK[a.priority] ?? 99
      const rankB = PRIORITY_RANK[b.priority] ?? 99
      if (rankA !== rankB) return rankA - rankB
      return a.id - b.id
    })
    setTasks(normalized)
  }, [rawTasks])

  // WebSocket handler for real-time checklist updates
  const handleWsMessage = useCallback(
    (msg: CrisisWebSocketMessage) => {
      if (msg.type === 'task_checked') {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === msg.task_id
              ? {
                  ...t,
                  checked: true,
                  checkedBy: msg.checked_by,
                  checkedByName: msg.checked_by_name,
                  checkedAt: msg.checked_at,
                }
              : t,
          ),
        )
        qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
      } else if (msg.type === 'task_unchecked') {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === msg.task_id
              ? {
                  ...t,
                  checked: false,
                  checkedBy: null,
                  checkedByName: null,
                  checkedAt: null,
                }
              : t,
          ),
        )
        qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
      }
    },
    [qc, crisisId],
  )

  useCrisisWebSocket({
    incidentId: crisisId,
    onMessage: handleWsMessage,
    enabled: !!crisisId,
  })

  // Check mutation
  const checkMutation = useMutation({
    mutationFn: (taskId: number) => {
      if (!user) throw new Error('No user')
      return crisisChecklistApi.check(crisisId, taskId, { user_id: user.id })
    },
    onMutate: () => setIsChecking(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
    },
    onError: (err) => {
      console.error('Checklist check error:', err)
      qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
    },
    onSettled: () => setIsChecking(false),
  })

  // Uncheck mutation
  const uncheckMutation = useMutation({
    mutationFn: (taskId: number) => {
      if (!user) throw new Error('No user')
      return crisisChecklistApi.uncheck(crisisId, taskId, { user_id: user.id })
    },
    onMutate: () => setIsChecking(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
    },
    onError: (err) => {
      console.error('Checklist uncheck error:', err)
      qc.invalidateQueries({ queryKey: ['crisis', 'checklist', crisisId] })
    },
    onSettled: () => setIsChecking(false),
  })

  const check = useCallback((taskId: number) => checkMutation.mutate(taskId), [checkMutation])
  const uncheck = useCallback((taskId: number) => uncheckMutation.mutate(taskId), [uncheckMutation])

  const completedCount = tasks.filter((t) => t.checked).length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return {
    tasks,
    isLoading,
    completedCount,
    totalCount,
    progressPercent,
    check,
    uncheck,
    isChecking,
    error,
  }
}

// Re-export priority order for convenience
export { PRIORITY_ORDER }