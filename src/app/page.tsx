// src/app/page.tsx - CRITICAL FIX - RACE CONDITION RESOLVED
'use client'

import { useState, useEffect } from 'react'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { useSession } from '@/hooks/useSession'
// 🆕 SSE INTEGRATION: Import real-time hook
import { useRealTimeSessionWithFallback } from '@/hooks/useRealTimeSession'

// Components
import DesktopBlocker from '@/components/DesktopBlocker'
import LoginPage from '@/components/LoginPage'
import LogoutButton from '@/components/LogoutButton'
import PlatformSelector from '@/components/PlatformSelector'
import ModeSelector from '@/components/ModeSelector'
import SocialProfileInput from '@/components/SocialProfileInput'
import QRCodeScreen from '@/components/QRCodeScreen'
import WaitingRoomScreen from '@/components/WaitingRoomScreen'
// 🆕 QUIZ INTEGRATION: Import real QuizScreen component
import QuizScreen from '@/components/QuizScreen'

// Types
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'

// 🆕 QUIZ TYPES: Add quiz answer types
interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number // czas w sekundach
}

const CORRECT_PASSWORD = 'aicc$'

type AppStep = 'login' | 'platforms' | 'mode' | 'profile' | 'participant_profile' | 'qr_code' | 'waiting_room' | 'quiz' | 'results'

// 🎯 localStorage helpers for currentStep per user
const getCurrentStepKey = (sessionId: string, userId: string) => `vodmatch_step_${sessionId}_${userId}`

const saveCurrentStep = (sessionId: string, userId: string, step: AppStep) => {
  try {
    localStorage.setItem(getCurrentStepKey(sessionId, userId), step)
    console.log(`💾 Saved currentStep: ${step} for user ${userId}`)
  } catch (error) {
    console.error('❌ Failed to save currentStep:', error)
  }
}

const loadCurrentStep = (sessionId: string, userId: string): AppStep | null => {
  try {
    const saved = localStorage.getItem(getCurrentStepKey(sessionId, userId))
    console.log(`📖 Loaded currentStep: ${saved} for user ${userId}`)
    return saved as AppStep
  } catch (error) {
    console.error('❌ Failed to load currentStep:', error)
    return null
  }
}

const clearCurrentStep = (sessionId: string, userId: string) => {
  try {
    localStorage.removeItem(getCurrentStepKey(sessionId, userId))
    console.log(`🗑️ Cleared currentStep for user ${userId}`)
  } catch (error) {
    console.error('❌ Failed to clear currentStep:', error)
  }
}

// 🆕 UNIFIED: Same completion logic as backend - CRITICAL FIX
const userHasCompletedQuiz = (session: any, userId: string): boolean => {
  const sessionWithProfiles = session as any
  if (!sessionWithProfiles?.profiles) return false

  const userProfile = sessionWithProfiles.profiles.find((p: any) => p.userId === userId)
  if (!userProfile) return false

  const quizResult = userProfile.quiz_result

  // 🆕 ENHANCED: Exactly same logic as backend isQuizResultComplete()
  const hasCompleted = !!(quizResult &&
           typeof quizResult === 'object' &&
           quizResult.completedAt &&
           Array.isArray(quizResult.answers) &&
           typeof quizResult.totalTime !== 'undefined' &&
           quizResult.answers.length > 0)

  if (hasCompleted) {
    console.log(`✅ User ${userId} (${userProfile.username}) has completed quiz - should be on results page`)
    console.log(`  📊 Quiz data: completedAt=${!!quizResult.completedAt}, answers=${quizResult.answers?.length || 0}, totalTime=${quizResult.totalTime}`)
  } else {
    console.log(`❌ User ${userId} (${userProfile.username}) has NOT completed quiz yet`)
    if (quizResult && typeof quizResult === 'object') {
      console.log(`  🔍 Quiz data debug: completedAt=${!!quizResult.completedAt}, answers=${Array.isArray(quizResult.answers) ? quizResult.answers.length : 'not array'}, totalTime=${quizResult.totalTime}`)
    } else {
      console.log(`  🔍 No quiz_result or invalid format: ${typeof quizResult}`)
    }
  }

  return hasCompleted
}

