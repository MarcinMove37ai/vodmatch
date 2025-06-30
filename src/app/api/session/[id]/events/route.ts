// src/app/api/session/[id]/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

const globalForConnections = globalThis as unknown as {
  sessionConnections: Map<string, Set<SSEConnection>> | undefined
}

const sessionConnections = globalForConnections.sessionConnections ?? new Map<string, Set<SSEConnection>>()

if (process.env.NODE_ENV !== 'production') {
  globalForConnections.sessionConnections = sessionConnections
}

interface SSEEvent {
  type: 'participant_joined' | 'participant_profile_added' | 'session_status_changed' |
        'quiz_started' | 'session_updated' | 'heartbeat'
  data: any
}

interface SSEConnection {
  writer: {
    write: (data: string) => void;
    close: () => void;
  }
  controller: ReadableStreamDefaultController<any>
  isActive: boolean
  sessionId: string
  connectionId: string
  connectedAt: Date
  lastActivity: Date
  heartbeatInterval?: NodeJS.Timeout
  userAgent?: string
}

function logConnectionState(sessionId: string, action: string, details?: any) {
  const connections = sessionConnections.get(sessionId)
  const activeCount = connections ? Array.from(connections).filter(c => c.isActive).length : 0
  const totalCount = connections?.size || 0

  console.log(`🔍 SSE DEBUG [${action}] Session: ${sessionId}`, {
    totalConnections: totalCount,
    activeConnections: activeCount,
    timestamp: new Date().toISOString(),
    mapSize: sessionConnections.size,
    allSessions: Array.from(sessionConnections.keys()),
    ...details
  })

  if (connections && connections.size > 0) {
    Array.from(connections).forEach((conn, index) => {
      console.log(`  📡 Connection #${index + 1}: ID=${conn.connectionId.slice(0, 8)}, Active=${conn.isActive}, Age=${Date.now() - conn.connectedAt.getTime()}ms`)
    })
  }
}

