// src/app/api/session/[id]/tinder-results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const { searchParams } = new URL(request.url)
    const batchNumber = searchParams.get('batch')

    console.log(`📊 [API/tinder-results] Getting results for session: ${sessionId}, batch: ${batchNumber}`)

    if (!batchNumber) {
      return NextResponse.json({ success: false, error: 'Batch number is required' }, { status: 400 })
    }

    const profiles = await sessionDb.getSessionProfiles(sessionId);
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: false, error: 'No profiles found for this session' }, { status: 404 });
    }

    // Filtrujemy tylko aktywnych uczestników (tych, którzy mają pole 'picks')
    const participantsWithPicks = profiles.filter(p => p.picks && typeof p.picks === 'object');
    if(participantsWithPicks.length === 0) {
       return NextResponse.json({ success: true, matchedMovies: [] });
    }

    const batchKey = `batch_${batchNumber}`;
    let matchedMovieIds: string[] | null = null;

    // Znajdź filmy, na które wszyscy zagłosowali "tak"
    for (const profile of participantsWithPicks) {
      const picksForBatch = (profile.picks as any)[batchKey];

      if (!Array.isArray(picksForBatch)) {
        // Jeśli któryś z uczestników nie ma głosów na tę partię, nie ma dopasowania
        matchedMovieIds = [];
        break;
      }

      if (matchedMovieIds === null) {
        // Inicjalizuj listę filmami pierwszego użytkownika
        matchedMovieIds = picksForBatch;
      } else {
        // Znajdź część wspólną (przecięcie) z kolejnymi użytkownikami
        matchedMovieIds = matchedMovieIds.filter(id => picksForBatch.includes(id));
      }
    }

    if (!matchedMovieIds || matchedMovieIds.length === 0) {
      console.log(`❎ [API/tinder-results] No consensus found for batch ${batchNumber}`);
      return NextResponse.json({ success: true, matchedMovies: [] });
    }

    // Jeśli znaleziono dopasowania, pobierz pełne dane tych filmów
    const matchedMoviesData = await prisma.sessionMovieResult.findMany({
      where: {
        sessionId: sessionId.toUpperCase(),
        movieId: { in: matchedMovieIds }
      }
    });

    console.log(`✅ [API/tinder-results] Found ${matchedMoviesData.length} matched movies for batch ${batchNumber}`);

    return NextResponse.json({ success: true, matchedMovies: matchedMoviesData });

  } catch (error) {
    console.error('❌ [API/tinder-results] Error getting tinder results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get tinder results' },
      { status: 500 }
    )
  }
}