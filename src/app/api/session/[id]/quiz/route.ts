// src/app/api/session/[id]/quiz/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'

interface QuizResults {
  userId: string
  displayName: string
  answers: any[]
  completedAt: Date
  preferences: any
}

interface SubmitQuizResultsRequest {
  userId: string
  results: QuizResults
}

interface ApiError {
  error: string
  details?: string
}

// POST - Submit quiz results
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean } | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const body: SubmitQuizResultsRequest = await request.json()
    const { userId, results } = body

    console.log(`📝 POST Quiz Results: ${sessionId}, user: ${userId}`)

    if (!userId || !results) {
      return NextResponse.json({
        error: 'UserId and results are required'
      }, { status: 400 })
    }

    // Validate results structure
    if (!results.answers || !Array.isArray(results.answers)) {
      return NextResponse.json({
        error: 'Invalid quiz results format'
      }, { status: 400 })
    }

    const success = sessionManager.submitQuizResults(sessionId, userId, results)

    if (!success) {
      console.log(`❌ Failed to submit quiz results for session: ${sessionId}`)
      return NextResponse.json({
        error: 'Failed to submit quiz results. Check session ID and permissions.'
      }, { status: 400 })
    }

    console.log(`✅ Quiz results submitted successfully for user ${userId} in session ${sessionId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error submitting quiz results:', error)
    return NextResponse.json({
      error: 'Failed to submit quiz results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get quiz status for session (optional)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()

    console.log(`📊 GET Quiz Status: ${sessionId}`)

    const session = sessionManager.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    const quizStatus = {
      sessionId: session.sessionId,
      status: session.status,
      currentStep: session.currentStep,
      totalParticipants: 1 + session.participants.length, // Admin + participants
      completedQuizzes: session.quizResults.length,
      quizResults: session.quizResults.map((result: any) => ({
        userId: result.userId,
        displayName: result.displayName,
        completedAt: result.completedAt,
        answerCount: result.answers.length
      }))
    }

    return NextResponse.json(quizStatus)

  } catch (error) {
    console.error('❌ Error getting quiz status:', error)
    return NextResponse.json({
      error: 'Failed to get quiz status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}