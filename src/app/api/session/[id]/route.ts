// src/app/api/session/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'
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
          'close_registration' | 'start_quiz' | 'set_movie_preferences' |
          'start_movie_tinder' // Dodano nową akcję
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
  moviePreferences?: {
    excludedGenres: string[]
    minImdbRating: number
  }
}

// GET - Pobierz sesję z PostgreSQL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()

    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

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

    const session = await sessionDb.getSession(sessionId)
    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    const oldStatus = session.status

    if (action === 'update_participant_profile') {
      const userProfile = await sessionDb.getUserProfile(sessionId, userId)
      if (!userProfile) {
        return NextResponse.json({
          error: 'User not found in session'
        }, { status: 403 })
      }
    } else if (action === 'set_movie_preferences') {
      const userProfile = await sessionDb.getUserProfile(sessionId, userId)
      if (!userProfile) {
        return NextResponse.json({
          error: 'User not found in session'
        }, { status: 403 })
      }
    } else {
      // Dla wszystkich innych akcji wymagamy uprawnień admina
      if (session.adminId !== userId) {
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
        if (!platforms) { return NextResponse.json({ error: 'Platforms data is required' }, { status: 400 }) }
        success = await sessionDb.updatePlatforms(sessionId, platforms)
        if (success) {
          try { await broadcastSessionUpdate(sessionId, 'platforms_updated') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'update_mode': {
        const { mode } = body
        if (!mode) { return NextResponse.json({ error: 'Mode data is required' }, { status: 400 }) }
        success = await sessionDb.updateMode(sessionId, mode)
        if (success) {
          try { await broadcastSessionUpdate(sessionId, 'mode_updated') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'update_current_step': {
        const { currentStep } = body
        if (!currentStep) { return NextResponse.json({ error: 'CurrentStep data is required' }, { status: 400 }) }
        success = await sessionDb.updateCurrentStep(sessionId, currentStep)
        break
      }

      case 'update_admin_profile': {
        const { profile } = body
        if (!profile) { return NextResponse.json({ error: 'Profile data is required' }, { status: 400 }) }
        success = await sessionDb.updateAdminProfile(sessionId, profile)
        if (success) {
          try { await broadcastSessionUpdate(sessionId, 'admin_profile_updated') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'update_participant_profile': {
        const { profile } = body
        if (!profile) { return NextResponse.json({ error: 'Profile data is required' }, { status: 400 }) }
        const platform = profile.platform || 'instagram'
        const username = profile.username || profile.name || 'unknown'
        const pic_url = profile.profilePictureUrl || (profile as any).profilepic_url || (profile as any).profilePicUrl || null
        let posts: string | undefined = undefined
        if ((profile as any).followers_count || (profile as any).posts_count || (profile as any).followers || (profile as any).connections) {
          const stats = []
          if ((profile as any).followers_count) stats.push(`${(profile as any).followers_count} followers`)
          if ((profile as any).posts_count) stats.push(`${(profile as any).posts_count} posts`)
          if ((profile as any).followers) stats.push(`${(profile as any).followers} followers`)
          if ((profile as any).connections) stats.push(`${(profile as any).connections} connections`)
          posts = stats.join(', ')
        }
        success = await sessionDb.saveUserProfile(sessionId, userId, { platform: platform as 'instagram' | 'linkedin', username: username, pic_url: pic_url, posts: posts }, false)
        if (success) {
          try { broadcastParticipantProfileAdded(sessionId, userId, { platform, username, pic_url, posts }) } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
          const allProfiles = await sessionDb.getSessionProfiles(sessionId)
          const participantProfiles = allProfiles.filter(p => !p.isAdmin)
          const joinedParticipants = participantProfiles.filter(p => p.platform && p.username && p.username !== `temp_${p.userId.slice(-8)}`)
          if (joinedParticipants.length === participantProfiles.length && session.status === 'collecting_profiles') {
            await sessionDb.updateStatus(sessionId, 'ready_for_quiz')
            statusChanged = true
          }
          try { await broadcastSessionUpdate(sessionId, 'participant_profile_updated') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'close_registration': {
        success = await sessionDb.closeRegistration(sessionId)
        if (success) {
          statusChanged = true
          try {
            broadcastSessionStatusChanged(sessionId, 'collecting_profiles', oldStatus)
            await broadcastSessionUpdate(sessionId, 'registration_closed')
          } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'start_quiz': {
        const allProfiles = await sessionDb.getSessionProfiles(sessionId)
        const participantProfiles = allProfiles.filter(p => !p.isAdmin)
        const readyParticipants = participantProfiles.filter(p => p.platform && p.username && p.username !== `temp_${p.userId.slice(-8)}`)
        if (readyParticipants.length < participantProfiles.length) {
          return NextResponse.json({ error: `Not all participants ready. ${readyParticipants.length}/${participantProfiles.length} have profiles.` }, { status: 400 })
        }
        success = await sessionDb.startQuiz(sessionId)
        if (success) {
          statusChanged = true
          try {
            broadcastQuizStarted(sessionId)
            broadcastSessionStatusChanged(sessionId, 'quiz_active', oldStatus)
            await broadcastSessionUpdate(sessionId, 'quiz_started')
          } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      case 'set_movie_preferences': {
        const { moviePreferences } = body
        if (!moviePreferences) { return NextResponse.json({ error: 'Movie preferences data is required' }, { status: 400 }) }
        if (!Array.isArray(moviePreferences.excludedGenres) || moviePreferences.excludedGenres.length !== 3 || typeof moviePreferences.minImdbRating !== 'number' || moviePreferences.minImdbRating < 1 || moviePreferences.minImdbRating > 8) {
          return NextResponse.json({ error: 'Invalid movie preferences format' }, { status: 400 })
        }
        const sessionWithProfiles = session as any
        const userProfile = sessionWithProfiles.profiles?.find((p: any) => p.userId === userId)
        if (!userProfile) { return NextResponse.json({ error: 'User not found in session' }, { status: 403 }) }
        const hasCompletedQuiz = !!(userProfile.quiz_result && typeof userProfile.quiz_result === 'object' && userProfile.quiz_result.completedAt)
        if (!hasCompletedQuiz) { return NextResponse.json({ error: 'Only users who completed quiz can set preferences' }, { status: 403 }) }
        success = await sessionDb.setMoviePreferences(sessionId, moviePreferences)
        if (success) {
          try { await broadcastSessionUpdate(sessionId, 'movie_preferences_set') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
        }
        break
      }

      // ✅ DODANO: Nowa akcja do rozpoczęcia etapu 'Movie Tinder'
      case 'start_movie_tinder': {
        console.log(`🎬 Action: Starting Movie Tinder for session ${sessionId}`);
        // Autoryzacja admina jest już sprawdzona na początku funkcji `PATCH`
        success = await sessionDb.updateCurrentStep(sessionId, 'movie_tinder');

        if (success) {
          // Po aktualizacji bazy, rozgłoś zmianę do wszystkich przez SSE
          console.log(`📢 SSE: Broadcasting movie tinder start for session ${sessionId}`);
          try {
            await broadcastSessionUpdate(sessionId, 'movie_tinder_started');
          } catch (sseError) {
            console.log(`⚠️ SSE: Failed to broadcast movie tinder start:`, sseError);
          }
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    const updatedSession = await sessionDb.getSession(sessionId)

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found after update' }, { status: 404 })
    }

    if (statusChanged && updatedSession.status !== oldStatus) {
      try { broadcastSessionStatusChanged(sessionId, updatedSession.status, oldStatus) } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }
    }

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

    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.adminId !== userId) {
      return NextResponse.json({ error: 'Only session admin can delete session' }, { status: 403 })
    }

    const deleteSuccess = await sessionDb.deleteSession(sessionId)

    if (!deleteSuccess) {
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }

    try { await broadcastSessionUpdate(sessionId, 'session_deleted') } catch (e) { console.log(`⚠️ SSE broadcast failed`, e) }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error deleting session:', error)
    return NextResponse.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}