// 🆕 ENHANCED: More detailed completion stats with debugging
const getQuizCompletionStats = (session: any): {
  completed: number,
  total: number,
  completedUsers: string[],
  pendingUsers: string[],
  debugInfo: any[]
} => {
  const sessionWithProfiles = session as any
  if (!sessionWithProfiles?.profiles) return {
    completed: 0,
    total: 0,
    completedUsers: [],
    pendingUsers: [],
    debugInfo: []
  }

  const completedUsers: string[] = []
  const pendingUsers: string[] = []
  const debugInfo: any[] = []

  sessionWithProfiles.profiles.forEach((profile: any) => {
    const isCompleted = userHasCompletedQuiz(session, profile.userId)
    const userLabel = `${profile.username}(${profile.isAdmin ? 'admin' : 'participant'})`

    // 🆕 DEBUG: Collect detailed info about each profile
    const quizResult = profile.quiz_result
    const profileDebug = {
      userId: profile.userId,
      username: profile.username,
      isAdmin: profile.isAdmin,
      isCompleted,
      hasQuizResult: !!quizResult && typeof quizResult === 'object',
      quizResultStructure: quizResult ? {
        hasCompletedAt: !!quizResult.completedAt,
        hasAnswers: Array.isArray(quizResult.answers),
        answersLength: Array.isArray(quizResult.answers) ? quizResult.answers.length : 0,
        hasTotalTime: typeof quizResult.totalTime !== 'undefined',
        totalTime: quizResult.totalTime
      } : null
    }
    debugInfo.push(profileDebug)

    if (isCompleted) {
      completedUsers.push(userLabel)
    } else {
      pendingUsers.push(userLabel)
    }
  })

  return {
    completed: completedUsers.length,
    total: sessionWithProfiles.profiles.length,
    completedUsers,
    pendingUsers,
    debugInfo
  }
}

