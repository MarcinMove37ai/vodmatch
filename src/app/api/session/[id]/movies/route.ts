// src/app/api/session/[id]/movies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // ✅ POPRAWKA: Pobierz aktualny indeks sesji, aby określić właściwą partię
    const session = await prisma.session.findUnique({
      where: { sessionId: sessionId.toUpperCase() },
      select: { movieTinderIndex: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const currentIndex = session.movieTinderIndex || 0;

    // Jeśli podano parametr batch, używamy go; w przeciwnym razie używamy indeksu z sesji
    const requestedBatch = batchParam ? parseInt(batchParam, 10) : Math.floor(currentIndex / BATCH_SIZE) + 1;
    const startIndex = (requestedBatch - 1) * BATCH_SIZE;

    // ✅ KLUCZOWE: Deterministyczne sortowanie i pobieranie konkretnej partii
    const movieResults = await prisma.sessionMovieResult.findMany({
      where: { sessionId: sessionId.toUpperCase() },
      select: {
        movieId: true,
        movieTitle: true,
        movieDescription: true,
        movieYear: true,
        movieGenres: true,
        movieImdbRating: true,
        movieImgUrl: true,
      },
      // ✅ Deterministyczne sortowanie zapewniające spójność między użytkownikami
      orderBy: [
        { movieId: 'asc' }, // Pierwszorzędne sortowanie po ID (deterministyczne)
        { hybridScore: 'desc' },
        { searchScore: 'desc' },
      ],
      skip: startIndex,
      take: BATCH_SIZE,
    });

    console.log(`🎬 [API/movies] Returning batch ${requestedBatch} (${movieResults.length} movies, starting from index ${startIndex}) for session ${sessionId}`);

    return NextResponse.json(movieResults);

  } catch (error) {
    console.error('❌ Failed to fetch movie results:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}