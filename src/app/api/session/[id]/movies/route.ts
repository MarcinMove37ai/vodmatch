// src/app/api/session/[id]/movies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  // ✅ POPRAWKA 1: Typ 'params' jest teraz zgodny z innymi plikami w Twoim projekcie (Promise).
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ POPRAWKA 2: Używamy 'await', aby uzyskać dostęp do parametrów, zgodnie z komunikatem błędu.
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const movieResults = await prisma.sessionMovieResult.findMany({
      where: { sessionId: sessionId.toUpperCase() },
      select: {
        movieTitle: true,
        movieDescription: true,
        movieYear: true,
        movieGenres: true,
        movieImdbRating: true,
        movieImgUrl: true,
      },
      orderBy: [
        { queryNumber: 'asc' },
        { searchScore: 'desc' },
      ],
    });

    if (!movieResults || movieResults.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(movieResults);

  } catch (error) {
    console.error('❌ Failed to fetch movie results:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}