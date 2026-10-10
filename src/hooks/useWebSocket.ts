import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '../stores'

interface UseWebSocketOptions {
  url?: string
  onMessage?: (data: unknown) => void
  onOpen?: () => void
  onClose?: () => void
  reconnectInterval?: number
  maxRetries?: number
}

interface UseWebSocketReturn {
  isConnected: boolean
  lastMessage: unknown | null
  send: (data: unknown) => void
  reconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    reconnectInterval = 5000,
    maxRetries = 10,
  } = options

  const token = useAuthStore((s) => s.token)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<unknown | null>(null)

  const getWsUrl = useCallback(() => {
    if (url) return url
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const params = token ? `?token=${encodeURIComponent(token)}` : ''
    return `${protocol}//${host}/ws/events${params}`
  }, [url, token])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
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
      }, 30000)

      onOpen?.()
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'pong') return
        setLastMessage(data)
        onMessage?.(data)
      } catch {
        setLastMessage(event.data)
        onMessage?.(event.data)
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setIsConnected(false)
      clearHeartbeat()
      onClose?.()

      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1
        const delay = reconnectInterval * retriesRef.current
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [getWsUrl, onMessage, onOpen, onClose, reconnectInterval, maxRetries, clearHeartbeat])

  useEffect(() => {
    mountedRef.current = true
    connect()
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
  }, [connect, clearHeartbeat])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const reconnect = useCallback(() => {
    retriesRef.current = 0
    connect()
  }, [connect])

  return { isConnected, lastMessage, send, reconnect }
}