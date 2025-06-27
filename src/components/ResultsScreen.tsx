//src/components/ResultsScreen.tsx - FIXED VERSION
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, CheckCircle, Clock, Users, Wifi, WifiOff } from 'lucide-react'

interface ResultsScreenProps {
  session: any
  // 🆕 ADDED: Real-time props (analogiczne do QRCodeScreen i WaitingRoomScreen)
  realTimeConnected?: boolean
  realTimeConnectionState?: string
  realTimeEventCount?: number
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  // Existing props
  getQuizResults: () => Promise<any[]>
  getCompletionStats: () => { completed: number; total: number }
}

export default function ResultsScreen({
  session,
  // 🆕 ADDED: Real-time props
  realTimeConnected = false,
  realTimeConnectionState = 'disconnected',
  realTimeEventCount = 0,
  realTimeLastUpdate = null,
  realTimeReconnect,
  // Existing props
  getQuizResults,
  getCompletionStats
}: ResultsScreenProps) {
  const [rankedResults, setRankedResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 🆕 ADDED: Real-time connection tracking
  const isConnected = realTimeConnected
  const connectionState = realTimeConnectionState

  const isFinalResults = session?.status === 'results'
  const stats = getCompletionStats()

  // 🆕 FIXED: useEffect now depends on real-time events AND session status
  useEffect(() => {
    if (isFinalResults) {
      console.log(`🏆 ResultsScreen: Loading quiz results (triggered by real-time: ${isConnected})`)
      setIsLoading(true)
      getQuizResults()
        .then(results => {
          console.log(`✅ ResultsScreen: Received ${results.length} results`)
          setRankedResults(results)
        })
        .catch(error => {
          console.error('❌ ResultsScreen: Failed to load results:', error)
        })
        .finally(() => setIsLoading(false))
    } else {
        console.log(`⏳ ResultsScreen: Not in final results state (status: ${session?.status})`)
        setIsLoading(false)
    }
  }, [
    isFinalResults,
    getQuizResults,
    // 🆕 CRITICAL: Add real-time dependencies to trigger re-fetch when data changes
    realTimeEventCount,  // Re-fetch when new events arrive
    realTimeLastUpdate   // Re-fetch when session is updated
  ])

  // 🆕 ADDED: Debug logging for real-time events (like other components)
  useEffect(() => {
    if (realTimeEventCount > 0) {
      console.log('🔍 ResultsScreen Real-time DEBUG:', {
        isConnected,
        connectionState,
        eventCount: realTimeEventCount,
        lastUpdate: realTimeLastUpdate?.toISOString(),
        sessionStatus: session?.status,
        isFinalResults,
        resultsCount: rankedResults.length
      })
    }
  }, [isConnected, connectionState, realTimeEventCount, realTimeLastUpdate, session?.status, isFinalResults, rankedResults.length])

  // 🆕 ADDED: Manual refresh fallback (like other components)
  const handleManualRefresh = async () => {
    if (isConnected && realTimeReconnect) {
      console.log('🔄 ResultsScreen: Real-time working, attempting reconnect')
      realTimeReconnect()
    } else {
      console.log('🔄 ResultsScreen: Manual refresh - reloading quiz results')
      if (isFinalResults) {
        setIsLoading(true)
        try {
          const results = await getQuizResults()
          setRankedResults(results)
        } catch (error) {
          console.error('❌ Manual refresh failed:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  // === EKRAN OCZEKIWANIA ===
  if (!isFinalResults && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-900 flex items-center justify-center p-6">
        <motion.div
          className="max-w-md w-full text-center space-y-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Quiz Completed!
            </h1>
            <p className="text-gray-400 font-light">
              Your results have been submitted.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm space-y-4">
            {/* 🆕 ADDED: Real-time status header (like other components) */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Users className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl text-white">Waiting for others...</h2>
              </div>

              {/* 🆕 ADDED: Real-time indicator */}
              {!isConnected && (
                <button
                  onClick={handleManualRefresh}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                  title="Manual refresh"
                >
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                </button>
              )}

              {isConnected && (
                <div className="flex items-center space-x-1 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs">Live</span>
                </div>
              )}
            </div>

            <p className="text-3xl font-bold text-white">
              {stats.completed} / {stats.total}
            </p>
            <p className="text-sm text-gray-500">participants finished</p>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* 🆕 ADDED: Last update timestamp */}
            {realTimeLastUpdate && isConnected && (
              <p className="text-gray-600 text-xs">
                Last update: {realTimeLastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // === EKRAN WYNIKÓW KOŃCOWYCH ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 flex items-center justify-center p-4">
      <motion.div
        className="max-w-md w-full text-center space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="space-y-3">
          {/* 🆕 ADDED: Real-time status in header */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-purple-500 to-violet-500 flex items-center justify-center">
              <Award className="w-10 h-10 text-white" />
            </div>

            {/* 🆕 ADDED: Real-time indicator for final results */}
            {!isConnected && (
              <button
                onClick={handleManualRefresh}
                className="absolute top-4 right-4 p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Manual refresh"
              >
                <WifiOff className="w-4 h-4 text-yellow-400" />
              </button>
            )}

            {isConnected && (
              <div className="absolute top-4 right-4 flex items-center space-x-1 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs">Live</span>
              </div>
            )}
          </div>

          <h1 className="text-4xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
            Final Results
          </h1>
          <p className="text-gray-400">All participants have completed the quiz!</p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <motion.ol variants={itemVariants} className="space-y-3 text-left">
            {rankedResults.map((result, index) => (
              <motion.li
                key={result.userId}
                variants={itemVariants}
                className={`p-4 rounded-xl border flex items-center space-x-4 transition-all duration-300
                  ${index === 0 ? 'border-yellow-400/50 bg-yellow-900/20' : ''}
                  ${index === 1 ? 'border-gray-400/50 bg-gray-800/20' : ''}
                  ${index === 2 ? 'border-orange-400/50 bg-orange-900/20' : ''}
                  ${index > 2 ? 'border-gray-700/50 bg-gray-900/30' : ''}
                `}
              >
                <div className="text-2xl font-bold w-10 text-center">
                  {result.medal || result.rank}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{result.displayName || result.username}</p>
                  <p className="text-sm text-gray-400">{result.platform}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono text-purple-300">{result.totalTime}s</p>
                  <p className="text-xs text-gray-500">Time</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        )}

        {/* 🆕 ADDED: Real-time info footer */}
        {realTimeLastUpdate && (
          <motion.div variants={itemVariants} className="text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isConnected ? 'bg-green-400' : 'bg-yellow-400'
              }`}></div>
              <span className="text-gray-500 text-xs">
                Updated: {realTimeLastUpdate.toLocaleTimeString()}
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}