console.log(`🔄 SSE MODULE LOADED at ${new Date().toISOString()}`)
console.log(`🗂️ EXISTING CONNECTIONS: ${sessionConnections.size} sessions in map`)

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

    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    let connection: SSEConnection;

    const stream = new ReadableStream({
      start(controller) {
        console.log(`✅ SSE: Stream started for session ${sessionId}, connection ${connectionId}`)
        const encoder = new TextEncoder()

        connection = {
          writer: {
            write: (data: string) => {
              if (!connection.isActive) return;
              try {
                controller.enqueue(encoder.encode(data));
                connection.lastActivity = new Date();
              } catch (error) {
                console.log(`⚠️ SSE: Write FAILED for connection ${connectionId}, cleaning up. Error: ${(error as Error).message}`);
                if (connection.isActive) {
                  cleanupConnection(sessionId, connection);
                }
              }
            },
            close: () => {
              if (connection.isActive) {
                cleanupConnection(sessionId, connection);
              }
            }
          },
          controller,
          isActive: true,
          sessionId,
          connectionId,
          connectedAt: new Date(),
          lastActivity: new Date(),
          userAgent
        }

        if (!sessionConnections.has(sessionId)) {
          sessionConnections.set(sessionId, new Set())
        }
        sessionConnections.get(sessionId)!.add(connection)
        logConnectionState(sessionId, 'CONNECTION_ADDED', { connectionId })

        const initEvent = formatSSEEvent({
          type: 'session_updated', data: { sessionId, connectionId, message: 'Connected to real-time updates', timestamp: new Date().toISOString(), session: session }
        })
        connection.writer.write(initEvent)

        connection.heartbeatInterval = setInterval(() => {
          if (!connection.isActive) {
            cleanupConnection(sessionId, connection); // Upewnij się, że wywołujemy cleanup
            return;
          }
          try {
            const heartbeat = formatSSEEvent({ type: 'heartbeat', data: { timestamp: new Date().toISOString() } })
            connection.writer.write(heartbeat)
          } catch (error) {
            console.log(`💔 SSE: Heartbeat FAILED for connection ${connectionId}, cleaning up:`, error)
            cleanupConnection(sessionId, connection);
          }
        }, 30000);
      },
      // ✅ POPRAWKA: Używamy TYLKO tej metody do obsługi rozłączenia.
      // Jest ona niezawodnie wywoływana, gdy klient zamknie połączenie.
      cancel(reason) {
          console.log(`🧹 SSE: Stream cancelled for connection ${connectionId}. Reason:`, reason);
          // Znajdujemy właściwe połączenie i je czyścimy.
          const connToClean = Array.from(sessionConnections.get(sessionId) || []).find(c => c.connectionId === connectionId);
          if (connToClean) {
              cleanupConnection(sessionId, connToClean);
          }
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const body = await request.json()
    const { action, userId } = body

    if (action === 'release_insights') {
      const success = await sessionDb.releaseInsights(sessionId)
      if (!success) {
        return NextResponse.json({ error: 'Failed to release insights' }, { status: 500 })
      }
      const updatedSession = await sessionDb.getSession(sessionId)
      return NextResponse.json({ success: true, session: updatedSession, message: 'Insights released successfully' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (error) {
    console.error('❌ PATCH: CRITICAL error in session endpoint:', error)
    return NextResponse.json({
      error: 'Failed to process session action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function formatSSEEvent(event: SSEEvent): string {
  const data = JSON.stringify(event.data)
  return `event: ${event.type}\ndata: ${data}\n\n`
}

function cleanupConnection(sessionId: string, connection: SSEConnection) {
  if (!connection.isActive) {
    return; // Już wyczyszczone
  }

  connection.isActive = false;
  if (connection.heartbeatInterval) {
    clearInterval(connection.heartbeatInterval);
    connection.heartbeatInterval = undefined;
  }

  try {
      if (connection.controller.desiredSize !== null) {
          connection.controller.close();
      }
  } catch (e) {
      // Ignoruj, prawdopodobnie już zamknięte
  }

  console.log(`🗑️ SSE: CLEANUP connection ${connection.connectionId} from session ${sessionId}`)

  const connections = sessionConnections.get(sessionId)
  if (connections) {
    connections.delete(connection)
    if (connections.size === 0) {
      sessionConnections.delete(sessionId)
      console.log(`🗑️ SSE: Removed EMPTY session ${sessionId} from connections map`)
    }
  }

  logConnectionState(sessionId, 'CONNECTION_CLEANED', {
    cleanedConnectionId: connection.connectionId,
    connectionAge: Date.now() - connection.connectedAt.getTime()
  })
}

export function broadcastToSession(sessionId: string, event: SSEEvent) {
  const upperSessionId = sessionId.toUpperCase()
  const connections = sessionConnections.get(upperSessionId)

  if (!connections || connections.size === 0) {
    return
  }

  const eventData = formatSSEEvent(event)
  for (const connection of connections) {
    connection.writer.write(eventData)
  }
}

// ... reszta funkcji eksportowanych (broadcastSessionUpdate, etc.) pozostaje bez zmian ...

export async function broadcastSessionUpdate(sessionId: string, updateType?: string, payload?: any) {
  try {
    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      return
    }
    const event: SSEEvent = {
      type: 'session_updated',
      data: { sessionId, session, updateType, timestamp: new Date().toISOString() }
    }
    broadcastToSession(sessionId, event)
  } catch (error) {
    console.error(`❌ SSE: Failed to broadcast session update for ${sessionId}:`, error)
  }
}

// ... pozostałe funkcje broadcast bez zmian ...
export function broadcastParticipantJoined(sessionId: string, userId: string) {
  const event: SSEEvent = { type: 'participant_joined', data: { sessionId, userId, message: 'New participant joined', timestamp: new Date().toISOString() } };
  broadcastToSession(sessionId, event);
}

export function broadcastParticipantProfileAdded(sessionId: string, userId: string, profile: any) {
  const event: SSEEvent = { type: 'participant_profile_added', data: { sessionId, userId, profile, message: 'Participant added profile', timestamp: new Date().toISOString() } };
  broadcastToSession(sessionId, event);
}

export function broadcastSessionStatusChanged(sessionId: string, newStatus: string, oldStatus?: string) {
  const event: SSEEvent = { type: 'session_status_changed', data: { sessionId, newStatus, oldStatus, message: `Session status changed to ${newStatus}`, timestamp: new Date().toISOString() } };
  broadcastToSession(sessionId, event);
}

export function broadcastQuizStarted(sessionId: string) {
  const event: SSEEvent = { type: 'quiz_started', data: { sessionId, message: 'Quiz has started!', timestamp: new Date().toISOString() } };
  broadcastToSession(sessionId, event);
}