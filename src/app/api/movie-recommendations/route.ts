// src/app/api/movie-recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface MovieRecommendationRequest {
  sessionId: string
}

interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
}

interface MovieRecommendation {
  description: string
  genre: string
}

// Helper function to safely cast and validate movie recommendations from Prisma JSON
function validateMovieRecommendations(data: unknown): MovieRecommendation[] | null {
  if (!data || !Array.isArray(data)) {
    return null
  }

  try {
    return data.map((item: any) => {
      if (!item || typeof item !== 'object' || !item.description || !item.genre) {
        throw new Error('Invalid movie recommendation format')
      }
      return {
        description: String(item.description),
        genre: String(item.genre)
      }
    })
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Film Concept Generator: Starting request processing')

    // Get data from the body
    const body: MovieRecommendationRequest = await request.json()
    const { sessionId } = body

    // Validate input data
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: sessionId'
      }, { status: 400 })
    }

    console.log(`🎬 Processing film concept generation for sessionId: ${sessionId}`)

    // Fetch session with group analysis
    const session = await prisma.session.findUnique({
      where: { sessionId: sessionId.toUpperCase() },
      select: {
        sessionId: true,
        group_analysis: true,
        llm_movies: true,
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

    // Check if group_analysis exists
    if (!session.group_analysis) {
      console.log(`⚠️ Group analysis not available for session: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'Group analysis not available yet'
      }, { status: 400 })
    }

    // Check if recommendations already exist
    if (session.llm_movies) {
      console.log(`ℹ️ Film concepts already exist for session: ${sessionId}`)
      const existingConcepts = validateMovieRecommendations(session.llm_movies)
      if (existingConcepts) {
        return NextResponse.json({
          success: true,
          message: 'Film concepts already exist',
          concepts: existingConcepts,
          fromCache: true
        })
      } else {
        console.log(`⚠️ Invalid existing concepts format, regenerating for session: ${sessionId}`)
      }
    }

    // Extract semanticDescription from group_analysis
    let semanticDescription: string
    try {
      const groupAnalysis = session.group_analysis as any
      semanticDescription = groupAnalysis?.semanticDescription || ''

      if (!semanticDescription) {
        throw new Error('semanticDescription not found in group_analysis')
      }
    } catch (parseError) {
      console.error(`❌ Error parsing group_analysis for session ${sessionId}:`, parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid group_analysis format'
      }, { status: 400 })
    }

    console.log(`📝 Extracted semanticDescription (${semanticDescription.length} chars)`)

    // Fetch all participant characterizations for this session
    const profiles = await prisma.sessionProfile.findMany({
      where: {
        sessionId: sessionId.toUpperCase(),
        llm_characterization: { not: null }
      },
      select: {
        userId: true,
        username: true,
        llm_characterization: true,
        isAdmin: true
      }
    })

    if (profiles.length === 0) {
      console.log(`⚠️ No participant characterizations found for session: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'No participant characterizations available'
      }, { status: 400 })
    }

    console.log(`👥 Found ${profiles.length} participant characterizations`)

    // Filter out "insufficient data" characterizations and prepare participant descriptions
    const validCharacterizations = profiles
      .filter(profile =>
        profile.llm_characterization &&
        profile.llm_characterization !== 'insufficient data'
      )
      .map(profile => profile.llm_characterization)

    if (validCharacterizations.length === 0) {
      console.log(`⚠️ No valid characterizations found for session: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'No valid participant characterizations available'
      }, { status: 400 })
    }

    console.log(`✅ Using ${validCharacterizations.length} valid characterizations`)

    // Check for the API key
    const claudeApiKey = process.env.CLAUDE_API_KEY
    if (!claudeApiKey) {
      console.error('❌ CLAUDE_API_KEY not found in environment variables')
      return NextResponse.json({
        success: false,
        error: 'LLM service not configured'
      }, { status: 500 })
    }

    // Prepare the prompt for Claude API
    const participantDescriptions = validCharacterizations
      .map((char, index) => `Participant ${index + 1}: ${char}`)
      .join('\n\n')

    console.log(`🧠 Sending request to Claude for film concept generation`)

    const prompt = `You are a creative film concept generator. Your task is to analyze the provided group characteristics and participant descriptions, then create exactly 3 original film descriptions that would perfectly match this group's preferences and dynamics.

--- GROUP CHARACTERISTICS ---
${semanticDescription}

--- PARTICIPANT DESCRIPTIONS ---
${participantDescriptions}

--- INSTRUCTIONS ---
1. Based on the group dynamics and individual characteristics, CREATE 3 original film concepts that would perfectly appeal to this specific group.
2. DO NOT recommend existing films - invent new ones.
3. Each description should be approximately 500 characters long.
4. Write clean plot descriptions without introductory phrases like "Perfect for this group" or "Ideal film".
5. Focus on plot, themes, characters, and story elements that would resonate with this group.
6. Create diverse genres that complement each other as a viewing session.
7. Ensure concepts are accessible and engaging.

--- REQUIRED OUTPUT FORMAT ---
You must respond with a valid JSON array containing exactly 3 objects. Each object must have these exact fields:
- "description": Clean plot description (~500 characters) (string)
- "genre": Primary genre (string)

Example format:
[
  {
    "description": "Two childhood friends discover an abandoned observatory where each telescope reveals different timelines of their lives. As they explore alternate versions of their choices, they must decide whether to change their past or embrace their current path. The story weaves through moments of wonder and regret, ultimately celebrating the beauty of imperfect decisions and authentic friendship.",
    "genre": "Drama"
  },
  {
    "description": "A small coastal town's residents wake up to find their memories from the past week have vanished. A local librarian and a marine biologist team up to uncover the truth, discovering that the ocean itself holds the missing memories. Their investigation leads them through underwater caves and forgotten folklore, revealing a connection between human consciousness and natural rhythms.",
    "genre": "Mystery"
  }
]

Respond only with the JSON array, no additional text.`

    // Prepare the request body for the Claude API
    const claudeRequestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }

    // Call the Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeRequestBody)
    })

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text()
      console.error(`❌ Claude API error (${claudeResponse.status}):`, errorData)
      throw new Error(`Claude API error: ${claudeResponse.status}`)
    }

    const claudeData: ClaudeResponse = await claudeResponse.json()
    console.log(`✅ Claude API response received`)

    // Extract and parse the recommendations from the response
    const rawRecommendations = claudeData.content?.[0]?.text?.trim() || '[]'

    let recommendations: MovieRecommendation[]
    try {
      recommendations = JSON.parse(rawRecommendations)

      // Validate the response format
      if (!Array.isArray(recommendations) || recommendations.length !== 3) {
        throw new Error('Invalid film concepts format: must be array of 3 items')
      }

      // Validate each recommendation object
      recommendations.forEach((rec, index) => {
        if (!rec.description || !rec.genre) {
          throw new Error(`Invalid film concept ${index + 1}: missing required fields`)
        }
      })

    } catch (parseError) {
      console.error(`❌ Error parsing Claude response:`, parseError)
      console.error(`❌ Raw response:`, rawRecommendations)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse film concepts',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 500 })
    }

    console.log(`🎬 Generated ${recommendations.length} original film concepts`)
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.genre}: ${rec.description.substring(0, 60)}...`)
    })

    // Save recommendations to the database - convert to Prisma JSON format
    await prisma.session.update({
      where: { sessionId: sessionId.toUpperCase() },
      data: {
        llm_movies: recommendations as unknown as Prisma.InputJsonValue
      }
    })

    console.log(`✅ Film concepts saved to database for session: ${sessionId}`)

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      concepts: recommendations,
      participantsAnalyzed: validCharacterizations.length,
      groupCharacteristics: semanticDescription.substring(0, 100) + '...'
    })

  } catch (error) {
    console.error('❌ Film Concept Generation error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to generate film concepts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for testing and retrieving existing recommendations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (sessionId) {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: {
          sessionId: true,
          llm_movies: true,
          status: true,
          group_analysis: true
        }
      })

      if (!session) {
        return NextResponse.json({
          error: 'Session not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        sessionId: session.sessionId,
        concepts: validateMovieRecommendations(session.llm_movies),
        hasGroupAnalysis: !!session.group_analysis,
        status: session.status
      })
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to retrieve film concepts'
      }, { status: 500 })
    }
  }

  return NextResponse.json({
    service: 'film-concept-generator',
    usage: 'POST with { "sessionId": "string" }',
    description: 'Generates original film concepts tailored to a group based on their characteristics.',
    test: 'GET with ?sessionId=ABC123 to check existing concepts'
  })
}