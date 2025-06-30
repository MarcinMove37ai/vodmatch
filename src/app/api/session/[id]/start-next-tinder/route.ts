// src/app/api/session/[id]/start-next-tinder/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

interface StartNextTinderRequest {
  userId: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: sessionId } = await params
    const body: StartNextTinderRequest = await request.json()
    const { userId } = body

    console.log(`🎬 [API/start-next-tinder] Admin ${userId} requesting next tinder round for session ${sessionId}`);

    if (!userId) {
      console.error(`❌ [API/start-next-tinder] Missing userId`);
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      )
    }

    // Sprawdź czy użytkownik to admin tej sesji
    const session = await sessionDb.getSession(sessionId);
    if (!session) {
      console.error(`❌ [API/start-next-tinder] Session not found: ${sessionId}`);
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.adminId !== userId) {
      console.error(`❌ [API/start-next-tinder] User ${userId} is not admin of session ${sessionId}`);
      return NextResponse.json(
        { success: false, error: 'Only admin can start next tinder round' },
        { status: 403 }
      )
    }

    // Uruchom kolejną rundę
    const success = await sessionDb.startNextTinderRound(sessionId);

    if (!success) {
      console.error(`❌ [API/start-next-tinder] Failed to start next tinder round for session ${sessionId}`);
      return NextResponse.json(
        { success: false, error: 'Failed to start next tinder round' },
        { status: 500 }
      )
    }

    console.log(`✅ [API/start-next-tinder] Successfully started next tinder round for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Next tinder round started successfully'
    })

  } catch (error) {
    console.error('❌ [API/start-next-tinder] Error starting next tinder round:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start next tinder round',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}