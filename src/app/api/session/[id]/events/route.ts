// src/app/api/session/[id]/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

// 🔄 PERSISTENT: Use globalThis to survive Hot Module Reload in development
const globalForConnections = globalThis as unknown as {
  sessionConnections: Map<string, Set<SSEConnection>> | undefined
}

// 🆕 PERSISTENT: Initialize or reuse existing connections map
const sessionConnections = globalForConnections.sessionConnections ?? new Map<string, Set<SSEConnection>>()

// 🆕 PERSISTENT: Store in globalThis to survive Hot Reload
if (process.env.NODE_ENV !== 'production') {
  globalForConnections.sessionConnections = sessionConnections
}

// 🎯 SSE Event Types
interface SSEEvent {
  type: 'participant_joined' | 'participant_profile_added' | 'session_status_changed' |
        'quiz_started' | 'session_updated' | 'heartbeat'
  data: any
}

// 🔧 ENHANCED: Connection wrapper with detailed state tracking
interface SSEConnection {
  writer: WritableStreamDefaultWriter<any>
  controller: ReadableStreamDefaultController<any>
  isActive: boolean
  sessionId: string
  connectionId: string
  connectedAt: Date
  lastActivity: Date
  heartbeatInterval?: NodeJS.Timeout
  userAgent?: string
}

// 🆕 ENHANCED: Debug function to log connection state
function logConnectionState(sessionId: string, action: string, details?: any) {
  const connections = sessionConnections.get(sessionId)
  const activeCount = connections ? Array.from(connections).filter(c => c.isActive).length : 0
  const totalCount = connections?.size || 0

  console.log(`🔍 SSE DEBUG [${action}] Session: ${sessionId}`, {
    totalConnections: totalCount,
    activeConnections: activeCount,
    timestamp: new Date().toISOString(),
    mapSize: sessionConnections.size, // 🆕 Add total map size
    allSessions: Array.from(sessionConnections.keys()), // 🆕 Show all session IDs
    ...details
  })

  // 🆕 DETAILED: Log each connection
  if (connections && connections.size > 0) {
    Array.from(connections).forEach((conn, index) => {
      console.log(`  📡 Connection #${index + 1}: ID=${conn.connectionId.slice(0, 8)}, Active=${conn.isActive}, Age=${Date.now() - conn.connectedAt.getTime()}ms`)
    })
  }
}

// 🆕 HOT RELOAD DETECTION: Log when module reloads
console.log(`🔄 SSE MODULE LOADED at ${new Date().toISOString()}`)
console.log(`🗂️ EXISTING CONNECTIONS: ${sessionConnections.size} sessions in map`)
if (sessionConnections.size > 0) {
  console.log(`🔍 EXISTING SESSION IDs:`, Array.from(sessionConnections.keys()))
  sessionConnections.forEach((connections, sessionId) => {
    const activeCount = Array.from(connections).filter(c => c.isActive).length
    console.log(`  📍 Session ${sessionId}: ${activeCount}/${connections.size} active connections`)
  })
}

