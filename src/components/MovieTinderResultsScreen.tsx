// src/components/MovieTinderResultsScreen.tsx - ULTRA STABLE VERSION
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { PartyPopper, Frown, RotateCcw, Trophy, Check, Clock, BrainCircuit, Share2, Instagram, Facebook, Twitter, Heart, Code, Zap } from 'lucide-react'

// --- Definicje typów ---
interface MovieResult {
  movieId: string;
  movieTitle: string;
  movieImgUrl: string | null;
}

// ✅ DODANY NOWY STAN
type ViewState = 'loading' | 'initial_results' | 'final_voting' | 'waiting_for_verdict' | 'pre_verdict_message' | 'showing_verdict' | 'thank_you' | 'cleanup';

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
  const [countdown, setCountdown] = useState(30); // 30 sekund countdown

  // ✅ STABILNOŚĆ: Refs dla kontroli lifecycle
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const lastFetchRef = useRef<string>('');

  // ✅ STABILNOŚĆ: Memoized values aby uniknąć re-renders
  const isFinalBatch = useMemo(() =>
    batchNumber >= Math.ceil(totalMovies / 10),
    [batchNumber, totalMovies]
  );

  // ✅ STABILNOŚĆ: Stable callbacks z useCallback
  const safeSetState = useCallback((setter: () => void) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('🛑 Polling cleared');
    }
  }, []);

  // ✅ STABILNOŚĆ: Master cleanup function
  const cleanup = useCallback(() => {
    mountedRef.current = false;
    clearPolling();
    console.log('🧹 Component cleanup executed');
  }, [clearPolling]);

  // ✅ STABILNOŚĆ: Master mount effect - tylko raz
  useEffect(() => {
    mountedRef.current = true;
    console.log('🚀 MovieTinderResults mounted, viewState:', viewState);

    return cleanup;
  }, []); // Empty deps - tylko przy mount/unmount

  // ✅ DEBUG: Monitor viewState changes
  useEffect(() => {
    console.log('🔄 [MovieTinderResults] ViewState changed to:', viewState);
  }, [viewState]);

  // ✅ STABILNOŚĆ: Session cleanup listeners - stabilne deps
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSessionClearing = (event: CustomEvent) => {
      const { oldSessionId, reason } = event.detail;
      console.log(`🧹 Session clearing: ${oldSessionId}, reason: ${reason}`);

      if (sessionId === oldSessionId && mountedRef.current) {
        safeSetState(() => {
          setViewState('cleanup');
          setError('Session has been replaced');
          setMatchedMovies([]);
          setFinalWinner(null);
        });
      }
    };

    const handleSessionCleared = () => {
      console.log('🗑️ Session cleared event received');
    };

    window.addEventListener('session-clearing', handleSessionClearing as EventListener);
    window.addEventListener('session-cleared', handleSessionCleared as EventListener);

    return () => {
      window.removeEventListener('session-clearing', handleSessionClearing as EventListener);
      window.removeEventListener('session-cleared', handleSessionCleared as EventListener);
    };
  }, [sessionId, safeSetState]); // Stabilne deps

  // ✅ STABILNOŚĆ: Winner search function - memoized
  const findWinnerInAllBatches = useCallback(async (winnerId: string): Promise<MovieResult | undefined> => {
    if (!mountedRef.current) return undefined;

    console.log('🔍 Searching for winner in all batches...');
    const maxBatches = Math.ceil(totalMovies / 10);

    for (let batch = 1; batch <= maxBatches; batch++) {
      if (!mountedRef.current) return undefined;

      try {
        const resultsResponse = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batch}`);
        if (!resultsResponse.ok || !mountedRef.current) continue;

        const resultsData = await resultsResponse.json();
        const movies = resultsData.matchedMovies || [];
        const winner = movies.find((m: MovieResult) => m.movieId === winnerId);

        if (winner && mountedRef.current) {
          console.log(`🏆 Winner found in batch ${batch}:`, winner);
          return winner;
        }
      } catch (error) {
        console.error(`❌ Error fetching batch ${batch}:`, error);
      }
    }
    return undefined;
  }, [totalMovies, sessionId]);

  // ✅ STABILNOŚĆ: Polling function - fully controlled
  const pollForVerdict = useCallback(async () => {
    if (!mountedRef.current) {
      clearPolling();
      return;
    }

    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (!response.ok || !mountedRef.current) return;

      const data = await response.json();

      if (!mountedRef.current) return;

      console.log('🔍 [POLLING] Session data:', {
        currentStep: data.currentStep,
        finalWinnerMovieId: data.finalWinnerMovieId
      });

      if (data.currentStep === 'final_verdict' && data.finalWinnerMovieId) {
        console.log('🏆 [POLLING] Final verdict found!', data.finalWinnerMovieId);

        let winner = matchedMovies.find(m => m.movieId === data.finalWinnerMovieId);
        if (!winner) {
          winner = await findWinnerInAllBatches(data.finalWinnerMovieId);
        }

        if (winner && mountedRef.current) {
          clearPolling();
          safeSetState(() => {
            setFinalWinner(winner!);
            // ✅ KLUCZOWA ZMIANA: Przejdź do komunikatu przed werdyktem
            setViewState('pre_verdict_message');
          });
        }
      }
    } catch (error) {
      console.error('❌ [POLLING] Error:', error);
    }
  }, [sessionId, matchedMovies, findWinnerInAllBatches, clearPolling, safeSetState]);

  // ✅ STABILNOŚĆ: Polling effect - controlled start/stop
  useEffect(() => {
    if (viewState === 'waiting_for_verdict') {
      console.log('🔄 Starting verdict polling');

      // Clear any existing polling first
      clearPolling();

      // Start new polling
      pollingIntervalRef.current = setInterval(pollForVerdict, 2000);

      // Immediate check
      pollForVerdict();

      return () => {
        console.log('🛑 Stopping verdict polling');
        clearPolling();
      };
    }
  }, [viewState, pollForVerdict, clearPolling]); // Stable deps

  // ✅ STABILNOŚĆ: Main fetch effect - controlled execution
  useEffect(() => {
    // Prevent multiple simultaneous fetches
    const fetchKey = `${sessionId}-${batchNumber}`;
    if (lastFetchRef.current === fetchKey || viewState === 'cleanup' || hasInitializedRef.current) {
      return;
    }

    lastFetchRef.current = fetchKey;
    hasInitializedRef.current = true;

    const fetchResults = async () => {
      if (!mountedRef.current) return;

      console.log('🔄 Fetching results for batch:', batchNumber);

      safeSetState(() => {
        setViewState('loading');
        setError(null);
      });

      try {
        // Session check
        const sessionResponse = await fetch(`/api/session/${sessionId}`);
        if (!sessionResponse.ok || !mountedRef.current) {
          throw new Error(`Session fetch failed: ${sessionResponse.status}`);
        }

        const sessionData = await sessionResponse.json();
        if (!mountedRef.current) return;

        console.log('📊 Session data:', {
          currentStep: sessionData.currentStep,
          finalWinnerMovieId: sessionData.finalWinnerMovieId
        });

        // Check for existing final verdict
        if (sessionData.finalWinnerMovieId || sessionData.currentStep === 'final_verdict') {
          console.log('🏆 Session indicates final verdict reached');

          const resultsResponse = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batchNumber}`);
          if (resultsResponse.ok && mountedRef.current) {
            const resultsData = await resultsResponse.json();
            const movies: MovieResult[] = resultsData.matchedMovies || [];

            safeSetState(() => setMatchedMovies(movies));

            if (sessionData.finalWinnerMovieId) {
              let winner = movies.find(m => m.movieId === sessionData.finalWinnerMovieId);
              if (!winner) {
                winner = await findWinnerInAllBatches(sessionData.finalWinnerMovieId);
              }
              if (winner && mountedRef.current) {
                safeSetState(() => {
                  setFinalWinner(winner!);
                  // ✅ KLUCZOWA ZMIANA: Najpierw komunikat, potem werdykt
                  setViewState('pre_verdict_message');
                });
                return;
              }
            }
          }
        }

        // Fetch batch results
        const response = await fetch(`/api/session/${sessionId}/tinder-results?batch=${batchNumber}`);
        if (!response.ok || !mountedRef.current) {
          throw new Error(`Results fetch failed: ${response.status}`);
        }

        const data = await response.json();
        if (!mountedRef.current) return;

        if (data.success) {
          const movies: MovieResult[] = data.matchedMovies || [];

          safeSetState(() => {
            setMatchedMovies(movies);

            if (movies.length > 1) {
              setViewState('final_voting');
              setStartTime(Date.now());
            } else {
              setViewState('initial_results');
            }
          });

          console.log(`🎬 Found ${movies.length} matched movies for batch ${batchNumber}`);
        } else {
          throw new Error(data.error || 'API returned an error');
        }
      } catch (err) {
        if (!mountedRef.current) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Error fetching results:', errorMessage);

        safeSetState(() => {
          setError(errorMessage);
          setViewState('initial_results');
        });
      }
    };

    fetchResults();
  }, []); // Empty deps - only run once on mount

  // ✅ STABILNOŚĆ: Click handlers - all prevented
  const handleMovieSelect = useCallback((movieId: string) => {
    if (!mountedRef.current) return;

    console.log('🎯 Movie selected:', movieId);
    safeSetState(() => setSelectedMovieId(movieId));
  }, [safeSetState]);

  const handleVoteClick = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!selectedMovieId || !mountedRef.current || isSubmitting) return;

    console.log('🗳️ Submitting final vote:', selectedMovieId);

    safeSetState(() => setIsSubmitting(true));
    const timeTaken = Date.now() - startTime;

    try {
      await onFinalVote(selectedMovieId, timeTaken);
      if (mountedRef.current) {
        safeSetState(() => setViewState('waiting_for_verdict'));
        console.log('✅ Final vote submitted');
      }
    } catch (error) {
      console.error('❌ Failed to submit final vote:', error);
      if (mountedRef.current) {
        safeSetState(() => setIsSubmitting(false));
      }
    }
  }, [selectedMovieId, isSubmitting, startTime, onFinalVote, safeSetState]);

  const handleFinishSession = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log('🏁 Admin finishing session');

    try {
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

      console.log('✅ Session finish broadcasted successfully');

      // ✅ FIX: Przejście do stanu 'thank_you' po pomyślnym zakończeniu sesji
      if (mountedRef.current) {
        safeSetState(() => setViewState('thank_you'));
      }

    } catch (error) {
      console.error('❌ Failed to finish session:', error);
      alert('Failed to finish session. Please try again.');
    }
  }, [sessionId, userId, safeSetState]); // Dodano safeSetState do zależności

  const handleStartNextRound = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onStartNextRound();
  }, [onStartNextRound]);

  // ✅ FIX: Dodana brakująca funkcja handleFinalFinish
  const handleFinalFinish = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('🚪 Final finish called, invoking onFinishSession');
    if (mountedRef.current) {
      onFinishSession(); // Wywołaj prop, aby wylogować/przekierować
    }
  }, [onFinishSession]);

  // ✅ NOWA FUNKCJA: Przejście z komunikatu do werdyktu
  const handleProceedToVerdict = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('🎬 Proceeding to show verdict');
    if (mountedRef.current) {
      safeSetState(() => {
        setCountdown(30); // Reset countdown
        setViewState('showing_verdict');
      });
    }
  }, [safeSetState]);

  const handleSocialShare = useCallback((platform: 'instagram' | 'facebook' | 'twitter') => {
    const shareText = `Just had an amazing movie night using MovieTinder! 🎬✨ Found the perfect film with friends. #MovieTinder #MovieNight`;
    const shareUrl = window.location.origin;

    switch (platform) {
      case 'instagram':
        // Instagram doesn't support direct URL sharing, so we copy to clipboard
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        alert('Text copied to clipboard! Paste it in your Instagram story or post.');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
    }
  }, []);

  // ✅ STABILNOŚĆ: Static Background Wrapper
  const BackgroundWrapper = useMemo(() => ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  ), []);

  // ✅ STABILNOŚĆ: Static animation variants
  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }), []);

  const itemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }), []);

  // ✅ AUTO-TRANSITION EFFECT dla pre_verdict_message
  useEffect(() => {
    if (viewState === 'pre_verdict_message') {
      setCountdown(30); // Reset countdown

      const timer = setTimeout(() => {
        if (mountedRef.current && viewState === 'pre_verdict_message') {
          handleProceedToVerdict();
        }
      }, 30000); // 30 sekund auto-przejście

      return () => clearTimeout(timer);
    }
  }, [viewState, handleProceedToVerdict]);

  // ✅ COUNTDOWN EFFECT
  useEffect(() => {
    if (viewState === 'pre_verdict_message' && countdown > 0) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setCountdown(prev => prev - 1);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [viewState, countdown]);

  // ✅ NOWY STAN: PRE VERDICT MESSAGE
  if (viewState === 'pre_verdict_message') {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-6xl w-full space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Compact Header */}
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="flex items-center justify-center space-x-3">
              <motion.img
                src="/logo.png"
                alt="VODmatch Logo"
                className="w-12 h-12 opacity-90"
                whileHover={{ scale: 1.05 }}
              />
              <div>
                <h1 className="text-2xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                  VODmatch
                </h1>
                <p className="text-gray-400 text-xs font-light">Stream smarter. Decide faster.</p>
              </div>
            </div>
             {/* Gradient Divider Line */}
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-blue-500/60 via-purple-500/60 to-transparent mx-auto"></div>
          </motion.div>

          {/* Main Thank You Message - Compact */}
          <motion.div variants={itemVariants} className="text-center space-y-2">
            <h2 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Thank You for Using VODmatch!
            </h2>
            <p className="text-gray-300 font-light text-base max-w-2xl mx-auto">
              I hope my app helped you find the perfect movie match!
            </p>
          </motion.div>

          {/* Author Info - Full Width */}
          <motion.div variants={itemVariants}>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/40 backdrop-blur-sm">
              <div className="flex items-stretch space-x-4 h-full">
                {/* Left 50% - Photo + Info */}
                <div className="flex-1 flex flex-col items-center space-y-2">
                  <a
                    href="/marcin.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:scale-105 transition-transform duration-300"
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/30 hover:border-blue-400/50 transition-colors duration-300">
                      <img
                        src="/marcin.png"
                        alt="Marcin Lisiak"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </a>
                  <div className="text-center">
                    <p className="text-white text-sm font-light">Marcin Lisiak</p>
                    <p className="text-blue-300 text-xs">AI Developer</p>
                  </div>
                </div>

                {/* Right 50% - LinkedIn Button (full height) */}
                <div className="flex-1 flex">
                  <a
                    href="https://www.linkedin.com/in/move37th/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-all duration-300 hover:scale-[1.02] text-xs text-blue-200 hover:text-blue-100 flex items-center justify-center text-center"
                  >
                    🔗 Connect with me on LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hackathon Project - Full Width */}
          <motion.div variants={itemVariants}>
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-700/40 backdrop-blur-sm">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-2 text-green-300">
                  <Code className="w-5 h-5" />
                  <span className="text-sm font-light">Hackathon Project</span>
                </div>
                <p className="text-gray-300 text-xs font-light leading-relaxed">
                  This project was created during <span className="text-blue-300 font-medium">AI Creative Challenge 2025</span>.
                </p>
                <p className="text-gray-200 text-sm font-light leading-relaxed">
                  Submitted to <span className="text-green-300 font-medium">Open Category</span> with hopes for Victory! ;)
                </p>
                <div className="flex justify-center space-x-3 text-xs text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Heart className="w-3 h-3" />
                    <span>Passion</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3 h-3" />
                    <span>Innovation</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Advertisement - Full Width */}
          <motion.div variants={itemVariants}>
            <div className="p-4 rounded-xl bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-700/30 backdrop-blur-sm">
              <div className="text-center space-y-3">
                <div className="text-orange-300 text-xs font-light uppercase tracking-wider">
                  Advertisement
                </div>
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src="/doritos.png"
                    alt="Doritos Advertisement"
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute top-2 right-2 text-xs bg-black/50 text-white rounded px-2 py-1">
                    AD
                  </div>
                </div>
                <p className="text-gray-400 text-xs font-light">
                  <em>Ads keep MovieTinder free</em>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Countdown and Button - At The End */}
          <motion.div variants={itemVariants} className="space-y-3">
            {/* Countdown */}
            <div className="flex items-center justify-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/30 backdrop-blur-sm">
              <p className="text-green-300 text-sm font-light">
                Revealing winner in:
              </p>
              <div className="text-2xl font-light text-white bg-green-600/20 px-4 py-2 rounded-lg">
                {countdown}s
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleProceedToVerdict}
              className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-light rounded-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2 select-none shadow-lg shadow-green-500/25"
            >
              <Trophy className="w-5 h-5" />
              <span>See Winner Now! 🎉</span>
            </button>
          </motion.div>

          {/* Attribution */}
          <motion.div variants={itemVariants}>
            <div className="text-center">
              <p className="text-gray-500 text-xs font-light">
                AI Creative Challenge 2025 | Open Category | move37th.ai
              </p>
            </div>
          </motion.div>
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ CLEANUP STATE
  if (viewState === 'cleanup') {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Session Updated
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              Loading new session data...
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="p-6 rounded-2xl bg-gray-900/40 border border-blue-700/30 backdrop-blur-sm space-y-3 text-center">
              <div className="flex items-center justify-center space-x-3 text-blue-400">
                <div className="w-6 h-6 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div>
                <div className="text-xl text-white">Updating Session</div>
              </div>
              <p className="text-sm text-gray-400">Please wait while we load the latest data...</p>
            </div>
          </motion.div>
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ LOADING STATE
  if (viewState === 'loading') {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Calculating Results
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              Analyzing your movie preferences...
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="p-6 rounded-2xl bg-gray-900/40 border border-purple-700/30 backdrop-blur-sm space-y-3 text-center">
              <div className="flex items-center justify-center space-x-3 text-purple-400">
                <BrainCircuit className="w-6 h-6 animate-pulse" />
                <div className="text-xl text-white">Processing Matches</div>
              </div>
              <p className="text-sm text-gray-400">Finding movies you all loved...</p>
            </div>
          </motion.div>
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ FINAL VOTING & WAITING
  if (viewState === 'final_voting' || viewState === 'waiting_for_verdict') {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-4xl w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              {viewState === 'waiting_for_verdict' ? 'Waiting for Others' : 'Final Showdown!'}
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-amber-600/60 via-yellow-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              {viewState === 'waiting_for_verdict'
                ? 'Thanks for voting! Waiting for all participants to choose...'
                : 'You all agreed on these movies. Pick one definitive winner!'
              }
            </p>
            {viewState === 'final_voting' && participantsCount > 1 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-950/20 border border-amber-800/30 backdrop-blur-sm">
                <p className="text-amber-200/80 text-xs font-light">
                  ⚡ In case of a tie, the fastest reaction time wins
                </p>
              </div>
            )}
          </motion.div>

          {viewState === 'waiting_for_verdict' ? (
            <motion.div variants={itemVariants}>
              <div className="p-6 rounded-2xl bg-gray-900/40 border border-amber-700/30 backdrop-blur-sm space-y-3 text-center">
                <div className="flex items-center justify-center space-x-3 text-amber-400 animate-pulse">
                  <Clock className="w-6 h-6" />
                  <div className="text-xl text-white">Waiting for Final Votes</div>
                </div>
                <p className="text-sm text-gray-400">The suspense is building...</p>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div variants={itemVariants}>
                <div className={`grid grid-cols-2 md:grid-cols-${Math.min(matchedMovies.length, 4)} gap-4`}>
                  {matchedMovies.map(movie => (
                    <div
                      key={movie.movieId}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleMovieSelect(movie.movieId);
                      }}
                      className={`rounded-2xl border transition-all duration-300 group relative overflow-hidden hover:scale-[1.02] cursor-pointer select-none ${
                        selectedMovieId === movie.movieId
                          ? 'border-amber-500/50 bg-gradient-to-br from-amber-900/30 to-amber-800/20 scale-105'
                          : 'border-gray-800/50 bg-gradient-to-br from-gray-900/40 to-gray-800/30 hover:border-gray-700/70'
                      }`}
                    >
                      {selectedMovieId === movie.movieId && (
                        <div className="absolute -inset-1 rounded-2xl bg-amber-500/10 blur-sm" />
                      )}

                      {/* ✅ NAKŁADKA ZAZNACZENIA - na tym samym poziomie co content */}
                      {selectedMovieId === movie.movieId && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-green-500/40 flex items-center justify-center z-30 rounded-2xl"
                        >
                          <Check className="w-1/2 h-1/2 text-white opacity-90" />
                        </motion.div>
                      )}

                      {/* Zawartość karty */}
                      <img
                        src={movie.movieImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.movieTitle)}&background=2A2E37&color=FFFFFF&size=512`}
                        alt={movie.movieTitle}
                        className="w-full h-auto aspect-[2/3] object-cover rounded-t-2xl pointer-events-none"
                        draggable={false}
                      />
                      <div className="p-4 pointer-events-none">
                        <p className="text-white font-light text-sm text-center line-clamp-2">{movie.movieTitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {selectedMovieId && (
                <motion.div
                  variants={itemVariants}
                  className="fixed bottom-6 left-6 right-6 z-40"
                >
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleVoteClick}
                    className={`w-full py-4 px-6 font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 select-none shadow-2xl ${
                      isSubmitting
                        ? 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Submitting Vote...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Final Choice</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ SHOWING VERDICT
  if (viewState === 'showing_verdict' && finalWinner) {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              And the Winner Is...
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-green-600/60 via-emerald-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              Your perfect movie choice!
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="rounded-2xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/30 backdrop-blur-sm overflow-hidden">
              <img
                src={finalWinner.movieImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalWinner.movieTitle)}&background=2A2E37&color=FFFFFF&size=512`}
                alt={finalWinner.movieTitle}
                className="w-full h-auto aspect-[2/3] object-cover"
                draggable={false}
              />
              <div className="p-6 text-center">
                <div className="text-2xl font-light text-white">{finalWinner.movieTitle}</div>
              </div>
            </div>
          </motion.div>
          {isAdmin && (
            <motion.div
              variants={itemVariants}
              className="fixed bottom-6 left-6 right-6 z-40"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleFinishSession}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 select-none shadow-2xl shadow-green-500/25"
              >
                <span>End Session</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ NO MATCHES
  if (matchedMovies.length === 0) {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              No Matches Found
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-gray-600/60 via-gray-500/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              {error ? `Error: ${error}` : 'Different tastes this round. Let\'s try again!'}
            </p>
          </motion.div>
          <motion.div variants={itemVariants} className="flex items-center justify-center">
            <Frown className="w-24 h-24 text-gray-400" />
          </motion.div>
          {isAdmin && (
            <motion.div
              variants={itemVariants}
              className="fixed bottom-6 left-6 right-6 z-40"
            >
              {!isFinalBatch ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleStartNextRound}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 select-none shadow-2xl shadow-blue-500/25"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Try Next Batch</span>
                </button>
              ) : (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleFinishSession}
                  className="w-full py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-600 text-gray-300 font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] select-none shadow-2xl shadow-gray-500/25"
                >
                  End Session
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ SINGLE MATCH (PERFECT MATCH)
  if (matchedMovies.length === 1) {
    const singleMatch = matchedMovies[0];
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              {participantsCount === 1 ? 'Great Choice!' : 'Perfect Match!'}
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-green-600/60 via-emerald-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              {participantsCount === 1 ? 'You found your perfect movie!' : 'You all agreed on this one!'}
            </p>
            <div className="rounded-2xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/30 backdrop-blur-sm overflow-hidden">
              <img
                src={singleMatch.movieImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(singleMatch.movieTitle)}&background=2A2E37&color=FFFFFF&size=512`}
                alt={singleMatch.movieTitle}
                className="w-full h-auto aspect-[2/3] object-cover"
                draggable={false}
              />
              <div className="p-6 text-center">
                <div className="text-2xl font-light text-white">{singleMatch.movieTitle}</div>
              </div>
            </div>
          </motion.div>
          {isAdmin && (
            <motion.div
              variants={itemVariants}
              className="fixed bottom-6 left-6 right-6 z-40"
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleFinishSession}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 select-none shadow-2xl shadow-green-500/25"
              >
                <span>End Session</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ THANK YOU SCREEN
  if (viewState === 'thank_you') {
    return (
      <BackgroundWrapper>
        <motion.div
          className="max-w-lg w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Thank You!
            </div>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm leading-relaxed">
              We hope you enjoyed finding your perfect movie together
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-700/30 backdrop-blur-sm space-y-4 text-center">
              <div className="text-white text-lg font-light">
                🎬 Enjoy Your Movie Night!
              </div>
              <p className="text-gray-300 text-sm font-light leading-relaxed">
                We hope your viewing session is amazing and that our recommendation was spot-on.
                Movie nights with friends are the best kind of nights!
              </p>
            </div>
          </motion.div>

          {/* Social Media Sharing */}
          <motion.div variants={itemVariants}>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-700/30 backdrop-blur-sm space-y-4">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center space-x-2 text-green-300">
                  <Share2 className="w-5 h-5" />
                  <span className="text-lg font-light">Share the Fun!</span>
                </div>
                <p className="text-gray-300 text-sm font-light">
                  Loved the experience? Share MovieTinder with your friends!
                </p>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => handleSocialShare('instagram')}
                  className="p-3 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white transition-all duration-300 hover:scale-110"
                  title="Share on Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSocialShare('facebook')}
                  className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-300 hover:scale-110"
                  title="Share on Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSocialShare('twitter')}
                  className="p-3 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white transition-all duration-300 hover:scale-110"
                  title="Share on Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Doritos Advertisement Mockup */}
          <motion.div variants={itemVariants}>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-700/30 backdrop-blur-sm space-y-4">
              <div className="text-center space-y-3">
                <div className="text-orange-300 text-sm font-light uppercase tracking-wider">
                  Advertisement
                </div>
                <div className="relative p-6 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white text-center">
                  <div className="text-2xl font-bold mb-2">🧡 DORITOS</div>
                  <div className="text-lg font-semibold mb-1">NACHO CHEESE</div>
                  <div className="text-sm opacity-90 mb-3">Perfect for Movie Nights!</div>
                  <div className="text-xs bg-white/20 rounded-full px-3 py-1 inline-block">
                    Crunch Into Fun
                  </div>
                  <div className="absolute top-2 right-2 text-xs bg-white/10 rounded px-2 py-1">
                    AD
                  </div>
                </div>
                <p className="text-gray-400 text-xs font-light">
                  <em>This demonstrates MovieTinder's advertising potential - seamless brand integration at the perfect moment</em>
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="fixed bottom-6 left-6 right-6 z-40"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleFinalFinish}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-light rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 select-none shadow-2xl shadow-blue-500/25"
            >
              <span>Continue</span>
            </button>
          </motion.div>
        </motion.div>
      </BackgroundWrapper>
    );
  }

  // ✅ FALLBACK
  return (
    <BackgroundWrapper>
      <motion.div
        className="max-w-md w-full space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center space-y-3">
          <div className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
            Something Went Wrong
          </div>
          <div className="w-16 h-px bg-gradient-to-r from-red-600/60 via-pink-600/60 to-transparent mx-auto"></div>
          <p className="text-gray-400 font-light text-sm leading-relaxed">
            An unexpected error occurred
          </p>
        </motion.div>
      </motion.div>
    </BackgroundWrapper>
  );
}