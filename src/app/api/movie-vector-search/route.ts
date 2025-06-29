// src/app/api/movie-vector-search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface MovieVectorSearchRequest {
  sessionId: string
}

interface MovieConcept {
  description: string
  genre: string
}

interface MovieSearchRequest {
  query: string
  top_k?: number
  available_platforms?: string[]
  excluded_genres?: string[]
  min_imdb_rating?: number
}

interface MovieResult {
  id: string
  score: number
  hybrid_score?: number
  search_type: string
  title: string
  description: string
  year: string | number
  genres: string
  directors: string
  imdb_rating: string | number
  platform: string | string[]
  runtime: string | number
  content_rating: string
  platform_count?: number
  dense_score?: number
  sparse_score?: number
  // 🆕 NOWE POLA
  imdb_id?: string | null
  type?: string | null
  img_url?: string | null
}

interface MovieSearchResponse {
  results: MovieResult[]
  query: string
  total_results: number
  search_time_ms: number
  metadata: {
    dense_results: number
    sparse_results: number
    combined_results: number
    final_results: number
    alpha_weighting: number
  }
}

interface MoviePreferences {
  excludedGenres: string[]
  minImdbRating: number
}

// Type guard functions for runtime validation
function isMovieConcept(obj: unknown): obj is MovieConcept {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).description === 'string' &&
    typeof (obj as any).genre === 'string'
  )
}

function isMovieConceptArray(obj: unknown): obj is MovieConcept[] {
  return Array.isArray(obj) && obj.every(isMovieConcept)
}

