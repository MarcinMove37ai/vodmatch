// src/hooks/useRealTimeSession.ts - FIXED VERSION
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// 🎯 SSE Event Types (matching server)
interface SSEEvent {
  type: 'participant_joined' | 'participant_profile_added' | 'session_status_changed' |
        'quiz_started' | 'session_updated' | 'heartbeat'
  data: any
}

// 🔄 Connection States
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'

// 📊 Hook Return Type
interface UseRealTimeSessionReturn {
  // Session data
  session: any | null

  // Connection status
  connectionState: ConnectionState
  isConnected: boolean

  // Last update info
  lastUpdate: Date | null
  lastEventType: string | null

  // Manual controls
  reconnect: () => void
  disconnect: () => void

  // Stats
  eventCount: number
  reconnectCount: number
}

// 🚀 MAIN HOOK: Real-time session updates via SSE
export function useRealTimeSession(sessionId: string): UseRealTimeSessionReturn {
  // Session state
  const [session, setSession] = useState<any | null>(null)

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // Event tracking
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [lastEventType, setLastEventType] = useState<string | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)

  // Refs for cleanup and connection management
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // 🔧 FIX: Separate refs for different lifecycle stages
  const currentConnectionRef = useRef<string>('')
  const isConnectingRef = useRef(false)

  // 🔄 RECONNECTION CONFIG
  const RECONNECT_DELAY = 3000 // 3 seconds
  const MAX_RECONNECT_ATTEMPTS = 5
  const reconnectAttempts = useRef(0)

  // 📝 EVENT HANDLERS

  // Handle incoming SSE messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const eventData: SSEEvent = {
        type: event.type as any,
        data: JSON.parse(event.data)
      }

      console.log(`🔔 SSE Event received:`, eventData.type, eventData.data)

      // Update tracking
      setEventCount(prev => prev + 1)
      setLastUpdate(new Date())
      setLastEventType(eventData.type)

      // Handle different event types
      switch (eventData.type) {
        case 'session_updated':
          // Full session update - replace current session
          if (eventData.data.session) {
            setSession(eventData.data.session)
            console.log(`✅ SSE: Session updated from real-time event`)
          }
          break

        case 'participant_joined':
          console.log(`👋 SSE: Participant ${eventData.data.userId} joined`)
          break

        case 'participant_profile_added':
          console.log(`👤 SSE: Participant ${eventData.data.userId} added profile`)
          break

        case 'session_status_changed':
          console.log(`🔄 SSE: Session status changed to ${eventData.data.newStatus}`)
          // FIXED: Add explicit type annotation for prev parameter
          setSession((prev: any | null) => prev ? { ...prev, status: eventData.data.newStatus } : prev)
          break

        case 'quiz_started':
          console.log(`🎯 SSE: Quiz started for session ${eventData.data.sessionId}`)
          // FIXED: Add explicit type annotation for prev parameter
          setSession((prev: any | null) => prev ? { ...prev, status: 'quiz_active' } : prev)
          break

        case 'heartbeat':
          // Silent heartbeat - just keeps connection alive
          break

        default:
          console.log(`❓ SSE: Unknown event type: ${eventData.type}`)
      }

    } catch (error) {
      console.error('❌ SSE: Error parsing event data:', error)
    }
  }, [])

  // Handle connection open
  const handleOpen = useCallback(() => {
    console.log(`✅ SSE: Connected successfully`)
    setConnectionState('connected')
    reconnectAttempts.current = 0 // Reset reconnect counter on successful connection
    isConnectingRef.current = false
  }, [])

  // Handle connection error
  const handleError = useCallback((error: Event) => {
    console.log(`❌ SSE: Connection error:`, error)
    isConnectingRef.current = false

    if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
      setConnectionState('error')

      // 🔧 FIX: Check if this connection is still current before reconnecting
      const currentSessionId = currentConnectionRef.current
      if (currentSessionId && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        console.log(`🔄 SSE: Scheduling reconnect attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS}`)
        setConnectionState('reconnecting')

        reconnectTimeoutRef.current = setTimeout(() => {
          // 🔧 FIX: Only reconnect if sessionId hasn't changed
          if (currentConnectionRef.current === currentSessionId && !isConnectingRef.current) {
            reconnectAttempts.current += 1
            setReconnectCount(prev => prev + 1)
            connect()
          }
        }, RECONNECT_DELAY)
      }
    }
  }, []) // 🔧 FIX: connect will be called directly to avoid stale closure

  // 🔗 CONNECTION MANAGEMENT

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    // 🔧 FIX: Simplified mount check - only check if connecting
    if (isConnectingRef.current) {
      console.log(`⚠️ SSE: Already connecting, skipping duplicate connect attempt`)
      return
    }

    if (!sessionId) {
      console.log(`⚠️ SSE: No sessionId provided, skipping connection`)
      return
    }

    // 🔧 FIX: Update current connection tracking
    currentConnectionRef.current = sessionId

    // Cleanup existing connection
    if (eventSourceRef.current) {
      console.log(`🧹 SSE: Cleaning up existing connection`)
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    try {
      console.log(`🔌 SSE: Connecting to session ${sessionId}`)
      setConnectionState('connecting')
      isConnectingRef.current = true

      const eventSource = new EventSource(`/api/session/${sessionId}/events`)
      eventSourceRef.current = eventSource

      // Set up event listeners
      eventSource.onopen = handleOpen
      eventSource.onerror = handleError

      // Listen for all custom event types
      const eventTypes = [
        'session_updated',
        'participant_joined',
        'participant_profile_added',
        'session_status_changed',
        'quiz_started',
        'heartbeat'
      ]

      eventTypes.forEach(eventType => {
        eventSource.addEventListener(eventType, handleMessage)
      })

      // Also listen for generic messages
      eventSource.onmessage = handleMessage

    } catch (error) {
      console.error(`❌ SSE: Failed to create EventSource for session ${sessionId}:`, error)
      setConnectionState('error')
      isConnectingRef.current = false
    }
  }, [sessionId, handleOpen, handleError, handleMessage])

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    console.log(`🔌 SSE: Disconnecting`)

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // 🔧 FIX: Clear current connection tracking
    currentConnectionRef.current = ''
    setConnectionState('disconnected')
    isConnectingRef.current = false
  }, [])

  // Manual reconnect
  const reconnect = useCallback(() => {
    console.log(`🔄 SSE: Manual reconnect requested`)
    disconnect()
    reconnectAttempts.current = 0 // Reset attempts for manual reconnect
    setTimeout(() => {
      if (currentConnectionRef.current === sessionId || sessionId) {
        connect()
      }
    }, 500) // Short delay before reconnecting
  }, [disconnect, connect, sessionId])

  // 🎯 LIFECYCLE MANAGEMENT

  // Connect on mount or sessionId change
  useEffect(() => {
    if (sessionId) {
      console.log(`🎯 SSE: Effect triggered for sessionId: ${sessionId}`)
      connect()
    } else {
      console.log(`🎯 SSE: No sessionId, disconnecting`)
      disconnect()
    }

    // 🔧 FIX: Cleanup function that doesn't interfere with reconnections
    return () => {
      console.log(`🧹 SSE: Effect cleanup for sessionId: ${sessionId}`)
      // Only cleanup the timeout, let disconnect handle the rest
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [sessionId, connect, disconnect])

  // 🔧 FIX: Final cleanup on unmount only
  useEffect(() => {
    return () => {
      console.log(`🧹 SSE: Component unmounting, final cleanup`)
      // Clear current connection ref to prevent reconnects
      currentConnectionRef.current = ''

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Close EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      isConnectingRef.current = false
    }
  }, []) // 🔧 FIX: Empty deps - only runs on real unmount

  // 📊 COMPUTED VALUES
  const isConnected = connectionState === 'connected'

  // 🐛 DEBUG LOGGING
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 SSE Debug - Session: ${sessionId}, State: ${connectionState}, Events: ${eventCount}, Reconnects: ${reconnectCount}`)
    }
  }, [sessionId, connectionState, eventCount, reconnectCount])

  return {
    // Session data
    session,

    // Connection status
    connectionState,
    isConnected,

    // Update tracking
    lastUpdate,
    lastEventType,

    // Manual controls
    reconnect,
    disconnect,

    // Stats
    eventCount,
    reconnectCount
  }
}

// 🎯 UTILITY: Hook for connection status only (lighter version)
export function useSSEConnectionStatus(sessionId: string) {
  const { connectionState, isConnected, eventCount, reconnectCount } = useRealTimeSession(sessionId)

  return {
    connectionState,
    isConnected,
    eventCount,
    reconnectCount
  }
}

// 🔧 UTILITY: Hook wrapper with session fallback
export function useRealTimeSessionWithFallback(
  sessionId: string,
  fallbackSession: any | null,
  enableSSE: boolean = true
) {
  const realTimeResult = useRealTimeSession(enableSSE ? sessionId : '')

  // Use real-time session if connected and available, otherwise fallback
  const effectiveSession = realTimeResult.isConnected && realTimeResult.session
    ? realTimeResult.session
    : fallbackSession

  return {
    ...realTimeResult,
    session: effectiveSession,
    isUsingRealTime: realTimeResult.isConnected && !!realTimeResult.session,
    isUsingFallback: !realTimeResult.isConnected || !realTimeResult.session
  }
}