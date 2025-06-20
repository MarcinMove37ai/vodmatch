// src/app/api/session/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionManager } from '@/lib/sessionManager'
import {
  AppSession,
  UpdateSessionPlatformsRequest,
  UpdateSessionModeRequest,
  UpdateSessionProfileRequest
} from '@/types/session'

interface ApiError {
  error: string
  details?: string
}

// GET - Pobierz sesję
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<AppSession | ApiError>> {
  try {
    const sessionId = params.id.toUpperCase() // Case-insensitive

    console.log(`📖 GET Session: ${sessionId}`)

    const session = sessionManager.getSession(sessionId)

    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    console.log(`✅ Session retrieved: ${sessionId}, status: ${session.status}`)

    return NextResponse.json(session)

  } catch (error) {
    console.error('❌ Error getting session:', error)
    return NextResponse.json({
      error: 'Failed to get session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH - Aktualizuj sesję
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<AppSession | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const body = await request.json()
    const { action, userId } = body

    console.log(`🔄 PATCH Session: ${sessionId}, action: ${action}, user: ${userId}`)

    if (!userId) {
      return NextResponse.json({
        error: 'UserId is required'
      }, { status: 400 })
    }

    let success = false

    switch (action) {
      case 'update_platforms': {
        const { platforms } = body as UpdateSessionPlatformsRequest
        if (!platforms) {
          return NextResponse.json({
            error: 'Platforms data is required'
          }, { status: 400 })
        }
        success = sessionManager.updatePlatforms(sessionId, userId, platforms)
        break
      }

      case 'update_mode': {
        const { mode } = body as UpdateSessionModeRequest
        if (!mode) {
          return NextResponse.json({
            error: 'Mode data is required'
          }, { status: 400 })
        }
        success = sessionManager.updateMode(sessionId, userId, mode)
        break
      }

      case 'update_admin_profile': {
        const { profile, sessionData } = body as UpdateSessionProfileRequest & { sessionData?: any }
        if (!profile) {
          return NextResponse.json({
            error: 'Profile data is required'
          }, { status: 400 })
        }
        success = sessionManager.updateAdminProfile(sessionId, userId, profile, sessionData)
        break
      }

      case 'update_participant_profile': {
        const { profile } = body as UpdateSessionProfileRequest
        if (!profile) {
          return NextResponse.json({
            error: 'Profile data is required'
          }, { status: 400 })
        }
        success = sessionManager.updateParticipantProfile(sessionId, userId, profile)
        break
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 })
    }

    if (!success) {
      console.log(`❌ Failed to execute action: ${action} for session: ${sessionId}`)
      return NextResponse.json({
        error: 'Failed to update session. Check session ID and permissions.'
      }, { status: 400 })
    }

    // Pobierz zaktualizowaną sesję
    const updatedSession = sessionManager.getSession(sessionId)

    if (!updatedSession) {
      return NextResponse.json({
        error: 'Session not found after update'
      }, { status: 404 })
    }

    console.log(`✅ Session updated successfully: ${sessionId}, new status: ${updatedSession.status}`)

    return NextResponse.json(updatedSession)

  } catch (error) {
    console.error('❌ Error updating session:', error)
    return NextResponse.json({
      error: 'Failed to update session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Usuń sesję (opcjonalne)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ success: boolean } | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const { userId } = await request.json()

    console.log(`🗑️ DELETE Session: ${sessionId} by user: ${userId}`)

    const session = sessionManager.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found'
      }, { status: 404 })
    }

    // Tylko admin może usunąć sesję
    if (session.adminId !== userId) {
      return NextResponse.json({
        error: 'Only session admin can delete session'
      }, { status: 403 })
    }

    // Usuń sesję (hack: ustawiamy datę wygaśnięcia na przeszłość)
    session.expiresAt = new Date(Date.now() - 1000)
    sessionManager.cleanExpiredSessions()

    console.log(`✅ Session deleted: ${sessionId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error deleting session:', error)
    return NextResponse.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}