export default function VodMatchApp() {
  // Device detection
  const { isMobile } = useDeviceDetection()

  // Session management
  const {
    session,
    clientSession,
    isLoading: sessionLoading,
    error: sessionError,
    createSession,
    updatePlatforms,
    updateMode,
    updateAdminProfile,
    updateParticipantProfile,
    submitQuizResults, // 🆕 ADD: New quiz results submission
    clearSession,
    refreshSession,
    isAdmin,
    closeRegistration,
    startQuiz,
    getParticipantStatus
  } = useSession()

  // Local state
  const [currentStep, setCurrentStep] = useState<AppStep>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [showContent, setShowContent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Debug mode (tylko w development)
  const [showDebug, setShowDebug] = useState(false)

  // 🔧 NAPRAWKA: Określ czy należy włączyć real-time na podstawie kroku i statusu sesji
  const shouldEnableRealTime = () => {
    if (!session?.sessionId || !isAuthenticated) return false

    // 🆕 ROZSZERZONE: Dodaj quiz do real-time steps
    const realTimeSteps: AppStep[] = [
      'participant_profile',
      'qr_code',
      'waiting_room',
      'quiz' // 🆕 DODANE: Quiz też potrzebuje real-time dla synchronizacji
    ]

    return realTimeSteps.includes(currentStep)
  }

  // 🆕 REAL-TIME SESSION: Włączony także dla quiz
  const {
    session: realTimeSession,
    isConnected: realTimeConnected,
    connectionState: realTimeConnectionState,
    isUsingRealTime,
    eventCount: realTimeEventCount,
    lastUpdate: realTimeLastUpdate,
    reconnect: realTimeReconnect
  } = useRealTimeSessionWithFallback(
    shouldEnableRealTime() ? session?.sessionId || '' : '',
    session,
    shouldEnableRealTime()
  )

  // 🎯 Auto-authenticate from localStorage if clientSession exists
  useEffect(() => {
    if (!isAuthenticated && clientSession) {
      console.log('🔄 Auto-authenticating from localStorage:', clientSession.sessionId)
      console.log(`👤 User type: ${isAdmin ? 'Admin' : 'Participant'}`)
      setIsAuthenticated(true)
    }
  }, [clientSession, isAuthenticated, isAdmin])

  // 🔧 NAPRAWKA: Dodaj session z powrotem do dependencies, ale z debounce
  useEffect(() => {
    if (!isAuthenticated || !clientSession) {
      setCurrentStep('login')
      return
    }

    // 🔧 DEBOUNCE: Prevent excessive re-determination
    const timeoutId = setTimeout(() => {
      // Try to load currentStep from localStorage first
      const savedStep = loadCurrentStep(clientSession.sessionId, clientSession.userId)

      if (savedStep) {
        console.log(`🎯 Using currentStep from localStorage: ${savedStep}`)

        // 🔧 NAPRAWKA: Validate if saved step is still valid based on session progress and user type
        if (session) {
          const validStep = validateStepAgainstSession(savedStep, session, isAdmin, clientSession.userId)
          if (validStep !== savedStep) {
            console.log(`🔄 Adjusting step from ${savedStep} to ${validStep} based on session progress`)
            setCurrentStep(validStep)
            saveCurrentStep(clientSession.sessionId, clientSession.userId, validStep)
          } else {
            setCurrentStep(savedStep)
          }
        } else {
          // No session loaded yet, use saved step
          setCurrentStep(savedStep)
        }
        return
      }

      // 🔄 FALLBACK: Determine step based on session progress and user type
      console.log(`🔄 No saved currentStep, determining from session progress (isAdmin: ${isAdmin})`)

      if (!session) {
        // Waiting for session to load - set safe default based on user type
        setCurrentStep(isAdmin ? 'platforms' : 'participant_profile')
        return
      }

      const determinedStep = determineStepFromSession(session, isAdmin, clientSession.userId)

      console.log(`🎯 Determined currentStep from session: ${determinedStep}`)
      setCurrentStep(determinedStep)
      saveCurrentStep(clientSession.sessionId, clientSession.userId, determinedStep)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, clientSession, isAdmin, session])

  // 🔧 NAPRAWKA: Reaguj na real-time updates sesji z PROTECTION
  useEffect(() => {
    if (realTimeSession && isAuthenticated && clientSession) {
      console.log('🔄 Real-time session update detected, checking if step needs update')

      const currentValidStep = validateStepAgainstSession(currentStep, realTimeSession, isAdmin, clientSession.userId)
      if (currentValidStep !== currentStep) {
        // 🛡️ RACE CONDITION PROTECTION: Nie resetuj z results do quiz
        if (currentStep === 'results' && currentValidStep === 'quiz') {
          console.log('🛡️ Preventing reset from results to quiz - race condition protection')
          return
        }

        console.log(`🔄 Real-time triggered step change: ${currentStep} → ${currentValidStep}`)
        setCurrentStep(currentValidStep)
        saveCurrentStep(clientSession.sessionId, clientSession.userId, currentValidStep)
      }
    }
  }, [realTimeSession, isAuthenticated, clientSession, currentStep, isAdmin])

  // 🆕 NEW: Determine step from session based on user type - ENHANCED FOR GROUP
  const determineStepFromSession = (session: any, isAdmin: boolean, userId: string): AppStep => {
    // 🎯 PRIORITY FIX: Check results status FIRST for both admin and participants
    if (session.status === 'results') {
      return 'results'
    }

    // 🆕 KLUCZOWA LOGIKA: Jeśli użytkownik ukończył quiz, zawsze pokaż results
    if (userHasCompletedQuiz(session, userId)) {
      const stats = getQuizCompletionStats(session)
      console.log(`🏆 User ${userId} completed quiz - forcing results page`)
      console.log(`📊 Quiz completion stats: ${stats.completed}/${stats.total} completed`)
      console.log(`✅ Completed: ${stats.completedUsers.join(', ')}`)
      console.log(`⏳ Pending: ${stats.pendingUsers.join(', ')}`)
      return 'results'
    }

    if (isAdmin) {
      // 🔵 ADMIN FLOW: platforms → mode → profile → qr_code → waiting_room → quiz → results
      if (!session?.selectedPlatforms?.length) {
        return 'platforms'
      } else if (!session.viewingMode) {
        return 'mode'
      } else if (!session.adminProfile) {
        return 'profile'
      } else if (session.status === 'recruiting') {
        return 'qr_code'
      } else if (session.status === 'collecting_profiles' || session.status === 'ready_for_quiz') {
        return 'waiting_room'
      } else if (session.status === 'quiz_active' || session.status === 'quiz') {
        return 'quiz'
      } else {
        // Check viewing mode for default destination (only if not results)
        const viewingModeId = typeof session.viewingMode === 'string'
          ? session.viewingMode
          : session?.viewingMode?.id

        if (viewingModeId === 'solo') {
          return 'quiz' // Solo goes directly to quiz
        } else {
          return 'qr_code' // Multi-user (couple/group) goes to QR code
        }
      }
    } else {
      // 🟢 PARTICIPANT FLOW: participant_profile → waiting_room → quiz → results
      const participantProfile = session.profiles?.find((p: any) =>
        p.userId === userId && !p.isAdmin
      )

      const hasRealProfile = participantProfile &&
        participantProfile.username &&
        participantProfile.username !== `temp_${participantProfile.userId.slice(-8)}`

      if (!participantProfile || !hasRealProfile) {
        return 'participant_profile'
      } else if (session.status === 'collecting_profiles' || session.status === 'recruiting' || session.status === 'ready_for_quiz') {
        return 'waiting_room'
      } else if (session.status === 'quiz_active' || session.status === 'quiz') {
        return 'quiz'
      } else {
        return 'waiting_room' // Default for participant with profile
      }
    }
  }

  // 🆕 SIMPLIFIED: Validate step against session - RACE CONDITION FIX
  const validateStepAgainstSession = (step: AppStep, session: any, isAdmin: boolean, userId: string): AppStep => {
    // 🎯 PRIORITY 1: Jeśli session status = 'results', wszyscy na results
    if (session.status === 'results') {
      console.log(`🏆 Global session status is 'results' - all users go to results`)
      return 'results'
    }

    // 🎯 PRIORITY 2: Jeśli user ma quiz_result = może być na results (RACE CONDITION FIX)
    if (step === 'results') {
      const hasQuizResult = userHasCompletedQuiz(session, userId)
      if (hasQuizResult) {
        console.log(`✅ User ${userId} has quiz_result - staying on results regardless of session status`)
        return 'results'  // ✅ Ma wynik = zostaje na results
      } else {
        console.log(`❌ User ${userId} has no quiz_result - redirecting to quiz`)
        return 'quiz'     // ❌ Nie ma wyniku = wraca do quiz
      }
    }

    // 🎯 PRIORITY 3: Reszta walidacji dla innych kroków
    if (isAdmin) {
      // Admin validation logic
      if (step === 'mode' && !session.selectedPlatforms?.length) {
        return 'platforms'
      }
      if (step === 'profile' && !session.viewingMode) {
        return 'mode'
      }
      if ((step === 'qr_code' || step === 'waiting_room') && !session.adminProfile) {
        return 'profile'
      }
      // 🔧 QUIZ VALIDATION: Allow transition to quiz when status changes
      if (step === 'waiting_room' && (session.status === 'quiz_active' || session.status === 'quiz')) {
        return 'quiz'
      }
    } else {
      // Participant validation logic
      const participantProfile = session.profiles?.find((p: any) =>
        p.userId === userId && !p.isAdmin
      )

      const hasRealProfile = participantProfile &&
        participantProfile.username &&
        participantProfile.username !== `temp_${participantProfile.userId.slice(-8)}`

      if (step === 'waiting_room' && (!participantProfile || !hasRealProfile)) {
        return 'participant_profile'
      }
      // 🔧 QUIZ VALIDATION: Allow transition to quiz when status changes
      if ((step === 'participant_profile' || step === 'waiting_room') && (session.status === 'quiz_active' || session.status === 'quiz')) {
        return 'quiz'
      }
    }

    // Step is valid - no changes needed
    return step
  }

  // 🎯 Helper function to update currentStep
  const updateCurrentStep = (newStep: AppStep) => {
    if (clientSession) {
      console.log(`🔄 Updating currentStep: ${currentStep} → ${newStep} for user ${clientSession.userId}`)
      setCurrentStep(newStep)
      saveCurrentStep(clientSession.sessionId, clientSession.userId, newStep)
    }
  }

  // Show content with delay for animations
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isAuthenticated, currentStep])

  // Handle login (ADMIN ONLY)
  const handleLogin = async (password: string) => {
    if (password === CORRECT_PASSWORD) {
      console.log('🔐 Login successful, creating session...')

      setIsAuthenticated(true)
      setLoginError('')

      // Create new session (admin)
      const success = await createSession()
      if (!success) {
        console.error('❌ Failed to create session after login')
        setLoginError('Failed to initialize session')
        setIsAuthenticated(false)
        return
      }

      console.log('✅ Session created successfully after login')
    } else {
      setLoginError('Incorrect access code')
      setIsAuthenticated(false)
    }
  }

  // Handle logout
  const handleLogout = () => {
    console.log('🚪 Logging out and clearing session...')

    // Clear currentStep from localStorage
    if (clientSession) {
      clearCurrentStep(clientSession.sessionId, clientSession.userId)
    }

    setIsAuthenticated(false)
    setCurrentStep('login')
    setShowContent(false)
    clearSession()
  }

  // Handle platform selection (ADMIN ONLY)
  const handlePlatformContinue = async (selectedPlatforms: StreamingPlatform[]) => {
    console.log('🎬 Platforms selected:', selectedPlatforms.map(p => p.displayName))

    const success = await updatePlatforms(selectedPlatforms)
    if (success) {
      console.log('✅ Platforms saved to session')
      updateCurrentStep('mode')
    } else {
      console.error('❌ Failed to save platforms to session')
    }
  }

  // Handle mode selection (ADMIN ONLY)
  const handleModeContinue = async (selectedMode: ViewingMode) => {
    console.log('👥 Mode selected:', selectedMode.displayName)

    const success = await updateMode(selectedMode)
    if (success) {
      console.log('✅ Mode saved to session')
      updateCurrentStep('profile')
    } else {
      console.error('❌ Failed to save mode to session')
    }
  }

  // Handle admin profile completion
  const handleAdminProfileContinue = async (profile: SocialProfile) => {
    console.log('👤 Admin profile completed:', profile.username, profile.platform)

    const success = await updateAdminProfile(profile)
    if (success) {
      console.log('✅ Admin profile saved to session')

      // Check viewing mode to determine next step
      const viewingModeId = typeof session?.viewingMode === 'string'
        ? session.viewingMode
        : session?.viewingMode?.id

      if (viewingModeId === 'solo') {
        updateCurrentStep('quiz') // Solo goes directly to quiz
      } else {
        updateCurrentStep('qr_code') // Multi-user (couple/group) goes to QR code
      }
    } else {
      console.error('❌ Failed to save admin profile to session')
    }
  }

  // 🆕 NEW: Handle participant profile completion
  const handleParticipantProfileContinue = async (profile: SocialProfile) => {
    console.log('👤 Participant profile completed:', profile.username, profile.platform)

    const success = await updateParticipantProfile(profile)
    if (success) {
      console.log('✅ Participant profile saved to session')
      updateCurrentStep('waiting_room') // Participant waits for admin to start
    } else {
      console.error('❌ Failed to save participant profile to session')
    }
  }

  // Handle QR code screen
  const handleCloseRegistration = async () => {
    setIsProcessing(true)
    try {
      console.log('🚪 Admin closing registration using useSession method...')

      const success = await closeRegistration()

      if (success) {
        console.log('✅ Registration closed successfully')
        await refreshSession()
        updateCurrentStep('waiting_room')
      } else {
        console.error('❌ Failed to close registration')
        updateCurrentStep('waiting_room')
      }

    } catch (error) {
      console.error('❌ Error in handleCloseRegistration:', error)
      updateCurrentStep('waiting_room')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle admin starting quiz
  const handleStartQuiz = async () => {
    setIsProcessing(true)
    try {
      console.log('🎯 Admin starting quiz using useSession method...')

      const success = await startQuiz()

      if (success) {
        console.log('✅ Quiz started successfully')
        await refreshSession()
        updateCurrentStep('quiz')
      } else {
        console.error('❌ Failed to start quiz')
        alert('Failed to start quiz. Please try again.')
      }

    } catch (error) {
      console.error('❌ Error in handleStartQuiz:', error)
      alert(`Failed to start quiz: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // 🆕 QUIZ HANDLER: Handle quiz completion - RACE CONDITION FIX
  const handleQuizComplete = async (answers: QuizAnswer[]): Promise<void> => {
    if (!clientSession || !session) {
      console.error('❌ No active session for quiz completion')
      return
    }

    try {
      console.log(`📝 Quiz completed by ${clientSession.userId}, submitting ${answers.length} answers`)

      // 🆕 DEBUG: Show completion stats before submission
      const statsBefore = getQuizCompletionStats(session)
      console.log(`📊 Before submission - Completion stats: ${statsBefore.completed}/${statsBefore.total}`)
      console.log(`✅ Already completed: ${statsBefore.completedUsers.join(', ')}`)
      console.log(`⏳ Still pending: ${statsBefore.pendingUsers.join(', ')}`)

      // 🆕 RACE CONDITION FIX: Ustaw lokalnie results PRZED submission
      console.log('🏆 Setting local step to results BEFORE submitting to prevent race condition')
      updateCurrentStep('results')

      // Use new submitQuizResults signature that takes QuizAnswer[]
      const success = await submitQuizResults(answers)

      if (success) {
        console.log('✅ Quiz results submitted successfully!')
        console.log('🏆 User should now stay on results screen - protected by race condition fix')

        // 🆕 OPTIONAL: Refresh session to get latest completion stats (but don't change step)
        try {
          await refreshSession()
          const statsAfter = getQuizCompletionStats(session)
          console.log(`📊 After submission - Completion stats: ${statsAfter.completed}/${statsAfter.total}`)
        } catch (refreshError) {
          console.log('⚠️ Could not refresh session after quiz completion:', refreshError)
        }
      } else {
        console.error('❌ Failed to submit quiz results')
        // Wróć do quiz jeśli submission failed
        updateCurrentStep('quiz')
      }

    } catch (error) {
      console.error('❌ Error submitting quiz results:', error)
      // Wróć do quiz jeśli jest błąd
      updateCurrentStep('quiz')
    }
  }

  // 🔧 WRAPPER: Convert refreshSession to void return type
  const handleRefreshSession = async (): Promise<void> => {
    await refreshSession()
  }

  // Enhanced debug info component with detailed completion debugging
  const DebugInfo = () => {
    if (process.env.NODE_ENV !== 'development' || !showDebug) return null

    const savedStep = clientSession ? loadCurrentStep(clientSession.sessionId, clientSession.userId) : null
    const hasCompletedQuiz = clientSession && session ? userHasCompletedQuiz(session, clientSession.userId) : false
    const quizStats = session ? getQuizCompletionStats(session) : null

    // 🔧 HELPER: Type assertion for profiles access
    const sessionWithProfiles = session as any

    return (
      <div className="fixed bottom-4 left-4 right-4 bg-black/90 text-green-400 p-3 rounded-lg text-xs font-mono z-50 max-h-80 overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-green-300 font-bold">🐛 DEBUG SESSION</span>
          <button
            onClick={() => setShowDebug(false)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <div><span className="text-yellow-400">Current Step:</span> {currentStep}</div>
          <div><span className="text-yellow-400">Saved Step:</span> {savedStep || 'None'}</div>
          <div><span className="text-yellow-400">Quiz Completed:</span> {hasCompletedQuiz ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Auth:</span> {isAuthenticated ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">User Type:</span> {isAdmin ? '🔵 Admin' : '🟢 Participant'}</div>
          <div><span className="text-yellow-400">Session ID:</span> {session?.sessionId || 'None'}</div>
          <div><span className="text-yellow-400">User ID:</span> {clientSession?.userId || 'None'}</div>
          <div><span className="text-yellow-400">Session Status:</span> {session?.status || 'None'}</div>

          {/* 🆕 ENHANCED: Detailed quiz completion debugging */}
          {quizStats && (
            <>
              <div><span className="text-yellow-400">Quiz Progress:</span> {quizStats.completed}/{quizStats.total} completed</div>
              {quizStats.completedUsers.length > 0 && (
                <div><span className="text-green-400">✅ Completed:</span> {quizStats.completedUsers.join(', ')}</div>
              )}
              {quizStats.pendingUsers.length > 0 && (
                <div><span className="text-red-400">⏳ Pending:</span> {quizStats.pendingUsers.join(', ')}</div>
              )}

              {/* 🆕 DETAILED: Show completion structure for each user */}
              {quizStats.debugInfo && quizStats.debugInfo.length > 0 && (
                <div className="mt-2 border-t border-gray-600 pt-2">
                  <div className="text-cyan-400 font-bold">📊 DETAILED COMPLETION DEBUG:</div>
                  {quizStats.debugInfo.map((profile: any, index: number) => (
                    <div key={index} className="ml-2 text-xs">
                      <span className={profile.isCompleted ? 'text-green-400' : 'text-red-400'}>
                        {profile.isCompleted ? '✅' : '❌'} {profile.username} ({profile.isAdmin ? 'admin' : 'participant'})
                      </span>
                      {profile.quizResultStructure && (
                        <div className="ml-4 text-gray-400">
                          completedAt: {profile.quizResultStructure.hasCompletedAt ? '✅' : '❌'},
                          answers: {profile.quizResultStructure.hasAnswers ? `✅(${profile.quizResultStructure.answersLength})` : '❌'},
                          totalTime: {profile.quizResultStructure.hasTotalTime ? `✅(${profile.quizResultStructure.totalTime}s)` : '❌'}
                        </div>
                      )}
                      {!profile.hasQuizResult && (
                        <div className="ml-4 text-gray-500">No quiz_result data</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Real-time debug info */}
          <div><span className="text-yellow-400">Should Enable RT:</span> {shouldEnableRealTime() ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Real-time Connected:</span> {realTimeConnected ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Connection State:</span> {realTimeConnectionState}</div>
          <div><span className="text-yellow-400">Using Real-time:</span> {isUsingRealTime ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Event Count:</span> {realTimeEventCount}</div>
          {realTimeLastUpdate && (
            <div><span className="text-yellow-400">Last Update:</span> {realTimeLastUpdate.toLocaleTimeString()}</div>
          )}

          {session && (
            <>
              <div><span className="text-yellow-400">Platforms:</span> {session.selectedPlatforms?.length ?? 0}</div>
              <div><span className="text-yellow-400">Mode:</span> {
                typeof session.viewingMode === 'string'
                  ? session.viewingMode
                  : session.viewingMode?.displayName || session.viewingMode?.id || 'None'
              }</div>
              <div><span className="text-yellow-400">Admin Profile:</span> {session.adminProfile?.displayName || 'None'}</div>
              <div><span className="text-yellow-400">Total Profiles:</span> {sessionWithProfiles.profiles?.length ?? 0}</div>
              <div><span className="text-yellow-400">Participants Ready:</span> {(() => {
                const status = getParticipantStatus()
                return `${status.ready}/${status.total}`
              })()}</div>
            </>
          )}

          {clientSession && !session && (
            <div className="text-orange-400">
              <span className="text-yellow-400">Client Session:</span> Active (localStorage)
            </div>
          )}

          {sessionError && (
            <div className="text-red-400"><span className="text-yellow-400">Error:</span> {sessionError}</div>
          )}
        </div>
      </div>
    )
  }

  // Show desktop blocker on desktop
  if (!isMobile) {
    return <DesktopBlocker />
  }

  // Show loading during session operations
  if (sessionLoading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 font-light">
            {isAdmin ? 'Initializing session...' : 'Loading session...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Main app content */}
      {currentStep === 'login' && (
        <LoginPage onLogin={handleLogin} error={loginError} />
      )}

      {/* 🔵 ADMIN FLOW */}
      {currentStep === 'platforms' && isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <PlatformSelector onContinue={handlePlatformContinue} />
        </>
      )}

      {currentStep === 'mode' && isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <ModeSelector onContinue={handleModeContinue} />
        </>
      )}

      {currentStep === 'profile' && isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <SocialProfileInput
            onContinue={handleAdminProfileContinue}
            showContent={showContent}
          />
        </>
      )}

      {/* 🟢 PARTICIPANT FLOW */}
      {currentStep === 'participant_profile' && !isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <SocialProfileInput
            onContinue={handleParticipantProfileContinue}
            showContent={showContent}
          />
        </>
      )}

      {/* QR CODE SCREEN - Admin recruitment phase */}
      {currentStep === 'qr_code' && isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <QRCodeScreen
            sessionId={session?.sessionId || ''}
            session={realTimeSession || session}
            realTimeConnected={realTimeConnected}
            realTimeConnectionState={realTimeConnectionState}
            realTimeEventCount={realTimeEventCount}
            realTimeLastUpdate={realTimeLastUpdate}
            realTimeReconnect={realTimeReconnect}
            onCloseRegistration={handleCloseRegistration}
            onRefreshSession={handleRefreshSession}
          />
        </>
      )}

      {/* WAITING ROOM SCREEN - Both admin and participants with REAL-TIME */}
      {currentStep === 'waiting_room' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <WaitingRoomScreen
            sessionId={session?.sessionId || ''}
            session={realTimeSession || session}
            isAdmin={isAdmin}
            realTimeConnected={realTimeConnected}
            realTimeConnectionState={realTimeConnectionState}
            realTimeEventCount={realTimeEventCount}
            realTimeLastUpdate={realTimeLastUpdate}
            realTimeReconnect={realTimeReconnect}
            onStartQuiz={handleStartQuiz}
            onRefreshSession={handleRefreshSession}
            getParticipantStatus={getParticipantStatus}
          />
        </>
      )}

      {/* 🆕 QUIZ SCREEN - Real QuizScreen component with real-time */}
      {currentStep === 'quiz' && (
        <>
          {/* <LogoutButton onLogout={handleLogout} /> */}
          <QuizScreen
            sessionId={session?.sessionId || ''}
            session={realTimeSession || session}
            isAdmin={isAdmin}
            realTimeConnected={realTimeConnected}
            realTimeConnectionState={realTimeConnectionState}
            realTimeEventCount={realTimeEventCount}
            realTimeLastUpdate={realTimeLastUpdate}
            realTimeReconnect={realTimeReconnect}
            onQuizComplete={handleQuizComplete}
            onRefreshSession={handleRefreshSession}
          />
        </>
      )}

      {/* RESULTS SCREEN - Enhanced for COUPLE & GROUP - shows completion status */}
      {currentStep === 'results' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-light text-white">Quiz Results</h1>
              <p className="text-gray-400">
                {isAdmin ? 'Results - Admin View' : 'Results - Participant View'}
              </p>

              {/* 🆕 ENHANCED: Show detailed completion status for COUPLE & GROUP */}
              {clientSession && session && (() => {
                const hasCompleted = userHasCompletedQuiz(session, clientSession.userId)
                const stats = getQuizCompletionStats(session)
                const viewingMode = typeof session.viewingMode === 'string'
                  ? session.viewingMode
                  : session.viewingMode?.displayName || session.viewingMode?.id

                return (
                  <div className="space-y-3">
                    {hasCompleted ? (
                      <p className="text-green-400">✅ Your quiz has been completed!</p>
                    ) : (
                      <p className="text-orange-400">🤔 Quiz completion status unclear...</p>
                    )}

                    {/* Show completion stats for multi-user modes */}
                    {viewingMode !== 'solo' && (
                      <div className="space-y-2">
                        <p className="text-blue-400">
                          📊 Progress: {stats.completed}/{stats.total} participants completed
                        </p>

                        {stats.completedUsers.length > 0 && (
                          <p className="text-green-300 text-sm">
                            ✅ Completed: {stats.completedUsers.join(', ')}
                          </p>
                        )}

                        {stats.pendingUsers.length > 0 && (
                          <p className="text-yellow-300 text-sm">
                            ⏳ Still working: {stats.pendingUsers.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {session.status !== 'results' && stats.pendingUsers.length > 0 && (
                      <p className="text-blue-400">⏳ Waiting for other participants to finish...</p>
                    )}

                    {session.status === 'results' && (
                      <p className="text-purple-400">🏆 All participants completed! Final results ready.</p>
                    )}

                    {viewingMode && (
                      <p className="text-gray-500 text-sm">Mode: {viewingMode}</p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </>
      )}

      {/* Debug toggle button (development only) */}
      {process.env.NODE_ENV === 'development' && isAuthenticated && (
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="fixed top-4 right-4 z-50 w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center text-xs transition-colors"
          title="Toggle Debug Info"
        >
          🐛
        </button>
      )}

      {/* Debug info panel */}
      <DebugInfo />

      {/* Session error notification */}
      {sessionError && currentStep !== 'login' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
          Session Error: {sessionError}
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-center space-y-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-white">Processing...</p>
          </div>
        </div>
      )}
    </>
  )
}