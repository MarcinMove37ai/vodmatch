// src/app/api/session/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

interface CreateSessionRequest {
  userId: string
}

interface CreateSessionResponse {
  sessionId: string
  userId: string
  expiresAt: Date
}

interface ApiError {
  error: string
  details?: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateSessionResponse | ApiError>> {
  try {
    console.log('=== CREATE SESSION API CALL START (PostgreSQL) ===')
    console.log('🌍 Environment:', process.env.NODE_ENV)
    console.log('📍 Client IP:', request.headers.get('x-forwarded-for') || 'localhost')
    console.log('🕐 Timestamp:', new Date().toISOString())

    // Parse request body
    const { userId } = await request.json() as CreateSessionRequest

    if (!userId) {
      console.log('❌ Missing userId in request')
      return NextResponse.json({
        error: 'UserId is required'
      }, { status: 400 })
    }

    console.log(`👤 Creating session for user: ${userId}`)

    // Create session in PostgreSQL
    const { sessionId, expiresAt } = await sessionDb.createSession(userId)

    console.log(`✅ Session created successfully: {`)
    console.log(`  sessionId: '${sessionId}',`)
    console.log(`  userId: '${userId}',`)
    console.log(`  expiresAt: ${expiresAt.toISOString()}`)
    console.log(`}`)

    // Get session stats (optional - for monitoring)
    try {
      await sessionDb.cleanExpiredSessions()
      console.log('🧹 Cleaned expired sessions')
    } catch (cleanupError) {
      console.log('⚠️ Cleanup warning:', cleanupError)
    }

    console.log('=== CREATE SESSION API CALL END (PostgreSQL) ===')

    return NextResponse.json({
      sessionId,
      userId,
      expiresAt
    })

  } catch (error) {
    console.error('❌ Error creating session:', error)
    console.log('=== CREATE SESSION API CALL ERROR ===')

    return NextResponse.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}