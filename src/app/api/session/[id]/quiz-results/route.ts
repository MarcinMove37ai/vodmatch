// src/app/api/session/[sessionId]/quiz-results/route.ts - FIXED ASYNC PARAMS
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 🔧 CRITICAL FIX: await params in Next.js 15+
    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    console.log(`📊 API: Getting quiz results for session ${sessionId}`)

    // Get quiz results from database
    const results = await sessionDb.getQuizResults(sessionId)

    console.log(`✅ API: Retrieved ${results.length} quiz results for session ${sessionId}`)

    return NextResponse.json({
      success: true,
      results: results
    })

  } catch (error) {
    console.error('❌ API: Error fetching quiz results:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch quiz results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}