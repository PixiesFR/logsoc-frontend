import { useQuery } from '@tanstack/react-query'
import { eventsApi, alertsApi, assetsApi, systemApi } from '../api'
import { useAppStore } from '../stores'
import type {
  EventStatsSummary,
  AlertSummary,
  AssetStatsSummary,
  SystemHealth,
  EventItem,
  AlertItem,
  AssetItem,
} from '../api/types'

export function useEventStats() {
  return useQuery<EventStatsSummary>({
    queryKey: ['events', 'stats'],
    queryFn: () => eventsApi.stats().then((r) => r.data),
  })
}

export function useEvents(params?: Record<string, string | number>) {
  return useQuery<EventItem[]>({
    queryKey: ['events', params],
    queryFn: () => eventsApi.list(params).then((r) => r.data),
  })
}

export function useAlerts(params?: Record<string, string | number>) {
  return useQuery<AlertItem[]>({
    queryKey: ['alerts', params],
    queryFn: () => alertsApi.list(params).then((r) => r.data),
  })
}

export function useAlertSummary() {
  return useQuery<AlertSummary>({
    queryKey: ['alerts', 'summary'],
    queryFn: () => alertsApi.summary().then((r) => r.data),
  })
}

export function useAssets(params?: Record<string, string>) {
  return useQuery<AssetItem[]>({
    queryKey: ['assets', params],
    queryFn: () => assetsApi.list(params).then((r) => r.data),
  })
}

export function useAssetStats() {
  return useQuery<AssetStatsSummary>({
    queryKey: ['assets', 'stats'],
    queryFn: () => assetsApi.stats().then((r) => r.data),
  })
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system', 'health'],
    queryFn: () => systemApi.health().then((r) => r.data),
    refetchInterval: 30000,
  })
}

export function useTimeRangeParams(): Record<string, string> {
  const timeRange = useAppStore((s) => s.timeRange)
  return { time_range: timeRange }
}