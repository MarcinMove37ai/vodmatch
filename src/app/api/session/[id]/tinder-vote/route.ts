// src/app/api/session/[id]/tinder-vote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

interface MoviePick {
    movieId: string;
    vote: 'watched' | 'not_watched';
}

interface TinderVoteRequest {
  userId: string
  batchNumber: number
  picks: MoviePick[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: sessionId } = await params
    const body: TinderVoteRequest = await request.json()
    const { userId, batchNumber, picks } = body

    console.log(`🗳️ [API/tinder-vote] Received votes from ${userId} for batch ${batchNumber} (${picks.length} picks)`);

    if (!userId || !batchNumber || !Array.isArray(picks)) {
      console.error(`❌ [API/tinder-vote] Missing required fields`);
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId, batchNumber, picks array' },
        { status: 400 }
      )
    }

    // Loguj szczegóły głosów
    const positiveVotes = picks.filter(p => p.vote === 'not_watched').length;
    const negativeVotes = picks.filter(p => p.vote === 'watched').length;
    console.log(`🗳️ [API/tinder-vote] Vote breakdown: ${positiveVotes} positive (want to watch), ${negativeVotes} negative (already watched)`);

    const { success, allFinished } = await sessionDb.saveMoviePicks(sessionId, userId, batchNumber, picks)

    if (!success) {
      console.error(`❌ [API/tinder-vote] Failed to save picks`);
      return NextResponse.json(
        { success: false, error: 'Failed to save movie picks.' },
        { status: 500 }
      )
    }

    console.log(`✅ [API/tinder-vote] Successfully saved picks for ${userId}`);

    if (allFinished) {
        console.log(`🏆 [API/tinder-vote] All participants finished batch ${batchNumber}! Broadcast will be handled by sessionDb.saveMoviePicks`);
    } else {
        console.log(`⏳ [API/tinder-vote] Waiting for more participants to finish batch ${batchNumber}`);
    }

    return NextResponse.json({ success: true, allFinished })

  } catch (error) {
    console.error('❌ [API/tinder-vote] Error submitting movie picks:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit movie picks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}