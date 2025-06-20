// src/app/api/session/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'
import { CreateSessionRequest, CreateSessionResponse } from '@/types/session'

interface ApiError {
  error: string
  details?: string
}

type ApiResponse = CreateSessionResponse | ApiError

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('=== CREATE SESSION API CALL START ===')
    console.log('🌍 Environment:', process.env.NODE_ENV)
    console.log('📍 Client IP:', request.headers.get('x-forwarded-for') || 'unknown')
    console.log('🕐 Timestamp:', new Date().toISOString())

    const body: CreateSessionRequest = await request.json()
    const { userId } = body

    console.log('👤 Creating session for user:', userId)

    if (!userId) {
      console.log('❌ No userId provided')
      return NextResponse.json({
        error: 'UserId is required'
      }, { status: 400 })
    }

    // Walidacja userId (podstawowa)
    if (!userId.startsWith('user_') || userId.length < 10) {
      console.log('❌ Invalid userId format:', userId)
      return NextResponse.json({
        error: 'Invalid userId format'
      }, { status: 400 })
    }

    // Sprawdź czy użytkownik nie ma już aktywnej sesji jako admin
    const existingSessions = sessionManager.getAllSessions()
    const userActiveSessions = existingSessions.filter(session => session.adminId === userId)

    if (userActiveSessions.length > 0) {
      const existingSession = userActiveSessions[0]
      console.log(`⚠️ User ${userId} already has active session: ${existingSession.sessionId}`)

      // Zwróć istniejącą sesję zamiast tworzyć nową
      return NextResponse.json({
        sessionId: existingSession.sessionId,
        userId: userId,
        expiresAt: existingSession.expiresAt
      })
    }

    // Utwórz nową sesję
    const sessionResponse = sessionManager.createSession(userId)

    console.log('✅ Session created successfully:', {
      sessionId: sessionResponse.sessionId,
      userId: userId,
      expiresAt: sessionResponse.expiresAt
    })

    // Wyczyść wygasłe sesje przy okazji
    const cleanedCount = sessionManager.cleanExpiredSessions()
    if (cleanedCount > 0) {
      console.log(`🗑️ Cleaned ${cleanedCount} expired sessions`)
    }

    // Loguj statystyki
    const stats = sessionManager.getStats()
    console.log('📊 Session stats:', stats)

    console.log('=== CREATE SESSION API CALL END ===')

    return NextResponse.json(sessionResponse)

  } catch (error) {
    console.error('❌ CRITICAL ERROR in Create Session API:', error)
    console.log('=== CREATE SESSION API CALL FAILED ===')

    return NextResponse.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method dla sprawdzenia statusu API
export async function GET(): Promise<NextResponse> {
  console.log('📊 Session create API health check')

  const stats = sessionManager.getStats()

  return NextResponse.json({
    status: 'healthy',
    endpoint: 'session/create',
    stats: stats,
    timestamp: new Date().toISOString()
  })
}