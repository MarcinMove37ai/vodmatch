// src/app/api/session/[id]/quiz/route.ts - POPRAWIONA WERSJA
import { NextRequest, NextResponse } from 'next/server'
import { sessionDb } from '@/lib/sessionDb'

// 🆕 QUIZ TYPES: Updated interfaces to match new format
interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number // czas w sekundach
}

interface QuizResults {
  userId: string
  displayName: string
  answers: QuizAnswer[]
  completedAt: Date
  totalTime: number // całkowity czas quizu w sekundach
  questionsCount: number
}

interface SubmitQuizResultsRequest {
  userId: string
  quizResults: QuizResults // 🔧 UPDATED: Now expects quizResults object
}

interface ApiError {
  error: string
  details?: string
}

// POST - Submit quiz results to PostgreSQL database - ENHANCED VERSION
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: boolean; allCompleted?: boolean; sessionStatus?: string } | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()
    const body: SubmitQuizResultsRequest = await request.json()
    const { userId, quizResults } = body

    console.log(`📝 POST Quiz Results: ${sessionId}, user: ${userId}`)

    if (!userId || !quizResults) {
      return NextResponse.json({
        error: 'UserId and quizResults are required'
      }, { status: 400 })
    }

    // Validate quizResults structure
    if (!quizResults.answers || !Array.isArray(quizResults.answers)) {
      return NextResponse.json({
        error: 'Invalid quiz results format - answers must be an array'
      }, { status: 400 })
    }

    if (!quizResults.completedAt || !quizResults.totalTime) {
      return NextResponse.json({
        error: 'Invalid quiz results format - missing completedAt or totalTime'
      }, { status: 400 })
    }

    console.log(`📊 Quiz results summary:`, {
      userId: quizResults.userId,
      displayName: quizResults.displayName,
      totalTime: quizResults.totalTime,
      questionsCount: quizResults.questionsCount,
      answersCount: quizResults.answers.length
    })

    // 🆕 PRE-CHECK: Get session status before saving
    const sessionBefore = await sessionDb.getSession(sessionId)
    console.log(`📊 Session status BEFORE saving: ${sessionBefore?.status || 'not found'}`)

    // Save quiz results to PostgreSQL database
    const success = await sessionDb.saveQuizResults(sessionId, userId, quizResults)

    if (!success) {
      console.log(`❌ Failed to save quiz results for user: ${userId}`)
      return NextResponse.json({
        error: 'Failed to save quiz results. Check session ID and user permissions.'
      }, { status: 400 })
    }

    console.log(`✅ Quiz results saved successfully for user ${userId} in session ${sessionId}`)
    console.log(`⏱️ User completed quiz in ${quizResults.totalTime} seconds`)

    // 🆕 POST-CHECK: Get updated session to check if all completed - WITH SMALL DELAY
    console.log(`🔄 Waiting for database propagation...`)
    await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay for DB propagation

    const sessionAfter = await sessionDb.getSession(sessionId)
    if (!sessionAfter) {
      console.log(`⚠️ Session not found after saving quiz results: ${sessionId}`)
      return NextResponse.json({
        error: 'Session not found after saving results'
      }, { status: 404 })
    }

    const statusChanged = sessionBefore?.status !== sessionAfter.status
    const allCompleted = sessionAfter.status === 'results'

    console.log(`📊 Session status AFTER saving: ${sessionAfter.status}`)
    console.log(`🔄 Status changed: ${statusChanged} (${sessionBefore?.status} → ${sessionAfter.status})`)
    console.log(`🏆 All completed: ${allCompleted}`)

    // 🆕 ENHANCED RESPONSE: Return more detailed status info
    const responseData = {
      success: true,
      allCompleted: allCompleted,
      sessionStatus: sessionAfter.status,
      statusChanged: statusChanged,
      // 🆕 DEBUG INFO: Add completion details
      completionDetails: await sessionDb.getQuizCompletionStatus(sessionId)
    }

    console.log(`✅ Sending response:`, responseData)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Error submitting quiz results:', error)
    return NextResponse.json({
      error: 'Failed to submit quiz results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get quiz status for session using PostgreSQL - ENHANCED VERSION
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<any | ApiError>> {
  try {
    const { id } = await params
    const sessionId = id.toUpperCase()

    console.log(`📊 GET Quiz Status: ${sessionId}`)

    const session = await sessionDb.getSession(sessionId)

    if (!session) {
      return NextResponse.json({
        error: 'Session not found or expired'
      }, { status: 404 })
    }

    // Get all profiles to count quiz completion
    const profiles = await sessionDb.getSessionProfiles(sessionId)

    const profilesWithQuizResults = profiles.filter(profile => {
      const quizResult = profile.quiz_result
      return quizResult &&
             typeof quizResult === 'object' &&
             (quizResult as any).completedAt &&
             (quizResult as any).answers &&
             Array.isArray((quizResult as any).answers)
    })

    // 🆕 ENHANCED STATUS: Add more detailed completion info
    const completionStatus = await sessionDb.getQuizCompletionStatus(sessionId)

    const quizStatus = {
      sessionId: session.sessionId,
      status: session.status,
      currentStep: session.currentStep,
      totalParticipants: profiles.length,
      completedQuizzes: profilesWithQuizResults.length,
      allCompleted: profilesWithQuizResults.length === profiles.length && profiles.length > 0,
      // 🆕 ENHANCED: Add detailed completion breakdown
      completionDetails: completionStatus,
      participants: profiles.map(profile => ({
        userId: profile.userId,
        username: profile.username,
        isAdmin: profile.isAdmin,
        hasQuizResult: !!(profile.quiz_result &&
                         typeof profile.quiz_result === 'object' &&
                         (profile.quiz_result as any).completedAt &&
                         Array.isArray((profile.quiz_result as any).answers))
      }))
    }

    console.log(`📊 Quiz status:`, {
      sessionStatus: quizStatus.status,
      totalParticipants: quizStatus.totalParticipants,
      completedQuizzes: quizStatus.completedQuizzes,
      allCompleted: quizStatus.allCompleted
    })

    return NextResponse.json(quizStatus)

  } catch (error) {
    console.error('❌ Error getting quiz status:', error)
    return NextResponse.json({
      error: 'Failed to get quiz status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}