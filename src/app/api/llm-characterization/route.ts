// src/app/api/llm-characterization/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface CharacterizationRequest {
  userId: string
}

interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
}

// Function to clean post text
function cleanPostText(text: string): string {
  if (!text) return ''

  return text
    // Remove excess spaces and newlines
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\r\n\t]/g, ' ')
    // Remove multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Trim spaces from the beginning and end
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 LLM Characterization: Starting request processing')

    // Get data from the body
    const body: CharacterizationRequest = await request.json()
    const { userId } = body

    // Validate input data
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: userId'
      }, { status: 400 })
    }

    console.log(`🤖 Processing characterization for userId: ${userId}`)

    // Fetch profile from the database
    const profile = await prisma.sessionProfile.findFirst({
      where: { userId: userId },
      select: {
        id: true,
        userId: true,
        username: true,
        social_posts: true,
        llm_characterization: true
      }
    })

    if (!profile) {
      console.log(`❌ Profile not found for userId: ${userId}`)
      return NextResponse.json({
        success: false,
        error: 'Profile not found'
      }, { status: 404 })
    }

    console.log(`✅ Profile found: ${profile.username}`)

    // Check if social_posts is null (automatic fallback)
    if (profile.social_posts === null) {
      console.log(`⚠️ Social posts data is null for ${profile.username}, saving "insufficient data"`)

      await prisma.sessionProfile.update({
        where: { id: profile.id },
        data: { llm_characterization: 'insufficient data' }
      })

      return NextResponse.json({
        success: true,
        characterization: 'insufficient data',
        reason: 'null_data'
      })
    }

    // Extract posts from the JSON structure
    let posts: string[] = []
    try {
      const socialPostsData = profile.social_posts as any
      if (typeof socialPostsData === 'object' && socialPostsData.posts) {
        posts = socialPostsData.posts
      } else if (Array.isArray(socialPostsData)) {
        posts = socialPostsData
      } else {
        throw new Error('Invalid social posts data format')
      }
    } catch (parseError) {
      console.error(`❌ Error parsing social posts data for ${profile.username}:`, parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid social posts data format'
      }, { status: 400 })
    }

    console.log(`📝 Raw posts count: ${posts.length}`)

    // Clean the posts
    const cleanedPosts = posts
      .filter(post => post && typeof post === 'string')
      .map(post => cleanPostText(post))
      .filter(post => post.length > 10) // Only meaningful posts

    console.log(`🧹 Cleaned posts count: ${cleanedPosts.length}`)

    // Check for the API key
    const claudeApiKey = process.env.CLAUDE_API_KEY
    if (!claudeApiKey) {
      console.error('❌ CLAUDE_API_KEY not found in environment variables')
      return NextResponse.json({
        success: false,
        error: 'LLM service not configured'
      }, { status: 500 })
    }

    // Prepare posts for analysis (all cleaned posts)
    const postsForAnalysis = cleanedPosts.join('\n\n---\n\n')

    console.log(`🧠 Sending ${postsForAnalysis.length} characters to Claude model for analysis`)

    // New, highly structured and unambiguous prompt.
    const prompt = `You are a highly skilled analyst. Your sole task is to analyze the source material provided below and generate a single, final characterization text based on it. Do not ask questions. Do not engage in conversation. Produce only the required output according to the rules.

--- SOURCE MATERIAL (Total Posts: ${cleanedPosts.length}) ---
${postsForAnalysis}
--- END OF SOURCE MATERIAL ---

--- RULES OF ENGAGEMENT ---
1.  **THE ULTIMATE GOAL:** Your description must be genuinely positive, insightful, and designed to make the user smile. The required tone is friendly, sincere, and can be a little playful. It should feel like a warm, clever compliment.

2.  **UNBREAKABLE LENGTH RULE:** The final text MUST be between 300 and 400 characters, including spaces. Responses outside this range are a failure. You must check your character count.

3.  **OUTPUT FORMATTING:**
    * The response MUST start with the exact phrase "You are...".
    * The language MUST be English.
    * You MUST reply ONLY with the characterization text. No extra comments, greetings, or apologies.

4.  **ABSOLUTE PROHIBITIONS (FORBIDDEN):**
    * DO NOT use any names or usernames.
    * DO NOT invent facts not present in the posts.
    * DO NOT mention or allude to sensitive topics like politics, war, conflict, diseases, or health conditions. The output must be safe and positive.

5.  **DATA HANDLING:**
    * If the source material is empty or insufficient to create a logical characterization, your ONLY response must be the exact phrase: "insufficient data".`

    // Prepare the request body for the Claude API
    const claudeRequestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
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

    // Extract the characterization from the response (without trimming)
    const characterization = claudeData.content?.[0]?.text?.trim() || 'insufficient data'

    console.log(`📝 Final characterization (${characterization.length} chars): "${characterization}"`)

    // Save to the database
    await prisma.sessionProfile.update({
      where: { id: profile.id },
      data: { llm_characterization: characterization }
    })

    console.log(`✅ Characterization saved to database for profileId: ${profile.id}`)

    return NextResponse.json({
      success: true,
      userId: profile.userId,
      username: profile.username,
      characterization: characterization,
      length: characterization.length,
      postsAnalyzed: cleanedPosts.length,
      rawPostsCount: posts.length,
      claudeRequest: claudeRequestBody // Full request sent to Claude API
    })

  } catch (error) {
    console.error('❌ LLM Characterization error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to generate characterization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for testing purposes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get('profileId')

  if (profileId) {
    try {
      const profile = await prisma.sessionProfile.findUnique({
        where: { id: parseInt(profileId) },
        select: {
          llm_characterization: true,
          username: true,
          platform: true
        }
      })

      return NextResponse.json({
        profileId: parseInt(profileId),
        characterization: profile?.llm_characterization || null,
        username: profile?.username || null,
        platform: profile?.platform || null
      })
    } catch (error) {
      return NextResponse.json({
        error: 'Profile not found'
      }, { status: 404 })
    }
  }

  return NextResponse.json({
    service: 'llm-characterization',
    usage: 'POST with { "userId": "string" }',
    description: 'Generates user characterization using an LLM.',
    test: 'GET with ?profileId=123 to check existing characterization'
  })
}