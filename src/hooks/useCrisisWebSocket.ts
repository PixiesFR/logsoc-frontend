/**
 * useCrisisWebSocket — WebSocket hook for crisis timeline real-time updates.
 * Ticket #44 — listens on channel `crisis:{incidentId}`.
 *
 * Messages:
 *   { type: "entry_added", entry: {...} }
 *   { type: "entry_locked", entry_id: "..." }
 *   { type: "incident_status", status: "..." }
 *
 * Features: reconnection with exponential backoff, heartbeat ping every 30s.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../stores'
import type { CrisisWebSocketMessage } from '../types/crisis'

interface UseCrisisWebSocketOptions {
  incidentId: number
  onMessage?: (msg: CrisisWebSocketMessage) => void
  enabled?: boolean
}

interface UseCrisisWebSocketReturn {
  isConnected: boolean
  reconnect: () => void
}

export function useCrisisWebSocket({
  incidentId,
  onMessage,
  enabled = true,
}: UseCrisisWebSocketOptions): UseCrisisWebSocketReturn {
  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const onMessageRef = useRef(onMessage)

  // Keep ref updated without re-triggering the connect effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const [isConnected, setIsConnected] = useState(false)

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const channel = `crisis:${incidentId}`
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    params.set('channel', channel)
    return `${protocol}//${host}/ws/events?${params.toString()}`
  }, [incidentId, token])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
    }

    const wsUrl = getWsUrl()
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setIsConnected(true)
      retriesRef.current = 0

      clearHeartbeat()
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30_000)

      // Subscribe to the crisis channel
      ws.send(JSON.stringify({ type: 'subscribe', channel: `crisis:${incidentId}` }))
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'pong') return
        onMessageRef.current?.(data as CrisisWebSocketMessage)
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setIsConnected(false)
      clearHeartbeat()

      // Exponential backoff: base 2s, cap ~60s, max 10 retries
      if (retriesRef.current < 10) {
        retriesRef.current += 1
        const delay = Math.min(2000 * 2 ** retriesRef.current, 60_000)
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [getWsUrl, clearHeartbeat, incidentId, enabled])

  useEffect(() => {
    mountedRef.current = true
    if (enabled) {
      connect()
    }
    return () => {
      mountedRef.current = false
      clearHeartbeat()
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect, clearHeartbeat, enabled])

  const reconnect = useCallback(() => {
    retriesRef.current = 0
    connect()
  }, [connect])

  return { isConnected, reconnect }
}