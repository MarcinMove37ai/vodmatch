// src/app/page.tsx - WERSJA Z POPRAWIONĄ LOGIKĄ NAWIGACJI
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { useSession } from '@/hooks/useSession'
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
import QuizScreen from '@/components/QuizScreen'
import WaitingForResultsScreen from '@/components/WaitingForResultsScreen'

// Types
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'

interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number
}

const CORRECT_PASSWORD = 'aicc$'

type AppStep = 'login' | 'platforms' | 'mode' | 'profile' | 'participant_profile' | 'qr_code' | 'waiting_room' | 'quiz' | 'waiting_for_results'

const getCurrentStepKey = (sessionId: string, userId: string) => `vodmatch_step_${sessionId}_${userId}`
const saveCurrentStep = (sessionId: string, userId: string, step: AppStep) => { try { localStorage.setItem(getCurrentStepKey(sessionId, userId), step) } catch (e) { console.error('Failed to save currentStep:', e) } }
const loadCurrentStep = (sessionId: string, userId: string): AppStep | null => { try { const saved = localStorage.getItem(getCurrentStepKey(sessionId, userId)); return saved as AppStep } catch (e) { console.error('Failed to load currentStep:', e); return null } }
const clearCurrentStep = (sessionId: string, userId: string) => { try { localStorage.removeItem(getCurrentStepKey(sessionId, userId)) } catch (e) { console.error('Failed to clear currentStep:', e) } }

const userHasCompletedQuiz = (session: any, userId: string): boolean => {
  const userProfile = session?.profiles?.find((p: any) => p.userId === userId)
  if (!userProfile) return false
  const quizResult = userProfile.quiz_result
  return !!(quizResult && typeof quizResult === 'object' && quizResult.completedAt && Array.isArray(quizResult.answers) && typeof quizResult.totalTime !== 'undefined' && quizResult.answers.length > 0)
}

