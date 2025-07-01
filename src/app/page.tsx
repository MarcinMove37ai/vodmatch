// src/app/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import MoviePreferencesScreen from '@/components/MoviePreferencesScreen'
import MovieTinderScreen from '@/components/MovieTinderScreen'
import MovieTinderResultsScreen from '@/components/MovieTinderResultsScreen'

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

interface MoviePick {
    movieId: string;
    vote: 'watched' | 'not_watched';
}
interface MovieResult {
  movieId: string;
  movieTitle: string;
  movieDescription: string;
  movieYear: string;
  movieGenres: string;
  movieImdbRating: string;
  movieImgUrl: string | null;
}

const CORRECT_PASSWORD = 'aicc$'

type AppStep = 'login' | 'platforms' | 'mode' | 'profile' | 'participant_profile' | 'qr_code' | 'waiting_room' | 'quiz' | 'waiting_for_results' | 'movie_preferences' | 'movie_tinder' | 'movie_tinder_waiting' | 'movie_tinder_results' | 'final_verdict';

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

const BATCH_SIZE = 10;

export default function VodMatchApp() {
  const { isMobile } = useDeviceDetection()
  const { session, clientSession, isLoading: sessionLoading, error: sessionError, createSession, updatePlatforms, updateMode, updateAdminProfile, updateParticipantProfile, submitQuizResults, clearSession, refreshSession, isAdmin, closeRegistration, startQuiz, releaseInsights, setMoviePreferences, startMovieTinder, submitTinderBatch, getParticipantStatus } = useSession()
  const [currentStep, setCurrentStep] = useState<AppStep>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  const [showContent, setShowContent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [movieSearchCompleted, setMovieSearchCompleted] = useState(false)

  const [tinderMovies, setTinderMovies] = useState<MovieResult[]>([])

  const shouldEnableRealTime = () => {
    if (!session?.sessionId || !isAuthenticated) return false
    const realTimeSteps: AppStep[] = ['participant_profile', 'qr_code', 'waiting_room', 'quiz', 'waiting_for_results', 'movie_preferences', 'movie_tinder', 'movie_tinder_waiting', 'movie_tinder_results', 'final_verdict']
    return realTimeSteps.includes(currentStep)
  }

  const { session: realTimeSession, isConnected: realTimeConnected, connectionState: realTimeConnectionState, isUsingRealTime, eventCount: realTimeEventCount, lastUpdate: realTimeLastUpdate, reconnect: realTimeReconnect } = useRealTimeSessionWithFallback(shouldEnableRealTime() ? session?.sessionId || '' : '', session, shouldEnableRealTime())
  const effectiveSession = realTimeSession || session

  // ✅ NOWY LISTENER: Auto-logout gdy admin zakończy sesję
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAutoLogout = (event: CustomEvent) => {
      const { sessionId: finishedSessionId, reason } = event.detail;
      console.log(`🏁 [App] Auto-logout triggered:`, { finishedSessionId, reason });

      // Jeśli to nasza sesja, wyloguj natychmiast
      if (clientSession?.sessionId === finishedSessionId) {
        console.log(`🏁 [App] Current session finished by admin - logging out immediately`);
        handleLogout(); // Wywołaj istniejącą funkcję logout
      }
    };

    window.addEventListener('auto-logout', handleAutoLogout as EventListener);

    return () => {
      window.removeEventListener('auto-logout', handleAutoLogout as EventListener);
    };
  }, [clientSession?.sessionId]);

  // ✅ OPTYMALIZACJA: Pobieranie filmów tylko gdy potrzebne
  useEffect(() => {
    const fetchTinderMovies = async () => {
      // Pobieraj filmy tylko dla movie_tinder (nie dla waiting/results)
      if (currentStep === 'movie_tinder' && effectiveSession?.sessionId) {
        setIsProcessing(true);
        try {
          const currentIndex = effectiveSession.movieTinderIndex || 0;
          const currentBatch = Math.floor(currentIndex / BATCH_SIZE) + 1;

          console.log(`🎬 Fetching movies for batch ${currentBatch} (index: ${currentIndex})`);

          const response = await fetch(`/api/session/${effectiveSession.sessionId}/movies?batch=${currentBatch}`);
          if (!response.ok) throw new Error('Failed to fetch movies');

          const data = await response.json();
          console.log(`✅ Received ${data.length} movies for batch ${currentBatch}`);

          setTinderMovies(data || []);
        } catch (error) {
          console.error("❌ Error fetching Tinder movies:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    };

    fetchTinderMovies();
  }, [currentStep, effectiveSession?.sessionId, effectiveSession?.movieTinderIndex]);

  const currentTinderIndex = effectiveSession?.movieTinderIndex || 0;
  const movieTinderBatchNumber = useMemo(() => Math.floor(currentTinderIndex / BATCH_SIZE) + 1, [currentTinderIndex]);
  const tinderStartIndexInBatch = useMemo(() => currentTinderIndex % BATCH_SIZE, [currentTinderIndex]);
  const tinderBatch = useMemo(() => {
    return tinderMovies;
  }, [tinderMovies]);

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

  // ✅ SSE Events dla Movie Tinder - obsługa wszystkich eventów
  useEffect(() => {
    if (!effectiveSession?.sessionId || !isAuthenticated) return

    const eventSource = new EventSource(`/api/session/${effectiveSession.sessionId}/events`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('📡 SSE Event:', data.type)

      if (data.type === 'movie_search_completed') {
        console.log('✅ Movie search completed!')
        setMovieSearchCompleted(true)
      }

      // Wszyscy skończyli głosowanie → stan zostanie zaktualizowany przez realTimeSession
      if (data.type === 'all_participants_finished_tinder_batch') {
        console.log('🏆 All participants finished tinder batch! State will be updated via realTimeSession...');
        // ✅ POPRAWKA: Usunięto updateCurrentStep - stan zostanie zaktualizowany automatycznie
        // przez hook useRealTimeSessionWithFallback, który jest autorytatywnym źródłem prawdy.
      }

      // Admin rozpoczął kolejną rundę → stan zostanie zaktualizowany przez realTimeSession
      if (data.type === 'next_tinder_round_started') {
        console.log('🎬 Next tinder round started! State will be updated via realTimeSession...');
        // ✅ POPRAWKA: Usunięto updateCurrentStep - stan zostanie zaktualizowany automatycznie
        // przez hook useRealTimeSessionWithFallback, który jest autorytatywnym źródłem prawdy.
      }

      // Finalny werdykt został osiągnięty
      if (data.type === 'final_verdict_reached') {
        console.log('🏆 Final verdict has been reached!', data.payload);
        // Aktualizacja sesji przez `realTimeSession` powinna automatycznie zmienić krok na 'final_verdict'.
      }
    }

    eventSource.onerror = (error) => {
      console.log('❌ SSE Error:', error)
      // ✅ DODANE: Auto-reconnect po błędzie
      setTimeout(() => {
        console.log('🔄 Attempting SSE reconnect...')
        // useEffect się zrestartuje automatycznie
      }, 2000)
    }

    return () => {
      console.log('🔌 Closing SSE connection for session:', effectiveSession.sessionId)
      eventSource.close()
    }
  }, [effectiveSession?.sessionId, isAuthenticated])

  useEffect(() => {
    if (effectiveSession?.movie_search_results || effectiveSession?.llm_movies) {
      setMovieSearchCompleted(true)
    } else if (effectiveSession?.movie_preferences) {
      setMovieSearchCompleted(false)
    }
  }, [effectiveSession?.movie_search_results, effectiveSession?.llm_movies, effectiveSession?.movie_preferences])

  const determineStepFromSession = (session: any, isAdmin: boolean, userId: string): AppStep => {
    // Sprawdź czy jesteśmy w Movie Tinder workflow (w tym final_verdict)
    if (session.currentStep === 'movie_tinder' || session.currentStep === 'movie_tinder_waiting' || session.currentStep === 'movie_tinder_results' || session.currentStep === 'final_verdict') {
      return session.currentStep;
    }

    // Reszta logiki bez zmian...
    if (session.status === 'results' || session.status === 'insights_ready' || session.status === 'insights_released') return 'waiting_for_results'
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
    // =================================================================================
    // START: DEDYKOWANA LOGIKA WALIDACJI DLA MOVIE TINDER (włącznie z final_verdict)
    // Ta sekcja obsługuje wyłącznie stany Tindera, aby naprawić pętlę
    // i nie naruszać logiki synchronizacji uczestników.
    // =================================================================================
    const isTinderFlow = ['movie_tinder', 'movie_tinder_waiting', 'movie_tinder_results', 'final_verdict'].includes(step) ||
                         ['movie_tinder', 'movie_tinder_waiting', 'movie_tinder_results', 'final_verdict'].includes(session.currentStep);

    if (isTinderFlow) {
      // 1. Jeśli serwer potwierdził finalny werdykt, jest to stan najwyższego priorytetu.
      if (session.currentStep === 'final_verdict') {
        return 'final_verdict';
      }
      // 2. Jeśli serwer potwierdził wyniki, jest to stan ostateczny i ma wysoki priorytet.
      if (session.currentStep === 'movie_tinder_results') {
        return 'movie_tinder_results';
      }
      // 3. Jeśli interfejs lokalnie jest już w stanie oczekiwania, pozwól mu w nim pozostać.
      //    To kluczowa poprawka, która zapobiega cofnięciu stanu przez minimalnie opóźnioną odpowiedź serwera.
      if (step === 'movie_tinder_waiting') {
        return 'movie_tinder_waiting';
      }
      // 4. Dla pozostałych przypadków w Tinderze (np. start nowej rundy), ufaj stanowi z serwera.
      if (session.currentStep === 'movie_tinder') {
        return 'movie_tinder';
      }
      // 5. Fallback - jeśli żaden warunek nie jest spełniony, zachowaj obecny krok.
      return step;
    }
    // =================================================================================
    // KONIEC: DEDYKOWANA LOGIKA WALIDACJI DLA MOVIE TINDER
    // Poniżej znajduje się nienaruszona logika dla reszty aplikacji.
    // =================================================================================

    if (step === 'movie_preferences') {
        return 'movie_preferences';
    }
    if (session.status === 'results' || session.status === 'insights_ready' || session.status === 'insights_released') return 'waiting_for_results'
    if (step === 'waiting_for_results') {
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
      console.log(`🔄 Step transition: ${currentStep} → ${newStep}`);
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

  const handleAdminProfileContinue = async (profile: SocialProfile) => {
    const updatedSession = await updateAdminProfile(profile);
    if (updatedSession) {
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

  const handleMoviePreferences = async (preferences: {
    excludedGenres: string[],
    minImdbRating?: number,
    maxImdbRating?: number,
    onlyUnrated?: boolean,
    minYear?: number,
    maxYear?: number
  }) => {
    setIsProcessing(true)
    try {
      const success = await setMoviePreferences(preferences)
      if (success) {
        await refreshSession()
        updateCurrentStep('waiting_for_results')
      } else {
        alert('Failed to set movie preferences')
      }
    } catch (error) {
      console.error('❌ Error setting movie preferences:', error)
      alert('Failed to set movie preferences')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSetMoviePreferences = () => {
    updateCurrentStep('movie_preferences')
  }

  const handleFindMovies = async () => {
    if (!isAdmin) return;
    await startMovieTinder();
  };

  const handleQuizComplete = async (answers: QuizAnswer[]): Promise<void> => {
    if (!clientSession) return;
    updateCurrentStep('waiting_for_results');
    (async () => {
      try {
        const success = await submitQuizResults(answers);
        if (!success) {
          console.error('❌ Failed to submit quiz results in background.');
        }
      } catch (error) {
        console.error('❌ Error submitting quiz results in background:', error);
      }
    })();
  };

  const handleSubmitTinderBatch = async (batchNumber: number, picks: MoviePick[]): Promise<boolean> => {
      if (!submitTinderBatch) return false;

      try {
        const success = await submitTinderBatch(batchNumber, picks);

        if (success) {
          console.log(`✅ Batch ${batchNumber} submitted successfully, transitioning to waiting...`);
          // Po udanym wysłaniu automatycznie przejdź do ekranu oczekiwania
          updateCurrentStep('movie_tinder_waiting');
        }

        return success;
      } catch (error) {
        console.error('❌ Error submitting tinder batch:', error);
        return false;
      }
  }

  const handleFinalVoteSubmission = async (movieId: string, timeTaken: number) => {
    if (!clientSession) return;
    try {
      const response = await fetch(`/api/session/${clientSession.sessionId}/final-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clientSession.userId, movieId, timeTaken }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit final vote');
      }
    } catch (error) {
      console.error('❌ Error submitting final vote:', error);
      alert('There was an error submitting your final vote. Please try again.');
    }
  };

  const handleStartNextTinderRound = async () => {
    if (!isAdmin || !clientSession) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/session/${effectiveSession?.sessionId}/start-next-tinder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clientSession.userId })
      });

      if (!response.ok) {
        throw new Error('Failed to start next tinder round');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      console.log('✅ Next tinder round started successfully');
      // SSE automatycznie przeniesie nas do movie_tinder
    } catch (error) {
      console.error('❌ Error starting next tinder round:', error);
      alert('Failed to start next round. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMobile) return <DesktopBlocker />;

  if (sessionLoading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white ml-4">Loading session...</p>
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
            releaseInsights={releaseInsights}
            onSetMoviePreferences={handleSetMoviePreferences}
            movieSearchCompleted={movieSearchCompleted}
            onFindMovies={handleFindMovies}
          />
        </>
      )}

      {currentStep === 'movie_preferences' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <MoviePreferencesScreen onContinue={handleMoviePreferences} />
        </>
      )}

      {currentStep === 'movie_tinder' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <MovieTinderScreen
            sessionId={effectiveSession?.sessionId || ''}
            movieBatch={tinderBatch}
            batchNumber={movieTinderBatchNumber}
            startIndexInBatch={tinderStartIndexInBatch}
            onSubmitBatch={handleSubmitTinderBatch}
            onFinish={() => {
              console.log('🎬 MovieTinderScreen onFinish called - batch completed');
              // onFinish jest już obsługiwane w handleSubmitTinderBatch
            }}
          />
        </>
      )}

      {currentStep === 'movie_tinder_waiting' && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex flex-col items-center justify-center text-white space-y-4 p-4 text-center relative overflow-hidden">
            <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-purple-600/10 rounded-full animate-pulse blur-3xl"></div>
            <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-emerald-600/20 to-green-600/10 rounded-full animate-pulse blur-3xl animation-delay-4000"></div>

            <div className="z-10 space-y-6">
              <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto"></div>
              <div className="space-y-2">
                <h1 className="text-2xl font-light text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300">
                  Voting Complete!
                </h1>
                <p className="text-lg text-gray-300">Waiting for other participants to finish...</p>
                <p className="text-sm text-gray-500">Results will appear automatically when everyone is done.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {(currentStep === 'movie_tinder_results' || currentStep === 'final_verdict') && (
        <>
          <LogoutButton onLogout={handleLogout} />
          <MovieTinderResultsScreen
            sessionId={effectiveSession?.sessionId || ''}
            userId={clientSession?.userId || ''}
            batchNumber={movieTinderBatchNumber}
            isAdmin={isAdmin}
            totalMovies={effectiveSession?.totalMoviesCount || 30}
            participantsCount={effectiveSession?.profiles?.length || 0}
            onFinishSession={() => {}}
            onStartNextRound={handleStartNextTinderRound}
            onFinalVote={handleFinalVoteSubmission}
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