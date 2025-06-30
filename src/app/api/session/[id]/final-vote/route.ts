// src/app/api/session/[id]/final-vote/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sessionDb } from '@/lib/sessionDb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ✅ POPRAWKA: Promise<>
) {
  try {
    const { id: sessionId } = await params;  // ✅ POPRAWKA: await params
    const body = await request.json();
    const { userId, movieId, timeTaken } = body;

    if (!userId || !movieId || typeof timeTaken !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, movieId, timeTaken' },
        { status: 400 }
      );
    }

    const upperSessionId = sessionId.toUpperCase();

    const profile = await prisma.sessionProfile.findUnique({
      where: { sessionId_userId: { sessionId: upperSessionId, userId } },
    });

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const existingPicks = (profile.picks as any) || {};

    // ✅ POPRAWKA: Używamy klucza 'batch_final' zgodnie z umową.
    const updatedPicks = {
      ...existingPicks,
      batch_final: { movieId, timeTaken },
    };

    await prisma.sessionProfile.update({
      where: { id: profile.id },
      data: { picks: updatedPicks },
    });

    console.log(`🗳️ [API/final-vote] Saved final vote for user ${userId} in session ${upperSessionId}`);

    sessionDb.checkAndDetermineFinalWinner(upperSessionId).catch(err => {
        console.error(`❌ Background check for final winner failed for session ${upperSessionId}:`, err);
    });

    return NextResponse.json({ success: true, message: 'Vote saved successfully.' });

  } catch (error) {
    console.error('❌ [API/final-vote] Error processing final vote:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process final vote' },
      { status: 500 }
    );
  }
}