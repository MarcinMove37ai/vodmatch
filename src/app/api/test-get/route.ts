// src/app/api/test-get/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

export async function GET(request: NextRequest) {
  try {
    // Get sessionId from query params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json({
        status: 'error',
        message: 'Session ID is required'
      }, { status: 400 })
    }

    console.log(`🧪 Testing get session: ${sessionId}`)

    // Get session
    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        status: 'error',
        message: 'Session not found or expired'
      }, { status: 404 })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Session found successfully',
      session: {
        sessionId: session.sessionId,
        adminId: session.adminId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        status: session.status,
        currentStep: session.currentStep
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Get session failed:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Get session failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}