export default function VodMatchApp() {
  const { isMobile } = useDeviceDetection()
  const { session, clientSession, isLoading: sessionLoading, error: sessionError, createSession, updatePlatforms, updateMode, updateAdminProfile, updateParticipantProfile, submitQuizResults, clearSession, refreshSession, isAdmin, closeRegistration, startQuiz, getParticipantStatus } = useSession()
  const [currentStep, setCurrentStep] = useState<AppStep>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [showContent, setShowContent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const shouldEnableRealTime = () => {
    if (!session?.sessionId || !isAuthenticated) return false
    const realTimeSteps: AppStep[] = ['participant_profile', 'qr_code', 'waiting_room', 'quiz', 'waiting_for_results']
    return realTimeSteps.includes(currentStep)
  }

  const { session: realTimeSession, isConnected: realTimeConnected, connectionState: realTimeConnectionState, isUsingRealTime, eventCount: realTimeEventCount, lastUpdate: realTimeLastUpdate, reconnect: realTimeReconnect } = useRealTimeSessionWithFallback(shouldEnableRealTime() ? session?.sessionId || '' : '', session, shouldEnableRealTime())
  const effectiveSession = realTimeSession || session

  useEffect(() => {
    if (!isAuthenticated && clientSession) setIsAuthenticated(true)
  }, [clientSession, isAuthenticated, isAdmin])

  useEffect(() => {
    if (!isAuthenticated || !clientSession) {
      setCurrentStep('login')
      return
    }
    const timeoutId = setTimeout(() => {
      const savedStep = loadCurrentStep(clientSession.sessionId, clientSession.userId)
      if (savedStep) {
        if (effectiveSession) {
          const validStep = validateStepAgainstSession(savedStep, effectiveSession, isAdmin, clientSession.userId)
          if (validStep !== savedStep) {
            setCurrentStep(validStep)
            saveCurrentStep(clientSession.sessionId, clientSession.userId, validStep)
          } else {
            setCurrentStep(savedStep)
          }
        } else {
          setCurrentStep(savedStep)
        }
        return
      }
      if (!effectiveSession) {
        setCurrentStep(isAdmin ? 'platforms' : 'participant_profile')
        return
      }
      const determinedStep = determineStepFromSession(effectiveSession, isAdmin, clientSession.userId)
      setCurrentStep(determinedStep)
      saveCurrentStep(clientSession.sessionId, clientSession.userId, determinedStep)
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, clientSession, isAdmin, effectiveSession])

  useEffect(() => {
    if (realTimeSession && isAuthenticated && clientSession) {
      const currentValidStep = validateStepAgainstSession(currentStep, realTimeSession, isAdmin, clientSession.userId)
      if (currentValidStep !== currentStep) {
        if (currentStep === 'waiting_for_results' && currentValidStep === 'quiz') {
          return
        }
        setCurrentStep(currentValidStep)
        saveCurrentStep(clientSession.sessionId, clientSession.userId, currentValidStep)
      }
    }
  }, [realTimeSession, isAuthenticated, clientSession, currentStep, isAdmin])

  const determineStepFromSession = (session: any, isAdmin: boolean, userId: string): AppStep => {
    if (session.status === 'results') return 'waiting_for_results'
    if (userHasCompletedQuiz(session, userId)) return 'waiting_for_results'
    if (isAdmin) {
      if (!session?.selectedPlatforms?.length) return 'platforms'
      if (!session.viewingMode) return 'mode'
      if (!session.adminProfile) return 'profile'
      if (session.status === 'recruiting') return 'qr_code'
      if (session.status === 'collecting_profiles' || session.status === 'ready_for_quiz') return 'waiting_room'
      if (session.status === 'quiz_active' || session.status === 'quiz') return 'quiz'
      const viewingModeId = typeof session.viewingMode === 'string' ? session.viewingMode : session?.viewingMode?.id
      return viewingModeId === 'solo' ? 'quiz' : 'qr_code'
    } else {
      const participantProfile = session.profiles?.find((p: any) => p.userId === userId && !p.isAdmin)
      const hasRealProfile = participantProfile && participantProfile.username && !participantProfile.username.startsWith('temp_')
      if (!hasRealProfile) return 'participant_profile'
      if (session.status === 'collecting_profiles' || session.status === 'recruiting' || session.status === 'ready_for_quiz') return 'waiting_room'
      if (session.status === 'quiz_active' || session.status === 'quiz') return 'quiz'
      return 'waiting_room'
    }
  }

  const validateStepAgainstSession = (step: AppStep, session: any, isAdmin: boolean, userId: string): AppStep => {
    if (session.status === 'results') return 'waiting_for_results'
    // @ts-ignore - 'results' is a possible value from old localStorage
    if (step === 'results' || step === 'waiting_for_results') {
      return userHasCompletedQuiz(session, userId) ? 'waiting_for_results' : 'quiz'
    }
    if (isAdmin) {
      if (step === 'mode' && !session.selectedPlatforms?.length) return 'platforms'
      if (step === 'profile' && !session.viewingMode) return 'mode'
      if ((step === 'qr_code' || step === 'waiting_room') && !session.adminProfile) return 'profile'
      if (step === 'waiting_room' && (session.status === 'quiz_active' || session.status === 'quiz')) return 'quiz'
    } else {
      const participantProfile = session.profiles?.find((p: any) => p.userId === userId && !p.isAdmin)
      const hasRealProfile = participantProfile && participantProfile.username && !participantProfile.username.startsWith('temp_')
      if (step === 'waiting_room' && !hasRealProfile) return 'participant_profile'
      if ((step === 'participant_profile' || step === 'waiting_room') && (session.status === 'quiz_active' || session.status === 'quiz')) return 'quiz'
    }
    return step
  }

  const updateCurrentStep = (newStep: AppStep) => {
    if (clientSession) {
      setCurrentStep(newStep)
      saveCurrentStep(clientSession.sessionId, clientSession.userId, newStep)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
    }
  }, [isAuthenticated, currentStep])

  const handleLogin = async (password: string) => {
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError('');
      if (!(await createSession())) {
        setLoginError('Failed to initialize session');
        setIsAuthenticated(false);
      }
    } else {
      setLoginError('Incorrect access code');
      setIsAuthenticated(false);
    }
  }

  const handleLogout = () => { if (clientSession) { clearCurrentStep(clientSession.sessionId, clientSession.userId); } setIsAuthenticated(false); setCurrentStep('login'); setShowContent(false); clearSession(); }
  const handlePlatformContinue = async (platforms: StreamingPlatform[]) => { if (await updatePlatforms(platforms)) updateCurrentStep('mode'); }
  const handleModeContinue = async (mode: ViewingMode) => { if (await updateMode(mode)) updateCurrentStep('profile'); }

  // ‼️ KLUCZOWA ZMIANA: Ta funkcja jest teraz odporna na błędy "race condition"
  const handleAdminProfileContinue = async (profile: SocialProfile) => {
    const updatedSession = await updateAdminProfile(profile);
    if (updatedSession) {
      // Używamy świeżych danych 'updatedSession' bezpośrednio z odpowiedzi API,
      // a nie obiektu 'session' ze stanu, który może być nieaktualny.
      const modeId = typeof updatedSession.viewingMode === 'string'
        ? updatedSession.viewingMode
        : updatedSession?.viewingMode?.id;

      updateCurrentStep(modeId === 'solo' ? 'quiz' : 'qr_code');
    }
  }

  const handleParticipantProfileContinue = async (profile: SocialProfile) => { if (await updateParticipantProfile(profile)) updateCurrentStep('waiting_room'); }
  const handleCloseRegistration = async () => { setIsProcessing(true); if (await closeRegistration()) { await refreshSession(); updateCurrentStep('waiting_room'); } setIsProcessing(false); }
  const handleStartQuiz = async () => { setIsProcessing(true); if (await startQuiz()) { await refreshSession(); updateCurrentStep('quiz'); } else { alert('Failed to start quiz.'); } setIsProcessing(false); }
  const handleRefreshSession = async (): Promise<void> => { await refreshSession(); }

  const handleQuizComplete = async (answers: QuizAnswer[]): Promise<void> => {
    if (!clientSession) return;
    console.log(`📝 Quiz completed by ${clientSession.userId}. Navigating immediately.`);
    updateCurrentStep('waiting_for_results');
    (async () => {
      try {
        console.log('📤 Submitting quiz results in background...');
        const success = await submitQuizResults(answers);
        if (success) {
          console.log('✅ Quiz results submitted successfully in background.');
        } else {
          console.error('❌ Failed to submit quiz results in background.');
        }
      } catch (error) {
        console.error('❌ Error submitting quiz results in background:', error);
      }
    })();
  };

  if (!isMobile) return <DesktopBlocker />;

  if (sessionLoading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {currentStep === 'login' && <LoginPage onLogin={handleLogin} error={loginError} />}

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
          <SocialProfileInput onContinue={handleAdminProfileContinue} showContent={showContent} />
        </>
      )}

      {currentStep === 'participant_profile' && !isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <SocialProfileInput onContinue={handleParticipantProfileContinue} showContent={showContent} />
        </>
      )}

      {currentStep === 'qr_code' && isAdmin && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <QRCodeScreen
            sessionId={effectiveSession?.sessionId || ''}
            session={effectiveSession}
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

      {currentStep === 'waiting_room' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <WaitingRoomScreen
            sessionId={effectiveSession?.sessionId || ''}
            session={effectiveSession}
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

      {currentStep === 'quiz' && (
        <>
          <QuizScreen
            sessionId={effectiveSession?.sessionId || ''}
            session={effectiveSession}
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

      {currentStep === 'waiting_for_results' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <WaitingForResultsScreen
            sessionId={effectiveSession?.sessionId || ''}
            session={effectiveSession}
            userId={clientSession?.userId || ''}
            isAdmin={isAdmin}
            realTimeConnected={realTimeConnected}
            realTimeLastUpdate={realTimeLastUpdate}
            realTimeReconnect={realTimeReconnect}
            onRefreshSession={handleRefreshSession}
          />
        </>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </>
  )
}