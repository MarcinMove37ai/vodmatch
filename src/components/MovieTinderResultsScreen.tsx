// src/components/MovieTinderResultsScreen.tsx - FIXED VERSION WITH POLLING
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PartyPopper, Frown, RotateCcw, Trophy, CheckCircle } from 'lucide-react'

// --- Definicje typów ---
interface MovieResult {
  movieId: string;
  movieTitle: string;
  movieImgUrl: string | null;
}

type ViewState = 'loading' | 'initial_results' | 'final_voting' | 'waiting_for_verdict' | 'showing_verdict' | 'cleanup';

interface MovieTinderResultsScreenProps {
  sessionId: string;
  userId: string;
  batchNumber: number;
  isAdmin: boolean;
  totalMovies: number;
  participantsCount: number;
  onFinishSession: () => void;
  onStartNextRound: () => void;
  onFinalVote: (movieId: string, timeTaken: number) => void;
}

export default function MovieTinderResultsScreen({
  sessionId,
  userId,
  batchNumber,
  isAdmin,
  totalMovies,
  participantsCount,
  onFinishSession,
  onStartNextRound,
  onFinalVote,
}: MovieTinderResultsScreenProps) {
  const [matchedMovies, setMatchedMovies] = useState<MovieResult[]>([]);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [finalWinner, setFinalWinner] = useState<MovieResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 SZYBKI FIX: Wyłączamy useRealTimeSession - używamy polling
  // const { session: realtimeSession } = useRealTimeSession(sessionId); // USUNIĘTE
  const realtimeSession = null; // WYŁĄCZONE SSE

  // 🆕 SESSION CLEANUP LISTENERS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSessionClearing = (event: CustomEvent) => {
      const { oldSessionId, reason } = event.detail;
      console.log(`🧹 [MovieTinderResults] Received session-clearing event for ${oldSessionId}, reason: ${reason}`);

      if (sessionId === oldSessionId) {
        console.log(`🗑️ [MovieTinderResults] Cleaning up component for old session: ${sessionId}`);
        setViewState('cleanup');
        setError('Session has been replaced');
        setMatchedMovies([]);
        setFinalWinner(null);
      }
    };

    const handleSessionCleared = (event: CustomEvent) => {
      console.log(`🗑️ [MovieTinderResults] Received session-cleared event`);
    };

    window.addEventListener('session-clearing', handleSessionClearing as EventListener);
    window.addEventListener('session-cleared', handleSessionCleared as EventListener);

    return () => {
      window.removeEventListener('session-clearing', handleSessionClearing as EventListener);
      window.removeEventListener('session-cleared', handleSessionCleared as EventListener);
    };
  }, [sessionId]);

  // Funkcja pomocnicza do znalezienia zwycięzcy we wszystkich partiach
  const findWinnerInAllBatches = async (winnerId: string): Promise<MovieResult | undefined> => {
    console.log('🔍 Searching for winner in all batches...');
    const maxBatches = Math.ceil(totalMovies / 10);

    for (let batch = 1; batch <= maxBatches; batch++) {
      try {
        const resultsResponse = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batch}`);
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          const movies = resultsData.matchedMovies || [];
          const winner = movies.find((m: MovieResult) => m.movieId === winnerId);
          if (winner) {
            console.log(`🏆 Winner found in batch ${batch}:`, winner);
            return winner;
          }
        }
      } catch (error) {
        console.error(`❌ Error fetching batch ${batch}:`, error);
      }
    }
    return undefined;
  };

  // 🚀 SZYBKI FIX: POLLING zamiast SSE dla final verdict
  useEffect(() => {
    if (viewState === 'waiting_for_verdict') {
      console.log('🔄 [MovieTinderResults] Starting polling for final verdict...');

      const pollForVerdict = async () => {
        try {
          const response = await fetch(`/api/session/${sessionId}`);
          if (response.ok) {
            const data = await response.json();

            console.log('🔍 [POLLING] Session data:', {
              currentStep: data.currentStep,
              finalWinnerMovieId: data.finalWinnerMovieId,
              status: data.status
            });

            if (data.currentStep === 'final_verdict' && data.finalWinnerMovieId) {
              console.log('🏆 [POLLING] Final verdict found!', data.finalWinnerMovieId);

              let winner = matchedMovies.find(m => m.movieId === data.finalWinnerMovieId);
              if (!winner) {
                console.log('🔍 [POLLING] Winner not in current batch, searching all batches...');
                winner = await findWinnerInAllBatches(data.finalWinnerMovieId);
              }

              if (winner) {
                console.log('✅ [POLLING] Final winner found:', winner);
                setFinalWinner(winner);
                setViewState('showing_verdict');
              } else {
                console.error('❌ [POLLING] Could not find winner details');
              }
            }
          }
        } catch (error) {
          console.error('❌ [POLLING] Error:', error);
        }
      };

      // Poll co 2 sekundy gdy czekamy na verdict
      const interval = setInterval(pollForVerdict, 2000);

      // Pierwsze sprawdzenie od razu
      pollForVerdict();

      return () => {
        console.log('🛑 [MovieTinderResults] Stopping final verdict polling');
        clearInterval(interval);
      };
    }
  }, [viewState, sessionId, matchedMovies]);

  // Pierwotny efekt do pobrania wyników
  useEffect(() => {
    if (viewState === 'cleanup') {
      console.log('🛑 [MovieTinderResults] Skipping fetch - component in cleanup state');
      return;
    }

    const fetchResults = async () => {
      console.log('🔄 [MovieTinderResults] Fetching results for batch:', batchNumber);
      setViewState('loading');
      setError(null);

      try {
        // Sprawdź stan sesji
        const sessionResponse = await fetch(`/api/session/${sessionId}`);
        if (!sessionResponse.ok) {
          if (sessionResponse.status === 404) {
            throw new Error('Session not found or expired');
          }
          throw new Error(`Failed to fetch session: ${sessionResponse.status}`);
        }

        const sessionData = await sessionResponse.json();
        console.log('📊 [MovieTinderResults] Session data:', {
          currentStep: sessionData.currentStep,
          finalWinnerMovieId: sessionData.finalWinnerMovieId,
          status: sessionData.status
        });

        // Sprawdź czy final verdict już istnieje
        if (sessionData.finalWinnerMovieId || sessionData.currentStep === 'final_verdict') {
          console.log('🏆 [MovieTinderResults] Session indicates final verdict reached');

          const resultsResponse = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batchNumber}`);
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json();
            const movies: MovieResult[] = resultsData.matchedMovies || [];
            setMatchedMovies(movies);

            if (sessionData.finalWinnerMovieId) {
              let winner = movies.find(m => m.movieId === sessionData.finalWinnerMovieId);
              if (!winner) {
                winner = await findWinnerInAllBatches(sessionData.finalWinnerMovieId);
              }
              if (winner) {
                setFinalWinner(winner);
                setViewState('showing_verdict');
                return;
              } else {
                console.error('❌ Could not find winner in any batch');
              }
            }
          }
        }

        // Pobierz wyniki dla aktualnej partii
        const response = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batchNumber}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Session not found or expired');
          }
          throw new Error('Failed to fetch results');
        }

        const data = await response.json();
        if (data.success) {
          const movies: MovieResult[] = data.matchedMovies || [];
          setMatchedMovies(movies);

          console.log(`🎬 [MovieTinderResults] Found ${movies.length} matched movies for batch ${batchNumber}`);

          if (movies.length > 1) {
            console.log('🗳️ [MovieTinderResults] Multiple matches - starting final voting');
            setViewState('final_voting');
            setStartTime(Date.now());
          } else if (movies.length === 1) {
            console.log('🏆 [MovieTinderResults] Single match - showing as winner');
            setViewState('initial_results');
          } else {
            console.log('😞 [MovieTinderResults] No matches found');
            setViewState('initial_results');
          }
        } else {
          throw new Error(data.error || 'API returned an error');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ [MovieTinderResults] Error fetching results:', errorMessage);
        setError(errorMessage);
        setViewState('initial_results');
      }
    };

    fetchResults();
  }, [sessionId, batchNumber, totalMovies]);

  const handleVoteClick = async () => {
    if (!selectedMovieId) return;

    console.log('🗳️ [MovieTinderResults] Submitting final vote:', {
      movieId: selectedMovieId,
      timeTaken: Date.now() - startTime
    });

    setIsSubmitting(true);
    const timeTaken = Date.now() - startTime;

    try {
      await onFinalVote(selectedMovieId, timeTaken);
      setViewState('waiting_for_verdict');
      console.log('✅ [MovieTinderResults] Final vote submitted, waiting for verdict...');
    } catch (error) {
      console.error('❌ [MovieTinderResults] Failed to submit final vote:', error);
      setIsSubmitting(false);
    }
  };

  // ✅ POPRAWIONA FUNKCJA: Instant finish bez niepotrzebnego loading state
  const handleFinishSession = async () => {
    console.log('🏁 [MovieTinderResults] Admin finishing session - broadcasting to all participants');

    try {
      // Wyślij broadcast że sesja się kończy
      const response = await fetch(`/api/session/${sessionId}/broadcast-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to broadcast session finish');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      console.log('✅ [MovieTinderResults] Session finish broadcasted successfully');
      // Po udanym broadcast, użytkownicy zostają automatycznie wylogowani przez SSE

    } catch (error) {
      console.error('❌ [MovieTinderResults] Failed to finish session:', error);
      alert('Failed to finish session. Please try again.');
    }
  };

  // 🆕 CLEANUP STATE RENDER
  if (viewState === 'cleanup') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-gray-400/30 border-t-gray-400 rounded-full animate-spin mx-auto"></div>
          <h2 className="text-xl font-medium text-gray-300">Session Updated</h2>
          <p className="text-gray-400">Loading new session...</p>
        </div>
      </div>
    );
  }

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
        <p className="mt-4 text-lg">Calculating results...</p>
      </div>
    );
  }

  if (viewState === 'final_voting' || viewState === 'waiting_for_verdict') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-900 flex flex-col items-center justify-center text-white p-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-4">
            <Trophy className="w-16 h-16 mx-auto text-yellow-400" />
            <h1 className="text-3xl font-bold">Final Showdown!</h1>
            <p className="text-lg text-gray-300 font-light">
              {viewState === 'waiting_for_verdict' ? 'Thanks for voting! Waiting for the others...' : 'You all agreed on these. Pick one definitive winner!'}
            </p>

            <div className={`grid grid-cols-2 md:grid-cols-${Math.min(matchedMovies.length, 4)} gap-4 pt-4`}>
              {matchedMovies.map(movie => (
                <button
                  key={movie.movieId}
                  disabled={viewState === 'waiting_for_verdict'}
                  onClick={() => setSelectedMovieId(movie.movieId)}
                  className={`bg-gray-800/50 rounded-lg overflow-hidden group transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 border-2 ${selectedMovieId === movie.movieId ? 'border-blue-500 scale-105' : 'border-transparent hover:border-gray-600'}`}
                >
                  <img src={movie.movieImgUrl || ''} alt={movie.movieTitle} className="w-full h-auto aspect-[2/3] object-cover" />
                  <p className="p-2 text-xs font-medium truncate transition-colors group-hover:text-blue-400">{movie.movieTitle}</p>
                </button>
              ))}
            </div>
             {viewState === 'waiting_for_verdict' && (
               <div className="flex justify-center pt-8">
                  <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                  <p className="ml-3 text-gray-400">Polling for final verdict...</p>
               </div>
            )}
            {viewState === 'final_voting' && selectedMovieId && (
                <div className="pt-6">
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        disabled={isSubmitting}
                        onClick={handleVoteClick}
                        className="px-10 py-4 bg-green-600 hover:bg-green-700 transition-colors rounded-lg font-bold text-lg flex items-center justify-center space-x-2 w-full max-w-xs mx-auto disabled:bg-gray-500"
                    >
                        <CheckCircle className="w-6 h-6" />
                        <span>Accept Choice</span>
                    </motion.button>
                </div>
            )}
        </motion.div>
      </div>
    );
  }

  if (viewState === 'showing_verdict' && finalWinner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-gray-900 flex flex-col items-center justify-center text-white p-4 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center justify-center text-green-400 space-y-3">
            <PartyPopper className="w-20 h-20" />
            <h1 className="text-4xl font-bold">And the Winner Is...</h1>
          </div>
          <div className="bg-gray-800/50 rounded-xl overflow-hidden max-w-xs mx-auto shadow-2xl shadow-black/50 border border-green-500/20">
            <img src={finalWinner.movieImgUrl || ''} alt={finalWinner.movieTitle} className="w-full h-auto aspect-[2/3] object-cover" />
            <div className="p-4">
              <h2 className="text-xl font-bold text-center">{finalWinner.movieTitle}</h2>
            </div>
          </div>
          {isAdmin && (
            <div className="pt-4">
              <button
                onClick={handleFinishSession}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 transition-colors rounded-lg font-bold text-lg flex items-center justify-center space-x-2 mx-auto"
              >
                <span>Finish Session</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Reszta logiki dla initial_results
  const isFinalBatch = batchNumber >= Math.ceil(totalMovies / 10);

  if (matchedMovies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md w-full">
          <Frown className="w-24 h-24 mx-auto text-gray-400" />
          <h1 className="text-3xl font-bold">No Matches Found!</h1>
          <p className="text-gray-400">
            {error ? `Error: ${error}` : 'You had different tastes this round. Let\'s try again!'}
          </p>
          {isAdmin && (
            <div className="space-y-4">
              {!isFinalBatch ? (
                <button onClick={onStartNextRound} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg font-bold text-lg flex items-center justify-center space-x-2 w-full">
                  <RotateCcw className="w-5 h-5" />
                  <span>Try Next Batch</span>
                </button>
              ) : (
                <button
                  onClick={handleFinishSession}
                  className="px-8 py-4 bg-gray-600 hover:bg-gray-700 transition-colors rounded-lg font-bold text-lg w-full"
                >
                  End Session
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single match case - Perfect match = finish session
  if (matchedMovies.length === 1) {
    const singleMatch = matchedMovies[0];
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-gray-900 flex flex-col items-center justify-center text-white p-4 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center justify-center text-green-400 space-y-3">
            <PartyPopper className="w-20 h-20" />
            <h1 className="text-4xl font-bold">Perfect Match!</h1>
            <p className="text-lg text-gray-300">You all agreed on this one!</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl overflow-hidden max-w-xs mx-auto shadow-2xl shadow-black/50 border border-green-500/20">
            <img src={singleMatch.movieImgUrl || ''} alt={singleMatch.movieTitle} className="w-full h-auto aspect-[2/3] object-cover" />
            <div className="p-4">
              <h2 className="text-xl font-bold text-center">{singleMatch.movieTitle}</h2>
            </div>
          </div>
          {isAdmin && (
            <div className="pt-4">
              {/* 🎯 FIXED: Perfect match = always finish session */}
              <button
                onClick={handleFinishSession}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 transition-colors rounded-lg font-bold text-lg flex items-center justify-center space-x-2 mx-auto"
              >
                <span>Finish Session</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>An unexpected error occurred.</p>
    </div>
  );
}