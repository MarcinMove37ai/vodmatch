// src/app/api/session/[id]/join/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'

interface JoinSessionRequest {
  userId: string
}

interface JoinSessionResponse {
  success: boolean
  session: any
  participantId: string
}

interface ApiError {
  error: string
  details?: string
}

type ApiResponse = JoinSessionResponse | ApiError

// POST - Join existing session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
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
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()

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