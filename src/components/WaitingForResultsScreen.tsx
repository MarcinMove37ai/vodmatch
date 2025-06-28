// src/components/WaitingForResultsScreen.tsx - WERSJA Z KONTROLĄ RELEASE INSIGHTS
'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Users, CheckCircle, WifiOff, BrainCircuit, Award, Sparkles, Crown, Eye } from 'lucide-react'
import ParticipantInsightCard from './ParticipantInsightCard'

type ResultsPhase = 'ranking_only' | 'analyzing' | 'insights_ready' | 'showing_insights' | 'awaiting_winner_action'

interface WaitingForResultsScreenProps {
  sessionId: string
  session: any
  userId: string
  isAdmin: boolean
  realTimeConnected?: boolean
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  onRefreshSession: () => Promise<void>
  releaseInsights?: () => Promise<boolean> // 🆕 NOWY PROP
}

interface RankedParticipant {
  userId: string
  username: string
  isAdmin: boolean
  hasCompleted: boolean
  platform: string
  pic_url: string | null
  totalTime: number | null
  rank: number
  individual_analysis: any | null
  llm_characterization: string | null
}

export default function WaitingForResultsScreen({
  sessionId,
  session,
  userId,
  isAdmin,
  realTimeConnected = false,
  onRefreshSession,
  releaseInsights // 🆕 NOWY PROP
}: WaitingForResultsScreenProps) {

  const isConnected = realTimeConnected;
  const isSoloMode = session?.viewingMode === 'solo';

  // ZMIANA: Stan początkowy jest ustawiany warunkowo, aby uniknąć "flasha" rankingu w trybie solo.
  const [resultsPhase, setResultsPhase] = useState<ResultsPhase>(() =>
    isSoloMode ? 'analyzing' : 'ranking_only'
  );

  const [isReleasingInsights, setIsReleasingInsights] = useState(false) // 🆕 LOADING STATE

  const rankedParticipants: RankedParticipant[] = useMemo(() => {
    if (!session?.profiles) return [];

    const completed = session.profiles
      .filter((p: any) => p.quiz_result?.completedAt)
      .map((p: any) => ({ ...p, totalTime: p.quiz_result.totalTime, individual_analysis: p.individual_analysis }))
      .sort((a: any, b: any) => a.totalTime - b.totalTime);

    const pending = session.profiles.filter((p: any) => !p.quiz_result?.completedAt);

    return [...completed, ...pending].map((profile: any) => {
      const hasCompleted = !!profile.quiz_result?.completedAt;

      return {
        userId: profile.userId,
        username: profile.username,
        isAdmin: profile.isAdmin,
        hasCompleted,
        platform: profile.platform,
        pic_url: profile.pic_url,
        totalTime: profile.quiz_result?.totalTime || null,
        rank: hasCompleted ? completed.findIndex((c: { userId: string }) => c.userId === profile.userId) + 1 : 0,
        individual_analysis: profile.individual_analysis || null,
        llm_characterization: profile.llm_characterization || null
      };
    });
  }, [session?.profiles]);

  // 🔄 ZMIENIONY useEffect - obsługa nowych statusów
  useEffect(() => {
    const currentStatus = session?.status;

    if (currentStatus === 'insights_ready') {
      // Analiza zakończona, ale admin jeszcze nie zwolnił insights
      const isAnalysisComplete = !!session?.group_analysis;
      if (isAnalysisComplete) {
        setResultsPhase('insights_ready');
      } else {
        setResultsPhase('analyzing');
      }
    } else if (currentStatus === 'insights_released') {
      // Admin zwolnił insights - można pokazać
      setResultsPhase('showing_insights');
    } else if (currentStatus === 'results') {
      // Stary status - dla kompatybilności wstecznej
      const isAnalysisComplete = !!session?.group_analysis;
      if (isAnalysisComplete) {
        setResultsPhase('showing_insights');
      } else {
        setResultsPhase('analyzing');
      }
    } else if (!isSoloMode) {
      setResultsPhase('ranking_only');
    }
  }, [session?.status, session?.group_analysis, isSoloMode]);

  useEffect(() => {
    if (resultsPhase === 'showing_insights') {
      const timer = setTimeout(() => {
        setResultsPhase('awaiting_winner_action');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [resultsPhase]);

  // 🆕 HANDLER dla release insights
  const handleReleaseInsights = async () => {
    if (!releaseInsights) return;

    setIsReleasingInsights(true);
    try {
      const success = await releaseInsights();
      if (success) {
        console.log('✅ Insights released successfully');
        // Status zmieni się automatycznie przez real-time update
      } else {
        console.error('❌ Failed to release insights');
      }
    } catch (error) {
      console.error('❌ Error releasing insights:', error);
    } finally {
      setIsReleasingInsights(false);
    }
  };

  // 🆕 SPRAWDZENIE: Czy wszystkie social analysis są zakończone
  const allSocialAnalysisCompleted = useMemo(() => {
    // Sprawdź czy wszyscy użytkownicy którzy skończyli quiz mają zakończoną analizę social media
    const result = rankedParticipants
      .filter(p => p.hasCompleted) // tylko ci co skończyli quiz
      .every(p => {
        // Sprawdź social_analysis_status w session.profiles
        const userProfile = session?.profiles?.find((profile: any) => profile.userId === p.userId);
        const socialAnalysisStatus = userProfile?.social_analysis_status;

        // 🔍 DEBUG: Log statusu dla każdego użytkownika
        console.log(`🔍 Social Analysis Status for ${p.username}:`, {
          userId: p.userId,
          socialAnalysisStatus,
          userProfile: userProfile ? 'found' : 'not found'
        });

        // Jeśli nie ma statusu (null) → nie ma social media → uznajemy za gotowego
        // Jeśli ma status "completed" lub "failed" → gotowy
        // Jeśli ma status "pending" lub "in_progress" → czekamy
        const isReady = !socialAnalysisStatus ||
                       socialAnalysisStatus === 'completed' ||
                       socialAnalysisStatus === 'failed';

        console.log(`🔍 User ${p.username} ready: ${isReady} (status: ${socialAnalysisStatus})`);
        return isReady;
      });

    console.log(`🔍 All Social Analysis Completed: ${result}`);
    return result;
  }, [rankedParticipants, session?.profiles]);

  const currentUserAnalysis = useMemo(() => {
    if (resultsPhase === 'showing_insights' || resultsPhase === 'awaiting_winner_action') {
      return rankedParticipants.find(p => p.userId === userId);
    }
    return null;
  }, [resultsPhase, rankedParticipants, userId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-md w-full space-y-6"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <AnimatePresence mode="wait">
            {(resultsPhase === 'showing_insights' || resultsPhase === 'awaiting_winner_action') ? (
              <motion.div
                key="insights-header"
                className="flex items-center justify-center space-x-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, position: 'absolute' }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)] bg-gradient-to-r from-purple-500 to-violet-600 flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-4">
                  <h1 className="text-2xl font-light text-white text-center">
                    Your Personal Insights
                  </h1>
                  <div className="w-12 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
                  <p className="text-gray-400 font-light text-center">
                    For the best possible film recommendations
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="default-header"
                className="flex items-center justify-center space-x-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, position: 'absolute' }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(5,150,105,0.5)] bg-gradient-to-r from-green-500 to-emerald-500 flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-light text-white">
                    Quiz Completed!
                  </h1>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ZMIANA: Dodanie layout do głównego kontenera treści */}
          <motion.div layout className="w-full" transition={{ layout: { duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] } }}>
            <AnimatePresence mode="wait">
              {(resultsPhase === 'showing_insights' || resultsPhase === 'awaiting_winner_action') ? (
                <motion.div
                  key="insights"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-full space-y-4"
                >
                  {currentUserAnalysis && currentUserAnalysis.individual_analysis && (
                    <ParticipantInsightCard
                      key={currentUserAnalysis.userId}
                      analysis={currentUserAnalysis.individual_analysis}
                      pic_url={currentUserAnalysis.pic_url}
                      llm_characterization={currentUserAnalysis.llm_characterization}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="ranking-analyzing"
                  layout
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* 🆕 WAITING FOR OTHERS - panel oczekiwania gdy user skończył quiz */}
                  {resultsPhase === 'ranking_only' && rankedParticipants.find(p => p.userId === userId)?.hasCompleted && (
                    <div className="p-6 rounded-xl bg-gray-900/40 border border-amber-700/30 backdrop-blur-sm space-y-4 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <Clock className="w-6 h-6 text-amber-400" />
                        <h2 className="text-xl text-white">Waiting for Others</h2>
                      </div>
                      <p className="text-sm text-gray-400">Great job! Please wait while other participants finish their quiz...</p>
                      <div className="flex items-center justify-center space-x-3 text-amber-400/80 pt-2">
                        <div className="w-5 h-5 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin"></div>
                        <span>Waiting...</span>
                      </div>
                    </div>
                  )}

                  {/* Ranking - pokazywany tylko gdy nie solo mode i nie czeka na innych */}
                  {!isSoloMode && !(resultsPhase === 'ranking_only' && rankedParticipants.find(p => p.userId === userId)?.hasCompleted) && (
                    <div className="p-6 rounded-xl bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Users className="w-6 h-6 text-blue-400" />
                          <h2 className="text-xl text-white">Ranking</h2>
                        </div>
                        {isConnected && (
                          <div className="flex items-center space-x-1 text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs">Live</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 mt-4">
                        {rankedParticipants.map((participant) => (
                          <div key={participant.userId} className={`p-3 rounded-xl border flex items-center space-x-3 transition-all duration-500 ${ participant.rank === 1 ? 'border-yellow-400/50 bg-green-900/20 shadow-[0_0_25px_rgba(253,224,71,0.3)]' : participant.hasCompleted ? 'border-green-700/30 bg-green-900/20' : 'border-gray-700/50 bg-gray-800/30'}`}>
                            <div className="text-xl font-bold w-10 text-center flex items-center justify-center">
                              {participant.hasCompleted ? (participant.rank === 1 ? <Award className="w-6 h-6 text-yellow-400" /> : <span className="text-gray-400">{participant.rank}</span>) : <Clock className="w-5 h-5 mx-auto text-yellow-400"/>}
                            </div>
                            <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500">
                              {participant.pic_url ? <img src={participant.pic_url} alt="Participant" className="w-full h-full rounded-full object-cover"/> : <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><span className="text-white text-xs font-medium">{participant.username.charAt(0).toUpperCase()}</span></div>}
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">@{participant.username}</p>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {participant.rank === 1 ? <span className="inline-flex items-center"><span>{participant.isAdmin ? 'Host' : 'Participant'} •</span><span className="ml-1.5 px-2 py-0.5 font-bold text-black bg-yellow-400 rounded-full">{participant.userId === userId ? 'You Win!' : 'Winner'}</span></span> : <span>{(participant.isAdmin ? 'Host' : 'Participant') + ` • ${participant.hasCompleted ? 'Completed' : 'In progress...'}`}</span>}
                              </div>
                            </div>
                            {participant.hasCompleted && (
                              <div className="text-right">
                                <p className={`text-lg font-mono ${ participant.rank === 1 ? 'text-yellow-300' : 'text-purple-300'}`}>{participant.totalTime}s</p>
                                <p className="text-xs text-gray-500">Time</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analyzing */}
                  {resultsPhase === 'analyzing' && (
                    <div className="p-6 rounded-xl bg-gray-900/40 border border-purple-700/30 backdrop-blur-sm space-y-4 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <BrainCircuit className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl text-white">Analyzing Results</h2>
                      </div>
                      <p className="text-sm text-gray-400">Please wait, we're getting to know you even better...</p>
                      <div className="flex items-center justify-center space-x-3 text-purple-400/80 pt-2">
                        <div className="w-5 h-5 border-2 border-purple-400/50 border-t-purple-400 rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    </div>
                  )}

                  {/* 🆕 INSIGHTS READY - przycisk dla admina lub spinner dla uczestników */}
                  {resultsPhase === 'insights_ready' && (
                    <div className="p-6 rounded-xl bg-gray-900/40 border border-blue-700/30 backdrop-blur-sm space-y-4 text-center">
                      <div className="flex items-center justify-center space-x-3">
                        <Eye className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl text-white">
                          {allSocialAnalysisCompleted ? "Insights Ready" : "Finalizing Analysis"}
                        </h2>
                      </div>

                      {isAdmin ? (
                        allSocialAnalysisCompleted ? (
                          // ✅ Wszystko gotowe - pokaż przycisk
                          <>
                            <p className="text-sm text-gray-400">
                              {isSoloMode
                                ? "Analysis complete! You can now view your personal insights."
                                : "Analysis complete! You can now release the insights to participants."
                              }
                            </p>
                            <div className="pt-2">
                              <button
                                onClick={handleReleaseInsights}
                                disabled={isReleasingInsights}
                                className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform duration-300 flex items-center justify-center mx-auto space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              >
                                {isReleasingInsights ? (
                                  <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>{isSoloMode ? "Loading..." : "Releasing..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-5 h-5" />
                                    <span>{isSoloMode ? "View Insights" : "Release Insights"}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        ) : (
                          // ⏳ LLM characterizations jeszcze nie gotowe
                          <>
                            <p className="text-sm text-gray-400">Please wait, we're adding personal touches to your insights...</p>
                            <div className="flex items-center justify-center space-x-3 text-blue-400/80 pt-2">
                              <div className="w-5 h-5 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div>
                              <span>Personalizing...</span>
                            </div>
                          </>
                        )
                      ) : (
                        // 👥 Uczestnicy zawsze widzą oczekiwanie
                        <>
                          <p className="text-sm text-gray-400">
                            {allSocialAnalysisCompleted
                              ? "Waiting for host to release the insights..."
                              : "Please wait, we're finalizing your personal insights..."
                            }
                          </p>
                          <div className="flex items-center justify-center space-x-3 text-blue-400/80 pt-2">
                            <div className="w-5 h-5 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div>
                            <span>{allSocialAnalysisCompleted ? "Waiting..." : "Personalizing..."}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="h-24">
            <AnimatePresence>
              {resultsPhase === 'awaiting_winner_action' && (
                isSoloMode ? (
                  <motion.div
                    key="solo-bonus"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <button className="bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform duration-300 flex items-center justify-center mx-auto space-x-2">
                      <Sparkles className="w-5 h-5" />
                      <span>Bonus</span>
                    </button>
                    <p className="text-sm text-purple-300/80 mt-3">Set your movie preferences</p>
                  </motion.div>
                ) : (
                  currentUserAnalysis?.rank === 1 ? (
                    <motion.div
                      key="winner-bonus"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center"
                    >
                      <button className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold py-3 px-6 rounded-lg shadow-lg shadow-yellow-500/20 hover:scale-105 transition-transform duration-300 flex items-center justify-center mx-auto space-x-2">
                        <Crown className="w-5 h-5" />
                        <span>Winner Bonus</span>
                      </button>
                      <p className="text-sm text-yellow-300/80 mt-3">Set your movie preferences</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waiting-spinner"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex flex-col items-center justify-center pt-4 text-center"
                    >
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-500 mt-3">Waiting for Winner's preferences setup...</p>
                    </motion.div>
                  )
                )
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}