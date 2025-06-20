// src/app/api/test-create/route.ts
import { NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

export async function POST() {
  try {
    console.log('🧪 Testing session creation...')

    // Generate test user ID
    const testUserId = `user_test_${Date.now()}`

    // Create session
    const result = await sessionDb.createSession(testUserId)

    console.log('✅ Session created successfully:', result)

    return NextResponse.json({
      status: 'success',
      message: 'Session created successfully',
      sessionId: result.sessionId,
      adminId: testUserId,
      expiresAt: result.expiresAt,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Session creation failed:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Session creation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}