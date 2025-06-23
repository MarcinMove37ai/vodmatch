// src/app/api/session/[id]/join/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'
import { sessionManager } from '@/lib/sessionManager'
// 🆕 SSE INTEGRATION: Import broadcast functions
import {
  broadcastParticipantJoined,
  broadcastSessionUpdate
} from '../events/route'

interface JoinSessionRequest {
  userId: string
}

interface JoinSessionResponse {
  success: boolean
  session: any
  participantId: string
}

interface JoinPreviewResponse {
  sessionId: string
  viewingMode: any
  selectedPlatforms: any[]
  adminProfile: {
    displayName: string
    profilePicUrl: string | null
    platform: string
    username: string
  } | null
  participantCount: number
  maxParticipants: number
  status: string
  canJoin: boolean
  createdAt: Date
  expiresAt: Date
}

interface ApiError {
  error: string
  details?: string
}

type ApiResponse = JoinSessionResponse | JoinPreviewResponse | ApiError

// POST - Join existing session (first step - creates participant entry)
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

    // 🆕 Get session from PostgreSQL instead of memory
    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      console.log(`❌ Session not found for join: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // 🔍 DEBUGGING: Szczegółowe logowanie sesji
    console.log('🔍 SESSION DEBUG:', {
      sessionId: session.sessionId,
      adminId: session.adminId,
      status: session.status,
      viewingMode: session.viewingMode,
      maxParticipants: session.maxParticipants,
      selectedPlatforms: session.selectedPlatforms,
      'typeof viewingMode': typeof session.viewingMode,
      'viewingMode === "group"': session.viewingMode === 'group',
      'viewingMode === "couple"': session.viewingMode === 'couple',
      'viewingMode === "solo"': session.viewingMode === 'solo'
    })

    // ✅ POPRAWKA: Szczegółowe sprawdzenie statusu sesji
    const allowedStatuses = ['setup', 'recruiting', 'collecting_profiles', 'ready_for_quiz']
    if (!allowedStatuses.includes(session.status)) {
      console.log(`❌ Session ${sessionId} not accepting participants. Status: ${session.status}, allowed: ${allowedStatuses.join(', ')}`)
      return NextResponse.json({
        error: `Session is not accepting new participants. Current status: ${session.status}`
      }, { status: 400 })
    }

    // Check if it's not a solo session
    if (session.viewingMode === 'solo') {
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

    // 🆕 Check if user already joined this session
    const existingProfile = await sessionDb.getUserProfile(sessionId, userId)
    if (existingProfile) {
      console.log(`⚠️ User ${userId} already in session ${sessionId}`)

      // Return existing session data
      const updatedSession = await sessionDb.getSession(sessionId)
      const response: JoinSessionResponse = {
        success: true,
        session: updatedSession,
        participantId: userId
      }
      return NextResponse.json(response)
    }

    // 🆕 Check participant limit using maxParticipants from database - Z SZCZEGÓŁOWYM DEBUGGINGIEM
    const currentParticipants = await sessionDb.getSessionProfiles(sessionId)
    const nonAdminParticipants = currentParticipants.filter(p => !p.isAdmin)

    // Calculate max based on viewing mode and database setting
    const dbMaxParticipants = session.maxParticipants || 8
    const modeMaxParticipants = session.viewingMode === 'couple' ? 2 : dbMaxParticipants
    const maxNonAdminParticipants = modeMaxParticipants - 1 // Subtract admin

    // 🔍 DEBUGGING: Szczegółowe logowanie limitów
    console.log('🔍 PARTICIPANT LIMIT DEBUG:', {
      sessionId,
      userId,
      'session.viewingMode': session.viewingMode,
      'session.maxParticipants (from DB)': session.maxParticipants,
      'dbMaxParticipants (calculated)': dbMaxParticipants,
      'modeMaxParticipants (final)': modeMaxParticipants,
      'maxNonAdminParticipants (limit)': maxNonAdminParticipants,
      'nonAdminParticipants.length (current)': nonAdminParticipants.length,
      'currentParticipants (all)': currentParticipants.length,
      'comparison': `${nonAdminParticipants.length} >= ${maxNonAdminParticipants}`,
      'will_reject': nonAdminParticipants.length >= maxNonAdminParticipants,
      'participants_list': currentParticipants.map(p => ({
        userId: p.userId,
        username: p.username,
        isAdmin: p.isAdmin,
        hasRealProfile: p.username && p.username !== `temp_${p.userId.slice(-8)}`
      }))
    })

    // 🔍 DEBUGGING: Sprawdź co jest w bazie danych dla tej sesji
    console.log('🔍 DATABASE PROFILES DEBUG:', {
      totalProfiles: currentParticipants.length,
      adminProfiles: currentParticipants.filter(p => p.isAdmin).length,
      participantProfiles: currentParticipants.filter(p => !p.isAdmin).length,
      allProfilesData: currentParticipants.map(p => ({
        userId: p.userId,
        username: p.username,
        platform: p.platform,
        isAdmin: p.isAdmin,
        createdAt: p.createdAt
      }))
    })

    if (nonAdminParticipants.length >= maxNonAdminParticipants) {
      console.log(`❌ Session ${sessionId} is full: ${nonAdminParticipants.length}/${maxNonAdminParticipants}`)
      console.log(`❌ DETAILED REJECTION REASON:`, {
        currentParticipants: nonAdminParticipants.length,
        maxAllowed: maxNonAdminParticipants,
        viewingMode: session.viewingMode,
        maxParticipantsFromDB: session.maxParticipants,
        calculatedMax: modeMaxParticipants
      })
      return NextResponse.json({
        error: 'Session is full'
      }, { status: 400 })
    }

    // 🆕 FIXED: Create participant entry in database with hasJoined=false
    const joinSuccess = await sessionDb.saveUserProfile(
      sessionId,
      userId,
      {
        platform: 'instagram', // Placeholder - will be updated when user adds real profile
        username: `temp_${userId.slice(-8)}`, // Temporary username
        pic_url: undefined, // FIXED: Changed from null to undefined
        posts: undefined   // FIXED: Changed from null to undefined
      },
      false // isAdmin = false
      // hasJoined will be false by default from schema
    )

    if (!joinSuccess) {
      console.log(`❌ Failed to create participant entry: ${sessionId}`)
      return NextResponse.json({
        error: 'Failed to join session. Database error.'
      }, { status: 500 })
    }

    // 🆕 SSE BROADCAST: Notify all connected clients about new participant
    console.log(`📢 SSE: Broadcasting participant joined - ${userId} to session ${sessionId}`)
    try {
      broadcastParticipantJoined(sessionId, userId)
    } catch (sseError) {
      console.log(`⚠️ SSE: Failed to broadcast participant joined:`, sseError)
      // Don't fail the request if SSE fails - it's not critical
    }

    // 🆕 Update session status if this is first participant join
    let statusChanged = false
    if (session.status === 'setup') {
      await sessionDb.updateCurrentStep(sessionId, 'collecting_profiles')
      statusChanged = true
    }

    // Get updated session with new participant
    const updatedSession = await sessionDb.getSession(sessionId)

    if (!updatedSession) {
      return NextResponse.json({
        error: 'Session not found after join'
      }, { status: 404 })
    }

    // 🆕 SSE BROADCAST: Send full session update to all clients
    console.log(`📢 SSE: Broadcasting session update after participant join`)
    try {
      await broadcastSessionUpdate(sessionId, 'participant_joined')
    } catch (sseError) {
      console.log(`⚠️ SSE: Failed to broadcast session update:`, sseError)
      // Don't fail the request if SSE fails - it's not critical
    }

    console.log(`✅ User ${userId} successfully joined session ${sessionId}`)

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
): Promise<NextResponse<JoinPreviewResponse | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()

    console.log(`👀 GET Join Preview: ${sessionId}`)

    // 🆕 Get session from PostgreSQL
    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // 🆕 Get session profiles to count participants and find admin
    const profiles = await sessionDb.getSessionProfiles(sessionId)
    const adminProfile = profiles.find(p => p.isAdmin)
    const participantProfiles = profiles.filter(p => !p.isAdmin)

    // 🆕 Use maxParticipants from database
    const dbMaxParticipants = session.maxParticipants || 8
    const modeMaxParticipants = session.viewingMode === 'couple' ? 2 : dbMaxParticipants

    // ✅ KLUCZOWA POPRAWKA: Sprawdzenie warunków canJoin z debugowaniem
    const allowedStatuses = ['setup', 'recruiting', 'collecting_profiles', 'ready_for_quiz']
    const statusCheck = allowedStatuses.includes(session.status)
    const modeCheck = session.viewingMode !== 'solo'
    const capacityCheck = participantProfiles.length < (modeMaxParticipants - 1)

    const canJoin = statusCheck && modeCheck && capacityCheck

    // 🔍 DEBUGGING: Szczegółowe logowanie warunków canJoin dla GET (preview)
    console.log(`🔍 GET JOIN PREVIEW DEBUG for ${sessionId}:`, {
      status: session.status,
      allowedStatuses,
      statusCheck,
      viewingMode: session.viewingMode,
      'typeof viewingMode': typeof session.viewingMode,
      modeCheck,
      participantCount: participantProfiles.length,
      maxParticipants: modeMaxParticipants - 1,
      capacityCheck,
      canJoin,
      'session.maxParticipants': session.maxParticipants,
      'dbMaxParticipants': dbMaxParticipants,
      'modeMaxParticipants': modeMaxParticipants,
      finalDecision: canJoin ? '✅ CAN JOIN' : '❌ CANNOT JOIN'
    })

    // Return enhanced session info for preview
    const sessionPreview: JoinPreviewResponse = {
      sessionId: session.sessionId,
      viewingMode: session.viewingMode,
      selectedPlatforms: session.selectedPlatforms,

      // 🆕 Enhanced admin profile from database
      adminProfile: adminProfile ? {
        displayName: adminProfile.username, // Will be enhanced later with real names
        profilePicUrl: adminProfile.pic_url,
        platform: adminProfile.platform,
        username: adminProfile.username
      } : null,

      // 🆕 Accurate participant count from database
      participantCount: participantProfiles.length,
      maxParticipants: modeMaxParticipants,
      status: session.status,

      // ✅ POPRAWIONE: Warunki canJoin z debugowaniem
      canJoin: canJoin,

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