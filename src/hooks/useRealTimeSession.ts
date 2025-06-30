// src/hooks/useRealTimeSession.ts - ENHANCED VERSION with Session Cleanup Events
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
  session: any | null
  connectionState: ConnectionState
  isConnected: boolean
  lastUpdate: Date | null
  lastEventType: string | null
  finalVerdictReached: boolean
  finalWinner: any | null
  reconnect: () => void
  disconnect: () => void
  eventCount: number
  reconnectCount: number
}

interface UseRealTimeSessionWithFallbackReturn extends UseRealTimeSessionReturn {
  isUsingRealTime: boolean
  isUsingFallback: boolean
}

// 🚀 MAIN HOOK: Real-time session updates via SSE
export function useRealTimeSession(sessionId: string): UseRealTimeSessionReturn {
  // Session state
  const [session, setSession] = useState<any | null>(null)
  const [previousSession, setPreviousSession] = useState<any | null>(null)

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  // Event tracking
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [lastEventType, setLastEventType] = useState<string | null>(null)
  const [eventCount, setEventCount] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)

  // 🆕 FINAL VERDICT STATE
  const [finalVerdictReached, setFinalVerdictReached] = useState(false)
  const [finalWinner, setFinalWinner] = useState<any | null>(null)

  // Refs for cleanup and connection management
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentConnectionRef = useRef<string>('')
  const isConnectingRef = useRef(false)
  const lastSessionIdRef = useRef<string>('')
  const shouldStayConnectedRef = useRef<boolean>(true) // 🆕 Global connection control

  // 🔄 RECONNECTION CONFIG
  const RECONNECT_DELAY = 3000
  const MAX_RECONNECT_ATTEMPTS = 5
  const reconnectAttempts = useRef(0)

  // 🆕 FINAL VERDICT DETECTION
  useEffect(() => {
    if (!session || !previousSession) return;

    const justReachedFinalVerdict = (
      session.currentStep === 'final_verdict' &&
      previousSession.currentStep !== 'final_verdict' &&
      session.finalWinnerMovieId
    );

    const winnerJustDetermined = (
      session.finalWinnerMovieId &&
      !previousSession.finalWinnerMovieId
    );

    if (justReachedFinalVerdict || winnerJustDetermined) {
      console.log('🏆 [useRealTimeSession] Final verdict detected!', {
        currentStep: session.currentStep,
        finalWinnerMovieId: session.finalWinnerMovieId,
        trigger: justReachedFinalVerdict ? 'step_change' : 'winner_determined'
      });

      setFinalVerdictReached(true);
    }
  }, [session, previousSession]);

  // 🆕 SESSION CLEANUP EVENT LISTENERS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen for session clearing event
    const handleSessionClearing = (event: CustomEvent) => {
      const { oldSessionId, reason } = event.detail;
      console.log(`🧹 [SSE] Received session-clearing event:`, { oldSessionId, reason });

      // If this hook is connected to the old session, disconnect immediately
      if (currentConnectionRef.current === oldSessionId) {
        console.log(`🔌 [SSE] Disconnecting from old session: ${oldSessionId}`);
        shouldStayConnectedRef.current = false; // Prevent reconnection attempts
        forceDisconnect();
      }
    };

    // Listen for session cleared event
    const handleSessionCleared = (event: CustomEvent) => {
      const { reason } = event.detail;
      console.log(`🗑️ [SSE] Received session-cleared event:`, { reason });

      // Clear all session data
      setSession(null);
      setPreviousSession(null);
      setFinalVerdictReached(false);
      setFinalWinner(null);
    };

    // Listen for new session created event
    const handleSessionCreated = (event: CustomEvent) => {
      const { sessionId: newSessionId, oldSessionId } = event.detail;
      console.log(`🆕 [SSE] Received session-created event:`, { newSessionId, oldSessionId });

      // Reset connection control
      shouldStayConnectedRef.current = true;

      // Reset counters
      setEventCount(0);
      setReconnectCount(0);
      reconnectAttempts.current = 0;
    };

    window.addEventListener('session-clearing', handleSessionClearing as EventListener);
    window.addEventListener('session-cleared', handleSessionCleared as EventListener);
    window.addEventListener('session-created', handleSessionCreated as EventListener);

    return () => {
      window.removeEventListener('session-clearing', handleSessionClearing as EventListener);
      window.removeEventListener('session-cleared', handleSessionCleared as EventListener);
      window.removeEventListener('session-created', handleSessionCreated as EventListener);
    };
  }, []);

  // 📝 EVENT HANDLERS - STABLE CALLBACKS

  // Handle incoming SSE messages - STABLE
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const eventData: SSEEvent = {
        type: event.type as any,
        data: JSON.parse(event.data)
      }

      // 🆕 Enhanced logging with final verdict detection
      if (eventData.data.updateType === 'final_verdict_reached') {
        console.log(`🏆 [SSE] FINAL VERDICT EVENT RECEIVED:`, {
          type: eventData.type,
          updateType: eventData.data.updateType,
          sessionId: eventData.data.sessionId,
          winner: eventData.data.winner,
          session: eventData.data.session
        });
      } else {
        console.log(`🔔 SSE Event received:`, eventData.type, eventData.data)
      }

      // Update tracking
      setEventCount(prev => prev + 1)
      setLastUpdate(new Date())
      setLastEventType(eventData.type)

      // Handle different event types
      switch (eventData.type) {
        case 'session_updated':
          if (eventData.data.session) {
            // 🔧 PREVENT LOOP: Don't update if it's just a connection event
            if (eventData.data.message === 'Connected to real-time updates') {
              console.log(`🔕 SSE: Ignoring connection event to prevent loop`);
              return;
            }

            setPreviousSession(session)
            setSession(eventData.data.session)
            console.log(`✅ SSE: Session updated from real-time event`)

            if (eventData.data.updateType === 'final_verdict_reached') {
              console.log('🎉 [SSE] Processing final verdict reached event');
              setFinalVerdictReached(true);
              if (eventData.data.winner) {
                setFinalWinner(eventData.data.winner);
              }
            }

            // ✅ NOWA OBSŁUGA: Session finished - auto-logout dla wszystkich
            if (eventData.data.updateType === 'session_finished') {
              console.log('🏁 [SSE] Session finished - triggering logout for all participants');

              // Dispatch event do page.tsx
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auto-logout', {
                  detail: {
                    sessionId: eventData.data.sessionId,
                    reason: 'session_finished_by_admin'
                  }
                }));
              }
            }
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
          setSession((prev: any | null) => prev ? { ...prev, status: eventData.data.newStatus } : prev)
          break

        case 'quiz_started':
          console.log(`🎯 SSE: Quiz started for session ${eventData.data.sessionId}`)
          setSession((prev: any | null) => prev ? { ...prev, currentStep: 'quiz_active' } : prev)
          break

        case 'heartbeat':
          // Silent heartbeat
          break

        default:
          console.log(`❓ SSE: Unknown event type: ${eventData.type}`)
      }
    } catch (error) {
      console.error(`❌ SSE: Error parsing message:`, error, event.data)
    }
  }, [session])

  // Connection opened - STABLE
  const handleOpen = useCallback(() => {
    console.log(`✅ SSE: Connected to session ${currentConnectionRef.current}`)
    setConnectionState('connected')
    isConnectingRef.current = false
    reconnectAttempts.current = 0
  }, [])

  // Connection error/closed - STABLE
  const handleError = useCallback((error: Event) => {
    const sessionId = currentConnectionRef.current
    console.log(`❌ SSE: Connection error for session ${sessionId}:`, error)
    setConnectionState('error')
    isConnectingRef.current = false

    // 🆕 CHECK: Should we try to reconnect?
    if (!shouldStayConnectedRef.current) {
      console.log(`🛑 SSE: Not reconnecting - shouldStayConnected is false`);
      return;
    }

    // 🔄 AUTO-RECONNECT LOGIC
    if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS && currentConnectionRef.current === sessionId) {
      reconnectAttempts.current++
      setReconnectCount(prev => prev + 1)
      console.log(`🔄 SSE: Attempting reconnect ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms`)

      setConnectionState('reconnecting')
      reconnectTimeoutRef.current = setTimeout(() => {
        if (currentConnectionRef.current === sessionId && shouldStayConnectedRef.current) {
          connectToSSE()
        }
      }, RECONNECT_DELAY)
    } else {
      console.log(`💀 SSE: Max reconnection attempts reached for session ${sessionId}`)
      setConnectionState('error')
    }
  }, [])

  // 🔧 INTERNAL CONNECT FUNCTION
  const connectToSSE = useCallback(() => {
    const sessionId = currentConnectionRef.current

    if (isConnectingRef.current) {
      console.log(`⚠️ SSE: Already connecting to ${sessionId}, skipping`)
      return
    }

    if (!sessionId) {
      console.log(`⚠️ SSE: No sessionId provided, skipping connection`)
      return
    }

    if (!shouldStayConnectedRef.current) {
      console.log(`🛑 SSE: shouldStayConnected is false, not connecting to ${sessionId}`)
      return
    }

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

      eventSource.onmessage = handleMessage

    } catch (error) {
      console.error(`❌ SSE: Failed to create EventSource for session ${sessionId}:`, error)
      setConnectionState('error')
      isConnectingRef.current = false
    }
  }, [handleOpen, handleError, handleMessage])

  // 🔧 PUBLIC CONNECT - STABLE
  const connect = useCallback(() => {
    if (sessionId && sessionId !== currentConnectionRef.current) {
      console.log(`🎯 SSE: Setting up connection to ${sessionId}`)
      currentConnectionRef.current = sessionId
      lastSessionIdRef.current = sessionId
      shouldStayConnectedRef.current = true // 🆕 Reset connection control
      connectToSSE()
    }
  }, [sessionId, connectToSSE])

  // 🆕 FORCE DISCONNECT - For immediate cleanup
  const forceDisconnect = useCallback(() => {
    console.log(`🚨 SSE: Force disconnecting`)
    shouldStayConnectedRef.current = false

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    currentConnectionRef.current = ''
    lastSessionIdRef.current = ''
    setConnectionState('disconnected')
    isConnectingRef.current = false
  }, [])

  // Disconnect from SSE - STABLE
  const disconnect = useCallback(() => {
    console.log(`🔌 SSE: Disconnecting`)
    shouldStayConnectedRef.current = false

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    currentConnectionRef.current = ''
    lastSessionIdRef.current = ''
    setConnectionState('disconnected')
    isConnectingRef.current = false
  }, [])

  // Manual reconnect - STABLE
  const reconnect = useCallback(() => {
    console.log(`🔄 SSE: Manual reconnect requested`)
    disconnect()
    reconnectAttempts.current = 0
    shouldStayConnectedRef.current = true
    setTimeout(() => {
      if (lastSessionIdRef.current) {
        currentConnectionRef.current = lastSessionIdRef.current
        connectToSSE()
      }
    }, 500)
  }, [disconnect, connectToSSE])

  // 🎯 LIFECYCLE MANAGEMENT - 🔧 FIXED DEPS
  useEffect(() => {
    if (sessionId && sessionId !== lastSessionIdRef.current) {
      console.log(`🎯 SSE: Session changed from ${lastSessionIdRef.current} to ${sessionId}`)
      connect()
    } else if (!sessionId && lastSessionIdRef.current) {
      console.log(`🎯 SSE: No sessionId, disconnecting`)
      disconnect()
    }

    return () => {
      console.log(`🧹 SSE: Effect cleanup for sessionId: ${sessionId}`)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [sessionId])

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`🧹 SSE: Component unmounting, final cleanup`)
      shouldStayConnectedRef.current = false
      currentConnectionRef.current = ''
      lastSessionIdRef.current = ''

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      isConnectingRef.current = false
    }
  }, [])

  // 📊 COMPUTED VALUES
  const isConnected = connectionState === 'connected'

  // 🐛 DEBUG LOGGING - 🔧 REDUCED FREQUENCY
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && eventCount % 10 === 0) {
      console.log(`🔍 SSE Debug - Session: ${sessionId}, State: ${connectionState}, Events: ${eventCount}, Reconnects: ${reconnectCount}, FinalVerdict: ${finalVerdictReached}`)
    }
  }, [sessionId, connectionState, eventCount, reconnectCount, finalVerdictReached])

  return {
    session,
    connectionState,
    isConnected,
    lastUpdate,
    lastEventType,
    finalVerdictReached,
    finalWinner,
    reconnect,
    disconnect,
    eventCount,
    reconnectCount
  }
}

// 🎯 UTILITY: Hook for connection status only
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
): UseRealTimeSessionWithFallbackReturn {
  const realTimeResult = useRealTimeSession(enableSSE ? sessionId : '')

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

// 🆕 UTILITY: Hook specifically for final verdict detection
export function useFinalVerdictDetection(sessionId: string) {
  const { session, finalVerdictReached, finalWinner, isConnected } = useRealTimeSession(sessionId)

  return {
    session,
    finalVerdictReached,
    finalWinner,
    isConnected,
    hasFinalWinner: !!session?.finalWinnerMovieId,
    currentStep: session?.currentStep
  }
}