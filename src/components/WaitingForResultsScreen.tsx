// src/components/WaitingForResultsScreen.tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Users, CheckCircle, BrainCircuit, Award, Sparkles, Crown, Eye, Star, XCircle, Film } from 'lucide-react'
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
  releaseInsights?: () => Promise<boolean>
  onSetMoviePreferences?: () => void
  movieSearchCompleted?: boolean
  onFindMovies?: () => void
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
  releaseInsights,
  onSetMoviePreferences,
  movieSearchCompleted = false,
  onFindMovies
}: WaitingForResultsScreenProps) {
  const isConnected = realTimeConnected
  const isSoloMode = session?.viewingMode === 'solo'

  const [resultsPhase, setResultsPhase] = useState<ResultsPhase>(() =>
    isSoloMode ? 'analyzing' : 'ranking_only'
  )

  const [isReleasingInsights, setIsReleasingInsights] = useState(false)

  const movieSearchState = useMemo(() => {
    const hasPreferences = !!session?.movie_preferences
    const hasResults = movieSearchCompleted || !!session?.movie_search_results || !!session?.llm_movies

    if (!hasPreferences) return 'no_preferences'
    if (hasResults) return 'completed'
    return 'searching'
  }, [session?.movie_preferences, movieSearchCompleted, session?.movie_search_results, session?.llm_movies])

  const rankedParticipants: RankedParticipant[] = useMemo(() => {
    if (!session?.profiles) return []

    const completed = session.profiles
      .filter((p: any) => p.quiz_result?.completedAt)
      .map((p: any) => ({ ...p, totalTime: p.quiz_result.totalTime, individual_analysis: p.individual_analysis }))
      .sort((a: any, b: any) => a.totalTime - b.totalTime)

    const pending = session.profiles.filter((p: any) => !p.quiz_result?.completedAt)

    return [...completed, ...pending].map((profile: any) => {
      const hasCompleted = !!profile.quiz_result?.completedAt
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
        llm_characterization: profile.llm_characterization || null,
      }
    })
  }, [session?.profiles])

  useEffect(() => {
    const currentStatus = session?.status
    if (currentStatus === 'insights_ready') {
      const isAnalysisComplete = !!session?.group_analysis
      setResultsPhase(isAnalysisComplete ? 'insights_ready' : 'analyzing')
    } else if (currentStatus === 'insights_released') {
      setResultsPhase('showing_insights')
    } else if (currentStatus === 'results') {
      const isAnalysisComplete = !!session?.group_analysis
      setResultsPhase(isAnalysisComplete ? 'showing_insights' : 'analyzing')
    } else if (!isSoloMode) {
      setResultsPhase('ranking_only')
    }
  }, [session?.status, session?.group_analysis, isSoloMode])

  useEffect(() => {
    if (resultsPhase === 'showing_insights') {
      const timer = setTimeout(() => {
        setResultsPhase('awaiting_winner_action')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [resultsPhase])

  const handleReleaseInsights = async () => {
    if (!releaseInsights) return
    setIsReleasingInsights(true)
    try {
      await releaseInsights()
    } catch (error) {
      console.error('❌ Error releasing insights:', error)
    } finally {
      setIsReleasingInsights(false)
    }
  }

  const handleSetMoviePreferences = () => {
    if (onSetMoviePreferences) {
      onSetMoviePreferences()
    }
  }

  const allSocialAnalysisCompleted = useMemo(() => {
    return rankedParticipants
      .filter(p => p.hasCompleted)
      .every(p => {
        const userProfile = session?.profiles?.find((profile: any) => profile.userId === p.userId)
        const socialAnalysisStatus = userProfile?.social_analysis_status
        return !socialAnalysisStatus || socialAnalysisStatus === 'completed' || socialAnalysisStatus === 'failed'
      })
  }, [rankedParticipants, session?.profiles])

  const currentUserAnalysis = useMemo(() => {
    return rankedParticipants.find(p => p.userId === userId)
  }, [rankedParticipants, userId])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const isActionTaker = isSoloMode || currentUserAnalysis?.rank === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        <motion.div
          className="max-w-md w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {(resultsPhase === 'showing_insights' || resultsPhase === 'awaiting_winner_action') ? (
                <motion.div
                  key="insights-header"
                  variants={itemVariants}
                  className="flex items-center justify-center space-x-4"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 bg-gradient-to-br from-purple-500 to-violet-600 flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-2xl font-light text-white">Your Personal Insights</h1>
                    <p className="text-sm text-gray-400">For the best film recommendations</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="default-header"
                  variants={itemVariants}
                  className="flex items-center justify-center space-x-4"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 bg-gradient-to-br from-emerald-500 to-green-600 flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-2xl font-light text-white">Quiz Completed!</h1>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout transition={{ layout: { duration: 0.5, type: 'spring' } }}>
              <AnimatePresence mode="wait">
                {(resultsPhase === 'showing_insights' || resultsPhase === 'awaiting_winner_action') ? (
                  <motion.div
                    key="final-phase-container"
                    variants={containerVariants}
                    className="space-y-4"
                  >
                    {currentUserAnalysis?.individual_analysis && (
                      <motion.div variants={itemVariants}>
                        <ParticipantInsightCard
                          analysis={currentUserAnalysis.individual_analysis}
                          pic_url={currentUserAnalysis.pic_url}
                          llm_characterization={currentUserAnalysis.llm_characterization}
                        />
                      </motion.div>
                    )}

                    {resultsPhase === 'awaiting_winner_action' && (
                      <>
                        {!session?.movie_preferences && (
                          <div className="pt-4">
                            {isActionTaker ? (
                              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center">
                                <button
                                  onClick={handleSetMoviePreferences}
                                  className={`font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 flex items-center justify-center mx-auto space-x-2.5
                                    ${isSoloMode
                                      ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-purple-500/25 hover:shadow-violet-500/30 hover:brightness-110'
                                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/25 hover:shadow-orange-500/30 hover:brightness-110'
                                    }`}
                                >
                                  {isSoloMode ? <Sparkles className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
                                  <span>{isSoloMode ? 'Set Preferences' : 'Winner\'s Bonus'}</span>
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center text-center text-gray-500 text-sm space-x-3">
                                <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
                                <p>Waiting for Winner's preferences...</p>
                              </motion.div>
                            )}
                          </div>
                        )}

                        {!!session?.movie_preferences && (
                          <>
                            <motion.div variants={itemVariants} className="p-4 sm:p-5 rounded-2xl bg-gray-900/40 border border-amber-700/30 backdrop-blur-sm space-y-4">
                              <div className="flex items-center space-x-3">
                                <Crown className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                <h3 className="text-lg text-white font-light">Winner's Preferences</h3>
                              </div>
                              <div className="space-y-2 text-sm text-gray-300 pl-8 border-l border-dashed border-gray-700 ml-2.5">
                                <div className="flex items-center space-x-2">
                                  <XCircle className="w-4 h-4 text-red-400/80"/>
                                  <span>Exclude: {session.movie_preferences.excludedGenres.join(', ')}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Star className="w-4 h-4 text-yellow-400/80"/>
                                  <span>Min. IMDB: {session.movie_preferences.minImdbRating}/10</span>
                                </div>
                              </div>
                            </motion.div>

                            <motion.div variants={itemVariants} className="pt-4">
                              {isAdmin ? (
                                (() => {
                                  switch (movieSearchState) {
                                    case 'searching':
                                      return (
                                        <div className="flex items-center justify-center text-center text-blue-400 text-sm space-x-3">
                                          <div className="w-5 h-5 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div>
                                          <p>Searching for perfect movies...</p>
                                        </div>
                                      )
                                    case 'completed':
                                      return (
                                        <button
                                          onClick={onFindMovies}
                                          className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-emerald-500/25 hover:shadow-green-500/30 hover:brightness-110 transition-all duration-300 flex items-center justify-center space-x-2.5 group"
                                        >
                                          <Film className="w-5 h-5 group-hover:scale-110 transition-transform"/>
                                          <span>View Movies</span>
                                          <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></div>
                                        </button>
                                      )
                                    default:
                                      return null
                                  }
                                })()
                              ) : (
                                <div className="flex items-center justify-center text-center text-gray-400 text-sm space-x-3">
                                  <div className="w-5 h-5 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin"></div>
                                  <p>Waiting for Host to find movies...</p>
                                </div>
                              )}
                            </motion.div>
                          </>
                        )}
                      </>
                    )}
                  </motion.div>

                ) : (
                  <motion.div key="early-phases-container" variants={containerVariants} className="space-y-4">
                    {resultsPhase === 'ranking_only' && rankedParticipants.find(p => p.userId === userId)?.hasCompleted && (
                      <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-gray-900/40 border border-amber-700/30 backdrop-blur-sm space-y-3 text-center">
                        <div className="flex items-center justify-center space-x-3 text-amber-400 animate-pulse">
                          <Clock className="w-6 h-6" />
                          <h2 className="text-xl text-white">Waiting for Others</h2>
                        </div>
                        <p className="text-sm text-gray-400">Please wait while other participants finish their quiz.</p>
                      </motion.div>
                    )}
                    {!isSoloMode && !(resultsPhase === 'ranking_only' && rankedParticipants.find(p => p.userId === userId)?.hasCompleted) && (
                      <motion.div variants={itemVariants} className="p-4 sm:p-5 rounded-2xl bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3"><Users className="w-5 h-5 text-blue-400" /><h2 className="text-lg text-white font-light">Ranking</h2></div>
                          {isConnected && <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-medium"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div><span>Live</span></div>}
                        </div>
                        <motion.ul variants={containerVariants} className="space-y-3">
                          {rankedParticipants.map((p) => {
                             const isWinner = p.rank === 1 && p.hasCompleted, isSelf = p.userId === userId;
                             const winnerStyles = "border-amber-400/50 bg-amber-900/20 shadow-[0_0_25px_rgba(250,176,5,0.25)]", completedStyles = "border-emerald-700/30 bg-emerald-950/20", pendingStyles = "border-gray-700/50 bg-gray-800/30 opacity-70";
                            return(
                            <motion.li key={p.userId} variants={itemVariants} className={`p-3 rounded-xl border flex items-center space-x-3 transition-all duration-300 ${isWinner ? winnerStyles : p.hasCompleted ? completedStyles : pendingStyles}`}>
                              <div className="text-xl font-bold w-8 text-center flex-shrink-0">{p.hasCompleted ? (isWinner ? <Award className="w-6 h-6 text-amber-400" /> : <span className="text-gray-400 font-light">{p.rank}</span>) : <Clock className="w-5 h-5 mx-auto text-gray-500 animate-pulse"/>}</div>
                              <img src={p.pic_url || `https://ui-avatars.com/api/?name=${p.username}&background=2A2E37&color=FFFFFF&rounded=true`} alt={p.username} className="w-10 h-10 rounded-full object-cover border-2 border-gray-700/50"/>
                              <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">@{p.username} {isSelf && <span className="text-gray-500">(You)</span>}</p><p className="text-xs text-gray-400 mt-0.5">{p.hasCompleted ? `${p.totalTime}s` : 'In progress...'}</p></div>
                              {isWinner && <div className="text-xs font-bold text-black bg-amber-400 rounded-full px-2 py-0.5">Winner</div>}
                            </motion.li>
                          )})}
                        </motion.ul>
                      </motion.div>
                    )}
                    {resultsPhase === 'analyzing' && (
                       <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-gray-900/40 border border-purple-700/30 backdrop-blur-sm space-y-3 text-center">
                        <div className="flex items-center justify-center space-x-3 text-purple-400"><BrainCircuit className="w-6 h-6 animate-pulse" /><h2 className="text-xl text-white">Analyzing Results</h2></div><p className="text-sm text-gray-400">We're getting to know you even better...</p>
                      </motion.div>
                    )}
                    {resultsPhase === 'insights_ready' && (
                      <motion.div variants={itemVariants} className="p-5 rounded-2xl bg-gray-900/40 border border-blue-700/30 backdrop-blur-sm space-y-4 text-center">
                        <div className="flex items-center justify-center space-x-3 text-blue-400"><Eye className="w-6 h-6" /><h2 className="text-xl text-white">{allSocialAnalysisCompleted ? "Insights Ready" : "Finalizing Analysis"}</h2></div>
                        <p className="text-sm text-gray-400">{isAdmin ? (allSocialAnalysisCompleted ? (isSoloMode ? "Your insights are ready to view." : "Analysis complete. Release insights to participants.") : "Personalizing final touches...") : (allSocialAnalysisCompleted ? "Waiting for host to release the insights." : "Finalizing your personal insights...")}</p>
                         {isAdmin && allSocialAnalysisCompleted ? (
                          <div className="pt-2"><button onClick={handleReleaseInsights} disabled={isReleasingInsights} className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-cyan-500/30 hover:brightness-110 transition-all duration-300 flex items-center justify-center mx-auto space-x-2.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100">{isReleasingInsights ? <><div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div><span>Releasing...</span></> : <><Eye className="w-5 h-5" /><span>{isSoloMode ? "View Insights" : "Release Insights"}</span></>}</button></div>
                         ) : (<div className="flex items-center justify-center space-x-3 text-blue-400/80 pt-2"><div className="w-5 h-5 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div><span>{allSocialAnalysisCompleted ? "Waiting" : "Personalizing"}</span></div>)}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}