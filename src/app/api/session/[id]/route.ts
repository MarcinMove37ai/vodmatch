// src/app/api/session/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'
// 🆕 SSE INTEGRATION: Import broadcast functions
import {
  broadcastParticipantProfileAdded,
  broadcastSessionStatusChanged,
  broadcastQuizStarted,
  broadcastSessionUpdate
} from './events/route'

interface ApiError {
  error: string
  details?: string
}

interface UpdateSessionRequest {
  action: 'update_platforms' | 'update_mode' | 'update_admin_profile' |
          'update_participant_profile' | 'update_current_step' |
          'close_registration' | 'start_quiz'  // 🆕 NOWE ACTIONS
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

    // Verify session exists
    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // Store old status for SSE broadcast comparison
    const oldStatus = session.status

    // 🆕 ENHANCED: Authorization logic based on action type
    if (action === 'update_participant_profile') {
      // For participant profile updates: check if user belongs to session
      const userProfile = await sessionDb.getUserProfile(sessionId, userId)
      if (!userProfile) {
        console.log(`❌ User ${userId} not found in session ${sessionId}`)
        return NextResponse.json({
          error: 'User not found in session'
        }, { status: 403 })
      }
      // Participants can update their own profiles
      console.log(`✅ Participant ${userId} authorized to update their profile`)
    } else {
      // For admin actions: require admin authorization
      if (session.adminId !== userId) {
        console.log(`❌ User ${userId} not authorized for session ${sessionId} (admin: ${session.adminId})`)
        return NextResponse.json({
          error: 'Not authorized to modify this session'
        }, { status: 403 })
      }
    }

    let success = false
    let statusChanged = false

