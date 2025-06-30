import { NextRequest, NextResponse } from 'next/server';
import { sessionDb } from '@/lib/sessionDb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { userId } = body;

    console.log(`🏁 [API/broadcast-finish] Admin ${userId} finishing session ${sessionId}`);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Sprawdź czy użytkownik to admin
    const session = await sessionDb.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.adminId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only admin can finish session' },
        { status: 403 }
      );
    }

    // Wyślij broadcast (bez modyfikacji bazy - to tylko sygnał logout)
    const success = await sessionDb.broadcastSessionFinish(sessionId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to broadcast session finish' },
        { status: 500 }
      );
    }

    console.log(`✅ [API/broadcast-finish] Session finish broadcasted for ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Session finish broadcasted successfully'
    });

  } catch (error) {
    console.error('❌ [API/broadcast-finish] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to broadcast session finish' },
      { status: 500 }
    );
  }
}