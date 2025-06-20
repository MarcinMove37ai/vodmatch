// src/app/api/session/[id]/quiz/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'
import { QuizResults, SubmitQuizResultsRequest } from '@/types/session'

interface ApiError {
  error: string
  details?: string
}

// POST - Submit quiz results
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ success: boolean } | ApiError>> {
  try {
    const sessionId = params.id.toUpperCase()
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
  { params }: { params: { id: string } }
): Promise<NextResponse<any | ApiError>> {
  try {
    const sessionId = params.id.toUpperCase()

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
      quizResults: session.quizResults.map(result => ({
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
}// src/app/api/session/[id]/join/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'
import { JoinSessionRequest, JoinSessionResponse, AppSession } from '@/types/session'

interface ApiError {
  error: string
  details?: string
}

type ApiResponse = JoinSessionResponse | ApiError

// POST - Join existing session
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse>> {
  try {
    const sessionId = params.id.toUpperCase()
    const body: JoinSessionRequest = await request.json()
    const { userId } = body

    console.log(`🤝 POST Join Session: ${sessionId}, user: ${userId}`)

    if (!userId) {
      return NextResponse.json({
        error: 'UserId is required'
      }, { status: 400 })
    }

    // Validate userId format
    if (!userId.startsWith('user_') || userId.length < 10) {
      console.log('❌ Invalid userId format for join:', userId)
      return NextResponse.json({
        error: 'Invalid userId format'
      }, { status: 400 })
    }

    // Get session to validate it exists and is joinable
    const session = sessionManager.getSession(sessionId)

    if (!session) {
      console.log(`❌ Session not found for join: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // Check if session is in correct state for joining
    if (session.status !== 'setup' && session.status !== 'collecting_profiles') {
      console.log(`❌ Session ${sessionId} not accepting new participants, status: ${session.status}`)
      return NextResponse.json({
        error: 'Session is not accepting new participants'
      }, { status: 400 })
    }

    // Check if it's not a solo session
    if (session.viewingMode?.id === 'solo') {
      console.log(`❌ Cannot join solo session: ${sessionId}`)
      return NextResponse.json({
        error: 'Cannot join solo session'
      }, { status: 400 })
    }

    // Check if user is not already the admin
    if (session.adminId === userId) {
      console.log(`❌ Admin cannot join as participant: ${userId}`)
      return NextResponse.json({
        error: 'Session admin cannot join as participant'
      }, { status: 400 })
    }

    // Attempt to join session
    const success = sessionManager.joinSession(sessionId, userId)

    if (!success) {
      console.log(`❌ Failed to join session: ${sessionId}`)
      return NextResponse.json({
        error: 'Failed to join session. Session might be full or in wrong state.'
      }, { status: 400 })
    }

    // Get updated session
    const updatedSession = sessionManager.getSession(sessionId)

    if (!updatedSession) {
      return NextResponse.json({
        error: 'Session not found after join'
      }, { status: 404 })
    }

    console.log(`✅ User ${userId} successfully joined session ${sessionId}`)

    // Update session status if needed
    if (updatedSession.status === 'setup' && updatedSession.viewingMode) {
      updatedSession.status = 'collecting_profiles'
      updatedSession.currentStep = 'participant_profiles'
    }

    const response: JoinSessionResponse = {
      success: true,
      session: updatedSession,
      participantId: userId
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error joining session:', error)
    return NextResponse.json({
      error: 'Failed to join session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get session info for joining (preview before join)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<any | ApiError>> {
  try {
    const sessionId = params.id.toUpperCase()

    console.log(`👀 GET Join Preview: ${sessionId}`)

    const session = sessionManager.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // Return limited session info for preview
    const sessionPreview = {
      sessionId: session.sessionId,
      viewingMode: session.viewingMode,
      selectedPlatforms: session.selectedPlatforms,
      adminProfile: session.adminProfile ? {
        displayName: session.adminProfile.displayName,
        profilePicUrl: session.adminProfile.profilePicUrl,
        platform: session.adminProfile.platform
      } : null,
      participantCount: session.participants.length,
      maxParticipants: session.viewingMode?.id === 'couple' ? 2 : 8, // Admin + participants
      status: session.status,
      canJoin: (
        session.status === 'setup' ||
        session.status === 'collecting_profiles'
      ) &&
      session.viewingMode?.id !== 'solo' &&
      session.participants.length < (session.viewingMode?.id === 'couple' ? 1 : 7),
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }

    return NextResponse.json(sessionPreview)

  } catch (error) {
    console.error('❌ Error getting join preview:', error)
    return NextResponse.json({
      error: 'Failed to get session preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}