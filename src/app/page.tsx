// src/app/page.tsx - NAPRAWKA REAL-TIME
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

// Types
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'

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

    // 🆕 ROZSZERZONE: Dodaj participant_profile do real-time steps
    const realTimeSteps: AppStep[] = [
      'participant_profile', // 🆕 DODANE: Teraz participant ma real-time od razu po dołączeniu
      'qr_code',
      'waiting_room'
    ]

    return realTimeSteps.includes(currentStep)
  }

  // 🆕 REAL-TIME SESSION: Włączony dla więcej kroków
  const {
    session: realTimeSession,
    isConnected: realTimeConnected,
    connectionState: realTimeConnectionState,
    isUsingRealTime,
    eventCount: realTimeEventCount,
    lastUpdate: realTimeLastUpdate,
    reconnect: realTimeReconnect
  } = useRealTimeSessionWithFallback(
    // 🔧 NAPRAWKA: Używaj shouldEnableRealTime() zamiast hardcoded kroków
    shouldEnableRealTime() ? session?.sessionId || '' : '',
    session,
    shouldEnableRealTime() // enableSSE based on step and auth status
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
          const validStep = validateStepAgainstSession(savedStep, session, isAdmin)
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

      const determinedStep = determineStepFromSession(session, isAdmin)

      console.log(`🎯 Determined currentStep from session: ${determinedStep}`)
      setCurrentStep(determinedStep)
      saveCurrentStep(clientSession.sessionId, clientSession.userId, determinedStep)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, clientSession, isAdmin, session]) // 🔧 NAPRAWKA: Dodano session z powrotem

  // 🔧 NAPRAWKA: Reaguj na real-time updates sesji
  useEffect(() => {
    if (realTimeSession && isAuthenticated && clientSession) {
      console.log('🔄 Real-time session update detected, checking if step needs update')

      const currentValidStep = validateStepAgainstSession(currentStep, realTimeSession, isAdmin)
      if (currentValidStep !== currentStep) {
        console.log(`🔄 Real-time triggered step change: ${currentStep} → ${currentValidStep}`)
        setCurrentStep(currentValidStep)
        saveCurrentStep(clientSession.sessionId, clientSession.userId, currentValidStep)
      }
    }
  }, [realTimeSession, isAuthenticated, clientSession, currentStep, isAdmin]) // Monitor real-time session changes

  // 🆕 NEW: Determine step from session based on user type
  const determineStepFromSession = (session: any, isAdmin: boolean): AppStep => {
    if (isAdmin) {
      // 🔵 ADMIN FLOW: platforms → mode → profile → qr_code → waiting_room → quiz → results
      if (!session?.selectedPlatforms?.length) {
        return 'platforms'
      } else if (!session.viewingMode) {
        return 'mode'
      } else if (!session.adminProfile) {
        return 'profile'
      } else if (session.status === 'recruiting') {
        return 'qr_code' // Admin shows QR code for recruitment
      } else if (session.status === 'collecting_profiles' || session.status === 'ready_for_quiz') {
        return 'waiting_room' // Admin waits for participants to add profiles
      } else if (session.status === 'quiz_active' || session.status === 'quiz') {
        return 'quiz'
      } else if (session.status === 'results') {
        return 'results'
      } else {
        // Check viewing mode for default destination
        const viewingModeId = typeof session.viewingMode === 'string'
          ? session.viewingMode
          : session?.viewingMode?.id

        if (viewingModeId === 'solo') {
          return 'quiz' // Solo goes directly to quiz
        } else {
          return 'qr_code' // Multi-user goes to QR code
        }
      }
    } else {
      // 🟢 PARTICIPANT FLOW: participant_profile → waiting_room → quiz → results

      // Check if participant has added their profile
      const participantProfile = session.profiles?.find((p: any) =>
        p.userId === clientSession?.userId && !p.isAdmin
      )

      const hasRealProfile = participantProfile &&
        participantProfile.username &&
        participantProfile.username !== `temp_${participantProfile.userId.slice(-8)}`

      if (!participantProfile || !hasRealProfile) {
        return 'participant_profile' // Participant needs to add profile
      } else if (session.status === 'collecting_profiles' || session.status === 'recruiting' || session.status === 'ready_for_quiz') {
        return 'waiting_room' // Waiting for admin to start quiz
      } else if (session.status === 'quiz_active' || session.status === 'quiz') {
        return 'quiz'
      } else if (session.status === 'results') {
        return 'results'
      } else {
        return 'waiting_room' // Default for participant with profile
      }
    }
  }

  // 🆕 ENHANCED: Validate step against session progress and user type
  const validateStepAgainstSession = (step: AppStep, session: any, isAdmin: boolean): AppStep => {
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
      if (step === 'results' && session.status !== 'results') {
        return 'quiz'
      }
    } else {
      // Participant validation logic
      const participantProfile = session.profiles?.find((p: any) =>
        p.userId === clientSession?.userId && !p.isAdmin
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
      if (step === 'results' && session.status !== 'results') {
        return 'quiz'
      }
    }

    // Step is valid
    return step
  }

  // 🎯 Helper function to update currentStep
  const updateCurrentStep = (newStep: AppStep) => {
    if (clientSession) {
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
        updateCurrentStep('qr_code') // Multi-user goes to QR code
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

  // Debug info component
  const DebugInfo = () => {
    if (process.env.NODE_ENV !== 'development' || !showDebug) return null

    const savedStep = clientSession ? loadCurrentStep(clientSession.sessionId, clientSession.userId) : null

    // 🔧 HELPER: Type assertion for profiles access
    const sessionWithProfiles = session as any

    return (
      <div className="fixed bottom-4 left-4 right-4 bg-black/90 text-green-400 p-3 rounded-lg text-xs font-mono z-50 max-h-48 overflow-y-auto">
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
          <div><span className="text-yellow-400">Auth:</span> {isAuthenticated ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">User Type:</span> {isAdmin ? '🔵 Admin' : '🟢 Participant'}</div>
          <div><span className="text-yellow-400">Session ID:</span> {session?.sessionId || 'None'}</div>
          <div><span className="text-yellow-400">User ID:</span> {clientSession?.userId || 'None'}</div>
          <div><span className="text-yellow-400">Session Status:</span> {session?.status || 'None'}</div>

          {/* 🔧 NAPRAWKA: Enhanced real-time debug info */}
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
              {sessionWithProfiles.profiles && (
                <div><span className="text-yellow-400">Profiles:</span> {sessionWithProfiles.profiles.map((p: any) =>
                  `${p.username}(${p.isAdmin ? 'admin' : 'participant'})${p.pic_url ? '🖼️' : '👤'}`
                ).join(', ')}</div>
              )}
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

  // 🔧 WRAPPER: Convert refreshSession to void return type
  const handleRefreshSession = async (): Promise<void> => {
    await refreshSession()
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

      {/* 🟢 PARTICIPANT FLOW - 🔧 NAPRAWKA: Teraz z real-time! */}
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

      {/* QUIZ SCREEN */}
      {currentStep === 'quiz' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-light text-white">Quiz Component</h1>
              <p className="text-gray-400">
                {isAdmin ? 'Quiz - Admin View' : 'Quiz - Participant View'}
              </p>
              <p className="text-blue-400">Coming next: Movie preference quiz</p>
              {session?.viewingMode && (
                <p className="text-green-400">Mode: {
                  typeof session.viewingMode === 'string'
                    ? session.viewingMode
                    : session.viewingMode.displayName || session.viewingMode.id
                }</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* RESULTS SCREEN */}
      {currentStep === 'results' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-light text-white">Results</h1>
              <p className="text-gray-400">Movie recommendations will appear here</p>
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