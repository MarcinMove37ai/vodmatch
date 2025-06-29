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

// Helper function to clean engagingFeedback text
function cleanEngagingFeedback(feedback: string): string {
  return feedback
    // Remove emojis and special characters
    .replace(/[🎭🎬✨📊🎯🔮🌟💫🎪🎨🎵🎭🎪🎨🎭🎬✨📊🎮🎸🎺🎼🎹🎻🥁🎧🎤🎵🎶🎙️🎚️🎛️🔊🔉🔈📢📣📯🔔🔕🎼🎵🎶🎧🎤🎸🥁🎺🎻🎹🎷🪘🪗🪕🪖]/g, '')
    // Remove multiple newlines
    .replace(/\n\n+/g, ' ')
    // Replace single newlines with spaces
    .replace(/\n/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim()
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

    // 🆕 NEW: Fetch profiles based on social analysis completion
    const profiles = await prisma.sessionProfile.findMany({
      where: {
        sessionId: sessionId.toUpperCase(),
        social_analysis_status: { in: ['completed', 'failed'] }
      },
      select: {
        userId: true,
        username: true,
        llm_characterization: true,
        individual_analysis: true,
        social_analysis_status: true,
        isAdmin: true
      }
    })

    if (profiles.length === 0) {
      console.log(`⚠️ No participants with completed social analysis found for session: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'No participants with completed analysis available'
      }, { status: 400 })
    }

    console.log(`👥 Found ${profiles.length} participants with completed social analysis`)

    // 🆕 NEW: Enhanced participant description logic with fallback
    const participantDescriptions: string[] = []
    let llmCharacterizationCount = 0
    let engagingFeedbackCount = 0

    console.log(`\n🔍 DETAILED DATA ANALYSIS FOR EACH PARTICIPANT:`)
    console.log(`================================================`)

    profiles.forEach((profile, index) => {
      let description = ''
      const participantNumber = index + 1

      // Log available data for this participant
      console.log(`\n👤 PARTICIPANT ${participantNumber} (@${profile.username}):`)
      console.log(`  - Social Analysis Status: ${profile.social_analysis_status}`)
      console.log(`  - LLM Characterization: ${profile.llm_characterization ? (profile.llm_characterization === 'insufficient data' ? 'INSUFFICIENT DATA' : `YES (${profile.llm_characterization.length} chars)`) : 'NO'}`)
      console.log(`  - Individual Analysis: ${profile.individual_analysis ? 'YES' : 'NO'}`)

      const hasEngagingFeedback = profile.individual_analysis &&
                                  typeof profile.individual_analysis === 'object' &&
                                  (profile.individual_analysis as any).engagingFeedback
      console.log(`  - Engaging Feedback: ${hasEngagingFeedback ? `YES (${(profile.individual_analysis as any).engagingFeedback.length} chars)` : 'NO'}`)

      // First priority: llm_characterization (if available and valid)
      if (profile.llm_characterization &&
          profile.llm_characterization !== 'insufficient data' &&
          profile.llm_characterization.trim() !== '') {
        description = profile.llm_characterization
        llmCharacterizationCount++
        console.log(`  ✅ SELECTED: LLM Characterization`)
      }
      // Second priority: engagingFeedback from individual_analysis
      else if (hasEngagingFeedback) {
        const rawFeedback = (profile.individual_analysis as any).engagingFeedback
        description = cleanEngagingFeedback(rawFeedback)
        engagingFeedbackCount++
        console.log(`  ✅ SELECTED: Cleaned Engaging Feedback`)
        console.log(`    - Raw feedback length: ${rawFeedback.length} chars`)
        console.log(`    - Cleaned length: ${description.length} chars`)
      }
      // Fallback: basic info
      else {
        description = `Quiz participant: @${profile.username}`
        console.log(`  ⚠️ SELECTED: Basic fallback (no rich data available)`)
      }

      // Log the final description being used
      console.log(`  📤 FINAL DESCRIPTION (${description.length} chars):`)
      if (description.length > 200) {
        console.log(`    "${description.substring(0, 150)}..." [TRUNCATED]`)
      } else {
        console.log(`    "${description}"`)
      }

      participantDescriptions.push(`Participant ${participantNumber}: ${description}`)
    })

    console.log(`\n📊 DATA SOURCE SUMMARY:`)
    console.log(`========================`)
    console.log(`- LLM Characterizations: ${llmCharacterizationCount}`)
    console.log(`- Engaging Feedback: ${engagingFeedbackCount}`)
    console.log(`- Basic Fallback: ${participantDescriptions.length - llmCharacterizationCount - engagingFeedbackCount}`)
    console.log(`- Total Participants: ${participantDescriptions.length}`)

    // Check if we have any meaningful descriptions
    if (participantDescriptions.length === 0) {
      console.log(`❌ No participant descriptions could be generated for session: ${sessionId}`)
      return NextResponse.json({
        success: false,
        error: 'No participant descriptions available'
      }, { status: 400 })
    }

    console.log(`✅ Generated descriptions: ${llmCharacterizationCount} from LLM characterization, ${engagingFeedbackCount} from engaging feedback`)

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
    const participantDescriptionsText = participantDescriptions.join('\n\n')

    const prompt = `You are a creative film concept generator. Your task is to analyze the provided group characteristics and participant descriptions, then create exactly 3 original film descriptions that would perfectly match this group's preferences and dynamics.

--- GROUP CHARACTERISTICS ---
${semanticDescription}

--- PARTICIPANT DESCRIPTIONS ---
${participantDescriptionsText}

${llmCharacterizationCount === 0 ?
  '--- NOTE ---\nParticipant descriptions are based on psychological insights from quiz responses rather than detailed social profiles.\n' :
  ''
}

--- INSTRUCTIONS ---
1. Based on the group dynamics and ${llmCharacterizationCount > 0 ? 'individual characteristics' : 'psychological insights'}, CREATE 3 original film concepts that would perfectly appeal to this specific group.
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

    console.log(`🧠 Sending request to Claude for film concept generation`)

    // Log the complete prompt being sent to Claude
    console.log(`\n📋 COMPLETE PROMPT BEING SENT TO CLAUDE:`)
    console.log(`=========================================`)
    console.log(`Prompt length: ${prompt.length} characters`)
    console.log(`\n--- SEMANTIC DESCRIPTION SECTION ---`)
    console.log(`${semanticDescription.substring(0, 300)}${semanticDescription.length > 300 ? '...' : ''}`)
    console.log(`\n--- PARTICIPANT DESCRIPTIONS SECTION ---`)
    console.log(`${participantDescriptionsText.substring(0, 500)}${participantDescriptionsText.length > 500 ? '...' : ''}`)
    console.log(`\n--- DATA SOURCE NOTE ---`)
    console.log(`${llmCharacterizationCount === 0 ? 'Using psychological insights from quiz responses' : 'Using detailed characterizations'}`)
    console.log(`\n🚀 Calling Claude API with complete prompt...`)

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

    console.log(`\n📥 CLAUDE API RESPONSE:`)
    console.log(`======================`)
    console.log(`Response length: ${rawRecommendations.length} characters`)
    console.log(`Raw response preview:`)
    console.log(`${rawRecommendations.substring(0, 300)}${rawRecommendations.length > 300 ? '...' : ''}`)
    console.log(`\n🔍 Parsing JSON response...`)

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
    console.log(`\n🎭 GENERATED FILM CONCEPTS:`)
    console.log(`===========================`)
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. GENRE: ${rec.genre}`)
      console.log(`   LENGTH: ${rec.description.length} characters`)
      console.log(`   DESCRIPTION: ${rec.description}`)
    })
    console.log(`\n💾 Saving concepts to database...`)

    // Save recommendations to the database - convert to Prisma JSON format
    await prisma.session.update({
      where: { sessionId: sessionId.toUpperCase() },
      data: {
        llm_movies: recommendations as unknown as Prisma.InputJsonValue
      }
    })

    console.log(`✅ Film concepts saved to database for session: ${sessionId}`)

    console.log(`\n🎯 PROCESS COMPLETED SUCCESSFULLY:`)
    console.log(`==================================`)
    console.log(`- Session: ${sessionId}`)
    console.log(`- Participants analyzed: ${participantDescriptions.length}`)
    console.log(`- Data sources: ${llmCharacterizationCount} LLM + ${engagingFeedbackCount} Feedback + ${participantDescriptions.length - llmCharacterizationCount - engagingFeedbackCount} Fallback`)
    console.log(`- Concepts generated: ${recommendations.length}`)
    console.log(`- Total prompt length: ${prompt.length} chars`)
    console.log(`- Claude response length: ${rawRecommendations.length} chars`)
    console.log(`🚀 Ready to return response to client`)

    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      concepts: recommendations,
      participantsAnalyzed: participantDescriptions.length,
      dataSourceBreakdown: {
        llmCharacterizations: llmCharacterizationCount,
        engagingFeedback: engagingFeedbackCount,
        fallback: participantDescriptions.length - llmCharacterizationCount - engagingFeedbackCount
      },
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