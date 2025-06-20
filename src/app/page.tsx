// src/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { useSession } from '@/hooks/useSession'

// Components
import DesktopBlocker from '@/components/DesktopBlocker'
import LoginPage from '@/components/LoginPage'
import LogoutButton from '@/components/LogoutButton'
import PlatformSelector from '@/components/PlatformSelector'
import ModeSelector from '@/components/ModeSelector'
import SocialProfileInput from '@/components/SocialProfileInput'

// Types
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'

const CORRECT_PASSWORD = 'aicc$'

type AppStep = 'login' | 'platforms' | 'mode' | 'profile' | 'quiz' | 'results'

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
    clearSession,
    isAdmin
  } = useSession()

  // Local state
  const [currentStep, setCurrentStep] = useState<AppStep>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [showContent, setShowContent] = useState(false)

  // Debug mode (tylko w development)
  const [showDebug, setShowDebug] = useState(false)

  // Determinate step based on session state
  useEffect(() => {
    if (!isAuthenticated || (!session && !clientSession)) {
      setCurrentStep('login')
      return
    }

    // Jeśli mamy clientSession ale nie session, ustaw platforms (pierwszą sesję można odbudować)
    if (clientSession && !session) {
      setCurrentStep('platforms')
      return
    }

    // Determine step based on session progress
    if (!session?.selectedPlatforms?.length) {
      setCurrentStep('platforms')
    } else if (!session.viewingMode) {
      setCurrentStep('mode')
    } else if (!session.adminProfile) {
      setCurrentStep('profile')
    } else if (session.status === 'quiz') {
      setCurrentStep('quiz')
    } else if (session.status === 'results') {
      setCurrentStep('results')
    }
  }, [isAuthenticated, session, clientSession])

  // Show content with delay for animations
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isAuthenticated, currentStep])

  // Handle login
  const handleLogin = async (password: string) => {
    if (password === CORRECT_PASSWORD) {
      console.log('🔐 Login successful, creating session...')

      setIsAuthenticated(true)
      setLoginError('')

      // Create new session
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
    setIsAuthenticated(false)
    setCurrentStep('login')
    setShowContent(false)
    clearSession()
  }

  // Handle platform selection
  const handlePlatformContinue = async (selectedPlatforms: StreamingPlatform[]) => {
    console.log('🎬 Platforms selected:', selectedPlatforms.map(p => p.displayName))

    const success = await updatePlatforms(selectedPlatforms)
    if (success) {
      console.log('✅ Platforms saved to session')
      // Step change will be handled by useEffect
    } else {
      console.error('❌ Failed to save platforms to session')
    }
  }

  // Handle mode selection
  const handleModeContinue = async (selectedMode: ViewingMode) => {
    console.log('👥 Mode selected:', selectedMode.displayName)

    const success = await updateMode(selectedMode)
    if (success) {
      console.log('✅ Mode saved to session')
      // Step change will be handled by useEffect
    } else {
      console.error('❌ Failed to save mode to session')
    }
  }

  // Handle profile completion
  const handleProfileContinue = async (profile: SocialProfile) => {
    console.log('👤 Profile completed:', profile.username, profile.platform)

    const success = await updateAdminProfile(profile)
    if (success) {
      console.log('✅ Profile saved to session')
      // Step change will be handled by useEffect
    } else {
      console.error('❌ Failed to save profile to session')
    }
  }

  // Debug info component
  const DebugInfo = () => {
    if (process.env.NODE_ENV !== 'development' || !showDebug) return null

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
          <div><span className="text-yellow-400">Step:</span> {currentStep}</div>
          <div><span className="text-yellow-400">Auth:</span> {isAuthenticated ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Session ID:</span> {session?.sessionId || 'None'}</div>
          <div><span className="text-yellow-400">User ID:</span> {clientSession?.userId || 'None'}</div>
          <div><span className="text-yellow-400">Is Admin:</span> {isAdmin ? '✅' : '❌'}</div>
          <div><span className="text-yellow-400">Session Status:</span> {session?.status || 'None'}</div>

          {session && (
            <>
              <div><span className="text-yellow-400">Platforms:</span> {session.selectedPlatforms?.length ?? 0}</div>
              <div><span className="text-yellow-400">Mode:</span> {session.viewingMode?.displayName || 'None'}</div>
              <div><span className="text-yellow-400">Profile:</span> {session.adminProfile?.displayName || 'None'}</div>
              <div><span className="text-yellow-400">Participants:</span> {session.participants?.length ?? 0}</div>
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
          <p className="text-gray-400 font-light">Initializing session...</p>
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

      {currentStep === 'platforms' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <PlatformSelector onContinue={handlePlatformContinue} />
        </>
      )}

      {currentStep === 'mode' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <ModeSelector onContinue={handleModeContinue} />
        </>
      )}

      {currentStep === 'profile' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <SocialProfileInput
            onContinue={handleProfileContinue}
            showContent={showContent}
          />
        </>
      )}

      {currentStep === 'quiz' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-light text-white">Quiz Component</h1>
              <p className="text-gray-400">Coming next: Movie preference quiz</p>
              {session?.viewingMode && (
                <p className="text-blue-400">Mode: {session.viewingMode.displayName}</p>
              )}
              {session?.adminProfile && (
                <p className="text-green-400">Profile: {session.adminProfile.displayName}</p>
              )}
            </div>
          </div>
        </>
      )}

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

      {/* Session error notification - only show after login */}
      {sessionError && currentStep !== 'login' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
          Session Error: {sessionError}
        </div>
      )}
    </>
  )
}