function isMoviePreferences(obj: unknown): obj is MoviePreferences {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray((obj as any).excludedGenres) &&
    (obj as any).excludedGenres.every((genre: unknown) => typeof genre === 'string') &&
    typeof (obj as any).minImdbRating === 'number'
  )
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Movie Vector Search: Starting request processing')

    const body: MovieVectorSearchRequest = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: sessionId'
      }, { status: 400 })
    }

    console.log(`🎬 Processing movie vector search for session: ${sessionId}`)

    // Fetch session with required data
    const session = await prisma.session.findUnique({
      where: { sessionId: sessionId.toUpperCase() },
      select: {
        sessionId: true,
        llm_movies: true,
        movie_preferences: true,
        status: true
      }
    })

    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    console.log(`✅ Session found: ${sessionId}`)

    // Check if both llm_movies and movie_preferences exist
    if (!session.llm_movies || !session.movie_preferences) {
      console.log(`⚠️ Prerequisites not met for session ${sessionId}:`, {
        llm_movies: !!session.llm_movies,
        movie_preferences: !!session.movie_preferences
      })
      return NextResponse.json({
        success: false,
        error: 'Both llm_movies and movie_preferences are required',
        missing: {
          llm_movies: !session.llm_movies,
          movie_preferences: !session.movie_preferences
        }
      }, { status: 400 })
    }

    // Check if results already exist
    const existingResults = await prisma.sessionMovieResult.findMany({
      where: { sessionId: sessionId.toUpperCase() },
      select: { id: true, queryNumber: true }
    })

    if (existingResults.length > 0) {
      console.log(`ℹ️ Movie results already exist for session ${sessionId}: ${existingResults.length} results`)
      return NextResponse.json({
        success: true,
        message: 'Movie results already exist',
        existingResultsCount: existingResults.length,
        fromCache: true
      })
    }

    // Parse and validate data with proper type checking
    const llmMoviesData = session.llm_movies as unknown
    const moviePreferencesData = session.movie_preferences as unknown

    if (!isMovieConceptArray(llmMoviesData)) {
      console.error('❌ Invalid llm_movies data format:', llmMoviesData)
      return NextResponse.json({
        success: false,
        error: 'Invalid llm_movies data format'
      }, { status: 400 })
    }

    if (!isMoviePreferences(moviePreferencesData)) {
      console.error('❌ Invalid movie_preferences data format:', moviePreferencesData)
      return NextResponse.json({
        success: false,
        error: 'Invalid movie_preferences data format'
      }, { status: 400 })
    }

    const concepts = llmMoviesData
    const preferences = moviePreferencesData

    console.log(`🎯 Found ${concepts.length} movie concepts`)
    console.log(`🎛️ Preferences:`, {
      excludedGenres: preferences.excludedGenres,
      minImdbRating: preferences.minImdbRating
    })

    // Prepare search requests
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'

    const searchPromises = concepts.map(async (concept, index) => {
      const searchRequest: MovieSearchRequest = {
        query: concept.description,
        top_k: 10,
        excluded_genres: preferences.excludedGenres,
        min_imdb_rating: preferences.minImdbRating
      }

      console.log(`🔍 Query ${index + 1}: "${concept.description.substring(0, 50)}..." (Genre: ${concept.genre})`)

      const response = await fetch(`${baseUrl}/api/movie-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchRequest)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Movie search failed for query ${index + 1}: ${response.status} - ${errorText}`)
      }

      const searchResult: MovieSearchResponse = await response.json()

      console.log(`✅ Query ${index + 1} completed: ${searchResult.results.length} movies found (${searchResult.search_time_ms}ms)`)

      return {
        queryNumber: index + 1,
        concept,
        searchResult
      }
    })

    // Execute all searches in parallel
    console.log(`🚀 Executing ${concepts.length} parallel searches...`)
    const searchResults = await Promise.all(searchPromises)

    // Prepare data for database insertion
    const movieRecords = searchResults.flatMap(({ queryNumber, concept, searchResult }) =>
      searchResult.results.map(movie => ({
        sessionId: sessionId.toUpperCase(),
        queryNumber,
        conceptGenre: concept.genre,
        conceptDescription: concept.description,

        // Movie data
        movieId: movie.id,
        movieTitle: movie.title,
        movieDescription: movie.description,
        movieYear: String(movie.year),
        movieGenres: movie.genres,
        movieDirectors: movie.directors,
        movieImdbRating: String(movie.imdb_rating),
        moviePlatform: Array.isArray(movie.platform) ? movie.platform : [movie.platform],
        movieRuntime: String(movie.runtime),
        movieContentRating: movie.content_rating,

        // 🆕 DODANE BRAKUJĄCE POLA:
        movieImdbId: movie.imdb_id != null ? String(movie.imdb_id) : null,
        movieType: movie.type != null ? String(movie.type) : null,
        movieImgUrl: movie.img_url != null ? String(movie.img_url) : null,

        // Search metadata
        searchScore: movie.score,
        searchType: movie.search_type,
        hybridScore: movie.hybrid_score || null,
        denseScore: movie.dense_score || null,
        sparseScore: movie.sparse_score || null,
        platformCount: movie.platform_count || null
      }))
    )

    console.log(`💾 Saving ${movieRecords.length} movie records to database...`)

    // Save all records to database
    await prisma.sessionMovieResult.createMany({
      data: movieRecords
    })

    console.log(`✅ Successfully saved ${movieRecords.length} movie results for session ${sessionId}`)

    // Summary stats
    const summaryByQuery = searchResults.map(result => ({
      queryNumber: result.queryNumber,
      genre: result.concept.genre,
      moviesFound: result.searchResult.results.length,
      searchTime: result.searchResult.search_time_ms
    }))

    const totalSearchTime = searchResults.reduce((sum, r) => sum + r.searchResult.search_time_ms, 0)

    console.log(`\n🎯 VECTOR SEARCH COMPLETED SUCCESSFULLY:`)
    console.log(`====================================`)
    console.log(`- Session: ${sessionId}`)
    console.log(`- Total movies found: ${movieRecords.length}`)
    console.log(`- Queries executed: ${concepts.length}`)
    console.log(`- Total search time: ${totalSearchTime}ms`)
    summaryByQuery.forEach(s => {
      console.log(`  Query ${s.queryNumber} (${s.genre}): ${s.moviesFound} movies (${s.searchTime}ms)`)
    })

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      totalMoviesFound: movieRecords.length,
      queriesExecuted: concepts.length,
      totalSearchTimeMs: totalSearchTime,
      summaryByQuery,
      concepts: concepts.map(c => ({ genre: c.genre, description: c.description.substring(0, 100) + '...' }))
    })

  } catch (error) {
    console.error('❌ Movie Vector Search error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to execute movie vector search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for testing and retrieving existing results
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (sessionId) {
    try {
      const movieResults = await prisma.sessionMovieResult.findMany({
        where: { sessionId: sessionId.toUpperCase() },
        orderBy: [
          { queryNumber: 'asc' },
          { searchScore: 'desc' }
        ]
      })

      const summary = movieResults.reduce((acc, result) => {
        if (!acc[result.queryNumber]) {
          acc[result.queryNumber] = {
            queryNumber: result.queryNumber,
            genre: result.conceptGenre,
            movieCount: 0,
            topMovie: null
          }
        }
        acc[result.queryNumber].movieCount++
        if (!acc[result.queryNumber].topMovie) {
          acc[result.queryNumber].topMovie = {
            title: result.movieTitle,
            year: result.movieYear,
            score: result.searchScore
          }
        }
        return acc
      }, {} as Record<number, any>)

      return NextResponse.json({
        sessionId: sessionId.toUpperCase(),
        totalResults: movieResults.length,
        summary: Object.values(summary),
        results: movieResults
      })
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to retrieve movie results'
      }, { status: 500 })
    }
  }

  return NextResponse.json({
    service: 'movie-vector-search',
    usage: 'POST with { "sessionId": "string" }',
    description: 'Executes vector search for movie concepts and saves results to database.',
    requirements: ['llm_movies', 'movie_preferences'],
    test: 'GET with ?sessionId=ABC123 to check existing results'
  })
}