// 🚀 MAIN: GET endpoint for Server-Sent Events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const userAgent = request.headers.get('user-agent')?.substring(0, 100) || 'unknown'

    console.log(`🔄 SSE: New connection request for session ${sessionId}`)
    console.log(`🆕 Connection ID: ${connectionId}, User-Agent: ${userAgent}`)

    // 🆕 ENHANCED: Log connection state before processing
    logConnectionState(sessionId, 'NEW_CONNECTION_REQUEST')

    // Verify session exists
    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      console.log(`❌ SSE: Session not found: ${sessionId}`)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        console.log(`✅ SSE: Stream started for session ${sessionId}, connection ${connectionId}`)

        // Create encoder for text data
        const encoder = new TextEncoder()

        // 🔧 ENHANCED: Connection object with detailed state tracking
        const connection: SSEConnection = {
          writer: {
            write: (data: string) => {
              // 🔧 ENHANCED: Check if controller is still active before writing
              if (!connection.isActive) {
                console.log(`⚠️ SSE: Attempted write to INACTIVE connection ${connectionId} for session ${sessionId}`)
                return
              }

              try {
                // Double-check controller state
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(data))
                  connection.lastActivity = new Date()
                } else {
                  console.log(`⚠️ SSE: Controller CLOSED, marking connection ${connectionId} inactive for session ${sessionId}`)
                  connection.isActive = false
                  cleanupConnection(sessionId, connection)
                }
              } catch (error) {
                console.log(`⚠️ SSE: Write ERROR for connection ${connectionId} session ${sessionId}, marking inactive:`, error)
                connection.isActive = false
                cleanupConnection(sessionId, connection)
              }
            },
            close: () => {
              console.log(`🔌 SSE: CLOSE called for connection ${connectionId} session ${sessionId}`)
              connection.isActive = false
              try {
                if (controller.desiredSize !== null) {
                  controller.close()
                }
              } catch (error) {
                console.log(`⚠️ SSE: Close error for connection ${connectionId}:`, error)
              }
            }
          } as any,
          controller,
          isActive: true,
          sessionId,
          connectionId,
          connectedAt: new Date(),
          lastActivity: new Date(),
          userAgent
        }

        // 🆕 ENHANCED: Store connection in persistent global map
        if (!sessionConnections.has(sessionId)) {
          sessionConnections.set(sessionId, new Set())
          console.log(`🆕 SSE: Created new session map for ${sessionId}`)
        }

        const sessionSet = sessionConnections.get(sessionId)!
        sessionSet.add(connection)

        console.log(`📊 SSE: Added connection ${connectionId} to session ${sessionId}`)
        logConnectionState(sessionId, 'CONNECTION_ADDED', { connectionId })

        // Send initial connection confirmation
        const initEvent = formatSSEEvent({
          type: 'session_updated',
          data: {
            sessionId,
            connectionId,
            message: 'Connected to real-time updates',
            timestamp: new Date().toISOString(),
            session: session
          }
        })
        connection.writer.write(initEvent)

        // 🔧 ENHANCED: Safe heartbeat with connection state checking
        connection.heartbeatInterval = setInterval(() => {
          // 🆕 DEFENSIVE: Double-check connection still exists in map
          const currentConnections = sessionConnections.get(sessionId)
          const stillInMap = currentConnections?.has(connection)

          if (!connection.isActive || !stillInMap) {
            console.log(`💔 SSE: Connection ${connectionId} INACTIVE or NOT IN MAP (active: ${connection.isActive}, inMap: ${stillInMap}), stopping heartbeat`)
            if (connection.heartbeatInterval) {
              clearInterval(connection.heartbeatInterval)
            }
            if (stillInMap) {
              cleanupConnection(sessionId, connection)
            }
            return
          }

          try {
            const heartbeat = formatSSEEvent({
              type: 'heartbeat',
              data: {
                timestamp: new Date().toISOString(),
                connectionId,
                sessionId
              }
            })
            connection.writer.write(heartbeat)
          } catch (error) {
            console.log(`💔 SSE: Heartbeat FAILED for connection ${connectionId} session ${sessionId}, cleaning up:`, error)
            connection.isActive = false
            if (connection.heartbeatInterval) {
              clearInterval(connection.heartbeatInterval)
            }
            cleanupConnection(sessionId, connection)
          }
        }, 30000) // Every 30 seconds

        // 🔧 ENHANCED: Proper cleanup when stream is cancelled
        return () => {
          console.log(`🧹 SSE: Stream cleanup INITIATED for connection ${connectionId} session ${sessionId}`)
          connection.isActive = false
          if (connection.heartbeatInterval) {
            clearInterval(connection.heartbeatInterval)
          }
          cleanupConnection(sessionId, connection)
        }
      }
    })

    // Return SSE response with proper headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('❌ SSE: CRITICAL error in events endpoint:', error)
    return NextResponse.json({
      error: 'Failed to establish SSE connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 🎯 HELPER: Format SSE event according to specification
function formatSSEEvent(event: SSEEvent): string {
  const data = JSON.stringify(event.data)
  return `event: ${event.type}\ndata: ${data}\n\n`
}

// 🧹 ENHANCED: Cleanup connection from global map with detailed logging
function cleanupConnection(sessionId: string, connection: SSEConnection) {
  console.log(`🗑️ SSE: CLEANUP connection ${connection.connectionId} from session ${sessionId}`)

  const connections = sessionConnections.get(sessionId)
  if (connections) {
    const wasRemoved = connections.delete(connection)
    console.log(`🗑️ SSE: Connection removal ${wasRemoved ? 'SUCCESS' : 'FAILED'} for ${connection.connectionId}`)
    console.log(`📊 SSE: Remaining connections for session ${sessionId}: ${connections.size}`)

    if (connections.size === 0) {
      sessionConnections.delete(sessionId)
      console.log(`🗑️ SSE: Removed EMPTY session ${sessionId} from connections map`)
    }
  } else {
    console.log(`⚠️ SSE: No connections found for session ${sessionId} during cleanup`)
  }

  // Ensure heartbeat is stopped
  if (connection.heartbeatInterval) {
    clearInterval(connection.heartbeatInterval)
  }

  // Mark as inactive
  connection.isActive = false

  // 🆕 Final state log
  logConnectionState(sessionId, 'CONNECTION_CLEANED', {
    cleanedConnectionId: connection.connectionId,
    connectionAge: Date.now() - connection.connectedAt.getTime()
  })
}

// 🚀 ENHANCED: Send event to all connections for a session with detailed logging
export function broadcastToSession(sessionId: string, event: SSEEvent) {
  const upperSessionId = sessionId.toUpperCase()
  console.log(`📢 SSE: BROADCAST starting for session ${upperSessionId}, event: ${event.type}`)

  // 🆕 Enhanced connection state logging BEFORE broadcast
  logConnectionState(upperSessionId, 'BROADCAST_START', { eventType: event.type })

  const connections = sessionConnections.get(upperSessionId)

  if (!connections || connections.size === 0) {
    console.log(`📭 SSE: NO ACTIVE connections for session ${upperSessionId}`)
    logConnectionState(upperSessionId, 'BROADCAST_NO_CONNECTIONS')
    return
  }

  console.log(`📢 SSE: Broadcasting ${event.type} to ${connections.size} connections for session ${upperSessionId}`)

  const eventData = formatSSEEvent(event)
  const deadConnections: SSEConnection[] = []
  let successCount = 0

  // 🔧 FIXED: Convert Set to Array for proper index access
const connectionsArray = Array.from(connections)
connectionsArray.forEach((connection, index) => {
  console.log(`📡 SSE: Processing connection #${index + 1}: ${connection.connectionId}, active: ${connection.isActive}`)

  if (!connection.isActive) {
    console.log(`💀 SSE: Found INACTIVE connection ${connection.connectionId} for session ${upperSessionId}`)
    deadConnections.push(connection)
    return
  }

  try {
    connection.writer.write(eventData)
    successCount++
    console.log(`✅ SSE: Successfully sent to connection ${connection.connectionId}`)
  } catch (error) {
    console.log(`💀 SSE: Write FAILED for connection ${connection.connectionId} session ${upperSessionId}, marking dead:`, error)
    connection.isActive = false
    deadConnections.push(connection)
  }
})

  // Cleanup dead connections
  deadConnections.forEach(deadConnection => {
    console.log(`🧹 SSE: Cleaning up DEAD connection ${deadConnection.connectionId}`)
    cleanupConnection(upperSessionId, deadConnection)
  })

  console.log(`✅ SSE: BROADCAST complete - sent to ${successCount}/${connections.size} connections, cleaned ${deadConnections.length} dead`)

  // 🆕 Final state after broadcast
  logConnectionState(upperSessionId, 'BROADCAST_COMPLETE', {
    eventType: event.type,
    successCount,
    deadCount: deadConnections.length
  })
}

// 🎯 ENHANCED: Broadcast session updates with additional logging
export async function broadcastSessionUpdate(sessionId: string, updateType?: string) {
  try {
    console.log(`📤 SSE: broadcastSessionUpdate called for ${sessionId}, type: ${updateType}`)

    // Get fresh session data
    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      console.log(`⚠️ SSE: Cannot broadcast update - session ${sessionId} not found`)
      return
    }

    console.log(`📤 SSE: Broadcasting session update for ${sessionId}, type: ${updateType}`)

    const event: SSEEvent = {
      type: 'session_updated',
      data: {
        sessionId,
        session,
        updateType,
        timestamp: new Date().toISOString()
      }
    }

    broadcastToSession(sessionId, event)

  } catch (error) {
    console.error(`❌ SSE: Failed to broadcast session update for ${sessionId}:`, error)
  }
}

// 🎯 ENHANCED: Broadcast participant joined with timing
export function broadcastParticipantJoined(sessionId: string, userId: string) {
  console.log(`📤 SSE: broadcastParticipantJoined called - ${userId} to session ${sessionId}`)

  const event: SSEEvent = {
    type: 'participant_joined',
    data: {
      sessionId,
      userId,
      message: 'New participant joined',
      timestamp: new Date().toISOString()
    }
  }

  broadcastToSession(sessionId, event)
}

// 🎯 SPECIFIC: Broadcast participant profile added
export function broadcastParticipantProfileAdded(sessionId: string, userId: string, profile: any) {
  console.log(`📤 SSE: Broadcasting participant profile added - ${userId} to session ${sessionId}`)

  const event: SSEEvent = {
    type: 'participant_profile_added',
    data: {
      sessionId,
      userId,
      profile,
      message: 'Participant added profile',
      timestamp: new Date().toISOString()
    }
  }

  broadcastToSession(sessionId, event)
}

// 🎯 SPECIFIC: Broadcast session status changed
export function broadcastSessionStatusChanged(sessionId: string, newStatus: string, oldStatus?: string) {
  console.log(`📤 SSE: Broadcasting status change for ${sessionId}: ${oldStatus} → ${newStatus}`)

  const event: SSEEvent = {
    type: 'session_status_changed',
    data: {
      sessionId,
      newStatus,
      oldStatus,
      message: `Session status changed to ${newStatus}`,
      timestamp: new Date().toISOString()
    }
  }

  broadcastToSession(sessionId, event)
}

// 🎯 SPECIFIC: Broadcast quiz started
export function broadcastQuizStarted(sessionId: string) {
  console.log(`📤 SSE: Broadcasting quiz started for session ${sessionId}`)

  const event: SSEEvent = {
    type: 'quiz_started',
    data: {
      sessionId,
      message: 'Quiz has started!',
      timestamp: new Date().toISOString()
    }
  }

  broadcastToSession(sessionId, event)
}

// 🔍 ENHANCED: Get connection stats for monitoring
export function getConnectionStats() {
  const stats = {
    totalSessions: sessionConnections.size,
    totalConnections: 0,
    activeConnections: 0,
    sessions: {} as Record<string, { total: number, active: number, connections: any[] }>
  }

  sessionConnections.forEach((connections, sessionId) => {
    const connectionsArray = Array.from(connections)
    const activeCount = connectionsArray.filter(conn => conn.isActive).length
    stats.totalConnections += connections.size
    stats.activeConnections += activeCount
    stats.sessions[sessionId] = {
      total: connections.size,
      active: activeCount,
      connections: connectionsArray.map(conn => ({
        id: conn.connectionId,
        active: conn.isActive,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        userAgent: conn.userAgent
      }))
    }
  })

  return stats
}

// 🧹 CLEANUP: Remove connections for expired sessions (called periodically)
export async function cleanupExpiredSessions() {
  console.log(`🧹 SSE: Cleaning up expired sessions...`)

  for (const sessionId of sessionConnections.keys()) {
    try {
      const session = await sessionDb.getSession(sessionId)
      if (!session) {
        // Session expired, close all connections
        const connections = sessionConnections.get(sessionId)
        if (connections) {
          connections.forEach(connection => {
            connection.isActive = false
            if (connection.heartbeatInterval) {
              clearInterval(connection.heartbeatInterval)
            }
            try {
              connection.writer.close()
            } catch (error) {
              console.log(`⚠️ SSE: Error closing connection for expired session ${sessionId}`)
            }
          })
          sessionConnections.delete(sessionId)
          console.log(`🗑️ SSE: Cleaned up expired session ${sessionId}`)
        }
      }
    } catch (error) {
      console.error(`❌ SSE: Error checking session ${sessionId}:`, error)
    }
  }
}

// Optional: Handle OPTIONS for CORS
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Max-Age': '86400'
    }
  })
}