    switch (action) {
      case 'update_platforms': {
        const { platforms } = body
        if (!platforms) {
          return NextResponse.json({
            error: 'Platforms data is required'
          }, { status: 400 })
        }
        success = await sessionDb.updatePlatforms(sessionId, platforms)

        // 🆕 SSE BROADCAST: Session updated with new platforms
        if (success) {
          console.log(`📢 SSE: Broadcasting platforms update for session ${sessionId}`)
          try {
            await broadcastSessionUpdate(sessionId, 'platforms_updated')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast platforms update:`, sseError)
          }
        }
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

        // 🆕 SSE BROADCAST: Session updated with new mode
        if (success) {
          console.log(`📢 SSE: Broadcasting mode update for session ${sessionId}`)
          try {
            await broadcastSessionUpdate(sessionId, 'mode_updated')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast mode update:`, sseError)
          }
        }
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

        // 🆕 SSE BROADCAST: Admin profile updated
        if (success) {
          console.log(`📢 SSE: Broadcasting admin profile update for session ${sessionId}`)
          try {
            await broadcastSessionUpdate(sessionId, 'admin_profile_updated')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast admin profile update:`, sseError)
          }
        }
        break
      }

      case 'update_participant_profile': {
        // 🆕 IMPLEMENTED: Participant profile update
        const { profile } = body
        if (!profile) {
          return NextResponse.json({
            error: 'Profile data is required'
          }, { status: 400 })
        }

        console.log(`💾 Updating participant profile for user ${userId}`)

        // Extract platform from profile data (same logic as admin)
        const platform = profile.platform || 'instagram' // Default fallback
        const username = profile.username || profile.name || 'unknown'
        const pic_url = profile.profilePictureUrl || (profile as any).profilepic_url || (profile as any).profilePicUrl || null

        // Create posts text from follower data (if available)
        let posts: string | undefined = undefined
        if ((profile as any).followers_count || (profile as any).posts_count || (profile as any).followers || (profile as any).connections) {
          const stats = []
          if ((profile as any).followers_count) stats.push(`${(profile as any).followers_count} followers`)
          if ((profile as any).posts_count) stats.push(`${(profile as any).posts_count} posts`)
          if ((profile as any).followers) stats.push(`${(profile as any).followers} followers`)
          if ((profile as any).connections) stats.push(`${(profile as any).connections} connections`)
          posts = stats.join(', ')
        }

        // Save participant profile with hasJoined=true (auto-set when real profile is added)
        success = await sessionDb.saveUserProfile(
          sessionId,
          userId,
          {
            platform: platform as 'instagram' | 'linkedin',
            username: username,
            pic_url: pic_url,
            posts: posts
          },
          false // isAdmin = false (participant)
        )

        if (success) {
          // 🆕 SSE BROADCAST: Participant profile added
          console.log(`📢 SSE: Broadcasting participant profile added - ${userId} to session ${sessionId}`)
          try {
            broadcastParticipantProfileAdded(sessionId, userId, {
              platform,
              username,
              pic_url,
              posts
            })
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast participant profile added:`, sseError)
          }

          // 🆕 Update hasJoined to true since participant added real profile
          // This is handled automatically by saveUserProfile when real data is provided
          console.log(`✅ Participant ${userId} profile updated and marked as joined`)

          // 🆕 Check if we should update session status
          const allProfiles = await sessionDb.getSessionProfiles(sessionId)
          const participantProfiles = allProfiles.filter(p => !p.isAdmin)
          const joinedParticipants = participantProfiles.filter(p =>
            p.platform && p.username && p.username !== `temp_${p.userId.slice(-8)}`
          )

          console.log(`📊 Session progress: ${joinedParticipants.length}/${participantProfiles.length} participants have profiles`)

          // If all participants have profiles, admin can start quiz
          if (joinedParticipants.length === participantProfiles.length && session.status === 'collecting_profiles') {
            await sessionDb.updateStatus(sessionId, 'ready_for_quiz')
            statusChanged = true
            console.log(`🎯 All participants ready - session can start quiz`)
          }

          // 🆕 SSE BROADCAST: General session update after profile change
          try {
            await broadcastSessionUpdate(sessionId, 'participant_profile_updated')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast general session update:`, sseError)
          }
        }

        break
      }

      // 🆕 NOWA AKCJA: Zamknij rejestrację
      case 'close_registration': {
        console.log(`🚪 Closing registration for session ${sessionId}`)
        success = await sessionDb.closeRegistration(sessionId)

        if (success) {
          statusChanged = true
          // 🆕 SSE BROADCAST: Registration closed
          console.log(`📢 SSE: Broadcasting registration closed for session ${sessionId}`)
          try {
            broadcastSessionStatusChanged(sessionId, 'collecting_profiles', oldStatus)
            await broadcastSessionUpdate(sessionId, 'registration_closed')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast registration closed:`, sseError)
          }
        }
        break
      }

      // 🆕 NOWA AKCJA: Rozpocznij quiz
      case 'start_quiz': {
        console.log(`🎯 Starting quiz for session ${sessionId}`)

        // Sprawdź czy wszyscy uczestnicy mają profile
        const allProfiles = await sessionDb.getSessionProfiles(sessionId)
        const participantProfiles = allProfiles.filter(p => !p.isAdmin)
        const readyParticipants = participantProfiles.filter(p =>
          p.platform && p.username && p.username !== `temp_${p.userId.slice(-8)}`
        )

        console.log(`📊 Quiz start check: ${readyParticipants.length}/${participantProfiles.length} participants ready`)

        if (readyParticipants.length < participantProfiles.length) {
          console.log(`❌ Not all participants ready for quiz`)
          return NextResponse.json({
            error: `Not all participants ready. ${readyParticipants.length}/${participantProfiles.length} have profiles.`
          }, { status: 400 })
        }

        success = await sessionDb.startQuiz(sessionId)

        if (success) {
          statusChanged = true
          // 🆕 SSE BROADCAST: Quiz started - this is critical for all participants
          console.log(`📢 SSE: Broadcasting quiz started for session ${sessionId}`)
          try {
            broadcastQuizStarted(sessionId)
            broadcastSessionStatusChanged(sessionId, 'quiz_active', oldStatus)
            await broadcastSessionUpdate(sessionId, 'quiz_started')
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast quiz started:`, sseError)
          }
        }
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

    // 🆕 SSE BROADCAST: General status change notification if status changed
    if (statusChanged && updatedSession.status !== oldStatus) {
      console.log(`📢 SSE: Session status changed from ${oldStatus} to ${updatedSession.status}`)
      try {
        broadcastSessionStatusChanged(sessionId, updatedSession.status, oldStatus)
      } catch (sseError) {
        console.log(`⚠️ SSE: Failed to broadcast status change:`, sseError)
      }
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

    // 🆕 SSE BROADCAST: Session deleted - notify all connected clients
    console.log(`📢 SSE: Broadcasting session deleted for ${sessionId}`)
    try {
      await broadcastSessionUpdate(sessionId, 'session_deleted')
    } catch (sseError) {
      console.log(`⚠️ SSE: Failed to broadcast session deleted:`, sseError)
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