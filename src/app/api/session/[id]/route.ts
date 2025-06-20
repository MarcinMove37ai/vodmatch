// src/app/api/session/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

interface ApiError {
  error: string
  details?: string
}

interface UpdateSessionRequest {
  action: 'update_platforms' | 'update_mode' | 'update_admin_profile' | 'update_participant_profile' | 'update_current_step'
  userId: string
  platforms?: string[]
  mode?: string
  currentStep?: string
  profile?: {
    platform: string
    username: string
    name: string
    profilePictureUrl: string
  }
}

// GET - Pobierz sesję z PostgreSQL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase() // Case-insensitive

    console.log(`📖 GET Session (PostgreSQL): ${sessionId}`)

    const session = await sessionDb.getSession(sessionId)

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

// PATCH - Aktualizuj sesję w PostgreSQL
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const body = await request.json() as UpdateSessionRequest
    const { action, userId } = body

    console.log(`🔄 PATCH Session (PostgreSQL): ${sessionId}, action: ${action}, user: ${userId}`)

    if (!userId) {
      return NextResponse.json({
        error: 'UserId is required'
      }, { status: 400 })
    }

    // Verify session exists and user has permission
    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    if (session.adminId !== userId) {
      console.log(`❌ User ${userId} not authorized for session ${sessionId} (admin: ${session.adminId})`)
      return NextResponse.json({
        error: 'Not authorized to modify this session'
      }, { status: 403 })
    }

    let success = false

    switch (action) {
      case 'update_platforms': {
        const { platforms } = body
        if (!platforms) {
          return NextResponse.json({
            error: 'Platforms data is required'
          }, { status: 400 })
        }
        success = await sessionDb.updatePlatforms(sessionId, platforms)
        break
      }

      case 'update_mode': {
        const { mode } = body
        if (!mode) {
          return NextResponse.json({
            error: 'Mode data is required'
          }, { status: 400 })
        }
        success = await sessionDb.updateMode(sessionId, mode)
        break
      }

      case 'update_current_step': {
        const { currentStep } = body
        if (!currentStep) {
          return NextResponse.json({
            error: 'CurrentStep data is required'
          }, { status: 400 })
        }
        success = await sessionDb.updateCurrentStep(sessionId, currentStep)
        break
      }

      case 'update_admin_profile': {
        const { profile } = body
        if (!profile) {
          return NextResponse.json({
            error: 'Profile data is required'
          }, { status: 400 })
        }
        success = await sessionDb.updateAdminProfile(sessionId, profile)
        break
      }

      case 'update_participant_profile': {
        // TODO: Implement when adding multi-user support
        return NextResponse.json({
          error: 'Participant profiles not yet implemented'
        }, { status: 501 })
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 })
    }

    if (!success) {
      console.log(`❌ Failed to execute action: ${action} for session: ${sessionId}`)
      return NextResponse.json({
        error: 'Failed to update session'
      }, { status: 500 })
    }

    // Return updated session
    const updatedSession = await sessionDb.getSession(sessionId)

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
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean } | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const { userId } = await request.json()

    console.log(`🗑️ DELETE Session (PostgreSQL): ${sessionId} by user: ${userId}`)

    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found'
      }, { status: 404 })
    }

    // Only admin can delete session
    if (session.adminId !== userId) {
      return NextResponse.json({
        error: 'Only session admin can delete session'
      }, { status: 403 })
    }

    // Delete session from PostgreSQL
    const deleteSuccess = await sessionDb.deleteSession(sessionId)

    if (!deleteSuccess) {
      return NextResponse.json({
        error: 'Failed to delete session'
      }, { status: 500 })
    }

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