'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Wifi, WifiOff, Clock, CheckCircle, ArrowRight, Trophy, Star } from 'lucide-react'

interface WaitingRoomScreenProps {
  sessionId: string
  session: any // Real-time session data from parent
  isAdmin: boolean
  // Real-time props from parent (analogiczne do QRCodeScreen)
  realTimeConnected?: boolean
  realTimeConnectionState?: string
  realTimeEventCount?: number
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  // Callback functions
  onStartQuiz: () => Promise<void>
  onRefreshSession: () => Promise<void>
  // Helper functions from useSession
  getParticipantStatus: () => { ready: number; total: number }
}

interface Participant {
  userId: string
  username: string
  pic_url: string | null
  platform: string
  isAdmin: boolean
  hasJoined: boolean
  createdAt: string
}

export default function WaitingRoomScreen({
  sessionId,
  session,
  isAdmin,
  realTimeConnected = false,
  realTimeConnectionState = 'disconnected',
  realTimeEventCount = 0,
  realTimeLastUpdate = null,
  realTimeReconnect,
  onStartQuiz,
  onRefreshSession,
  getParticipantStatus
}: WaitingRoomScreenProps) {

  // 🔧 SIMPLIFIED: Use props for connection status (like QRCodeScreen)
  const isConnected = realTimeConnected
  const connectionState = realTimeConnectionState
  const eventCount = realTimeEventCount
  const lastUpdate = realTimeLastUpdate
  const reconnect = realTimeReconnect

  const [isProcessing, setIsProcessing] = useState(false)

  // 🔧 FIXED: Identyczna logika parsowania jak w QRCodeScreen
  const participants: Participant[] = session?.profiles?.map((profile: any) => {
    // 🔧 FIXED: Spójna logika real profile detection z QRCodeScreen
    const hasRealProfile = profile.username && profile.username !== `temp_${profile.userId.slice(-8)}`

    return {
      userId: profile.userId,
      username: profile.username,
      pic_url: profile.pic_url,
      platform: profile.platform,
      isAdmin: profile.isAdmin,
      hasJoined: hasRealProfile, // 🔧 FIXED: Bazuje na username logic jak QRCodeScreen
      createdAt: profile.createdAt
    }
  }) || []

  const adminProfile = participants.find(p => p.isAdmin)
  const participantProfiles = participants.filter(p => !p.isAdmin)

  // 🔧 FIXED: Używamy hasJoined konsystentnie
  const joinedParticipants = participantProfiles.filter(p => p.hasJoined)

  // Get participant status using passed function
  const { ready, total } = getParticipantStatus()
  const allReady = ready === total && total > 0

  // 🔧 SIMPLIFIED: Debug logging (like QRCodeScreen)
  useEffect(() => {
    if (participants.length > 0) {
      console.log('🔍 WaitingRoomScreen Real-time DEBUG:', {
        isConnected,
        connectionState,
        eventCount,
        lastUpdate: lastUpdate?.toISOString(),
        totalProfiles: participants.length,
        adminProfile: adminProfile?.username,
        participantProfiles: participantProfiles.length,
        joinedParticipants: joinedParticipants.length,
        ready,
        total,
        allReady,
        participantDetails: participantProfiles.map(p => ({
          username: p.username,
          hasJoined: p.hasJoined,
          isTemp: p.username?.startsWith('temp_'),
          picUrlType: p.pic_url ?
            (p.pic_url.startsWith('/api/proxy-image') ? 'PROXY ✅' : 'DIRECT ⚠️') : 'NO PIC'
        }))
      })
    }
  }, [participants, adminProfile, participantProfiles, joinedParticipants, isConnected, connectionState, eventCount, lastUpdate, ready, total, allReady])

  // Handle start quiz with processing state
  const handleStartQuiz = async () => {
    setIsProcessing(true)
    try {
      await onStartQuiz()
    } catch (error) {
      console.error('❌ Error in WaitingRoomScreen handleStartQuiz:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // 🆕 FALLBACK: Manual refresh only when real-time is not working (like QRCodeScreen)
  const handleManualRefresh = async () => {
    if (isConnected && reconnect) {
      console.log('🔄 Real-time is working, attempting reconnect instead of manual refresh')
      reconnect()
    } else {
      console.log('🔄 Real-time not available, falling back to manual refresh')
      await onRefreshSession()
    }
  }

  // Animation variants (simplified like QRCodeScreen)
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/10 via-transparent to-violet-950/20"></div>
      <div className="absolute top-1/4 right-1/4 w-px h-24 bg-gradient-to-b from-transparent via-blue-600/40 to-transparent"></div>
      <div className="absolute bottom-1/3 left-1/3 w-24 h-px bg-gradient-to-r from-transparent via-purple-600/40 to-transparent"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          className="max-w-md w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              {isAdmin ? 'Session Ready' : 'Waiting Room'}
            </h1>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm">
              {isAdmin
                ? 'All participants have joined. Start the quiz when ready!'
                : 'Waiting for the host to start the Mood Quiz...'
              }
            </p>
          </motion.div>



          {/* Participants Section */}
          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              {/* Header - analogiczny do QRCodeScreen */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-300 font-light">
                    Participants
                  </span>
                </div>

                {/* 🆕 CONDITIONAL: Show manual refresh only if real-time not working */}
                {!isConnected && (
                  <button
                    onClick={handleManualRefresh}
                    className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                    title={isConnected ? "Reconnect real-time updates" : "Manual refresh"}
                  >
                    <WifiOff className="w-4 h-4 text-yellow-400" />
                  </button>
                )}

                {/* 🆕 REAL-TIME INDICATOR: Show when connected */}
                {isConnected && (
                  <div className="flex items-center space-x-1 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs">Live</span>
                  </div>
                )}
              </div>

              {/* Participants List - analogiczny do QRCodeScreen */}
              <div className="space-y-3">
                {/* Admin */}
                {adminProfile && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-700/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500">
                        {adminProfile.pic_url ? (
                          <img
                            src={adminProfile.pic_url}
                            alt="Admin"
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              console.log('❌ Admin profile image failed to load in waiting room');
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {adminProfile.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-white font-light">@{adminProfile.username}</p>
                        <p className="text-blue-400 text-xs">Session Host • {adminProfile.platform}</p>
                      </div>

                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                )}

                {/* Participants - analogiczne do QRCodeScreen */}
                {participantProfiles.map((participant) => (
                  <motion.div
                    key={participant.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`p-3 rounded-xl bg-gradient-to-r from-gray-900/40 to-gray-800/30 border border-gray-700/50 transition-all duration-300 ${
                      isConnected && participant.hasJoined ? 'ring-1 ring-green-400/20' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500">
                        {participant.pic_url ? (
                          <img
                            src={participant.pic_url}
                            alt="Participant"
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              console.log(`❌ Participant ${participant.username} profile image failed to load in waiting room`);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {participant.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-white font-light">
                          @{participant.hasJoined ? participant.username : 'Participant'}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {participant.hasJoined
                            ? `${participant.platform} • Profile added`
                            : 'Adding profile...'
                          }
                        </p>
                      </div>

                      {participant.hasJoined ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-400" />
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Empty state */}
                {participantProfiles.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for participants to join...</p>
                  </div>
                )}
              </div>

              {/* Progress indicator - analogiczne do QRCodeScreen */}
              {participantProfiles.length > 0 && (
                <div className="text-center space-y-1">
                  {joinedParticipants.length === participantProfiles.length && participantProfiles.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-green-400 text-xs font-medium"
                    >

                    </motion.p>
                  )}

                </div>
              )}
            </div>
          </motion.div>

          {/* Admin Actions */}
          {isAdmin && (
            <motion.div variants={itemVariants}>
              <button
                onClick={handleStartQuiz}
                disabled={!allReady || isProcessing}
                className={`w-full py-4 px-6 font-light rounded-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 ${
                  allReady && !isProcessing
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border border-green-600/20 hover:border-green-500/40'
                    : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed opacity-50'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Starting the show...</span>
                  </>
                ) : allReady ? (
                  <>
                    <span>Start Movie Quiz</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <span>
                      Waiting for {total - ready} more participant{total - ready !== 1 ? 's' : ''}...
                    </span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Prize Announcement */}
          <motion.div variants={itemVariants}>
            <div className="relative p-4 rounded-xl bg-gradient-to-r from-amber-900/30 via-yellow-900/20 to-orange-900/30 border border-amber-600/40 backdrop-blur-sm">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-orange-500/5 animate-pulse"></div>

              <div className="relative flex items-center justify-between">
                <div className="flex-shrink-0 pl-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>

                <div className="text-center flex-1">
                  <h3 className="text-amber-300 font-medium text-sm mb-1">
                    🏆 Special Prize Alert!
                  </h3>
                  <p className="text-amber-100/90 text-xs font-light leading-relaxed">
                    First to finish wins a <span className="text-amber-300 font-medium">special prize</span>!
                  </p>
                </div>

                <div className="flex-shrink-0 pr-2">
                  <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-2 right-2 w-1 h-1 bg-amber-400 rounded-full animate-ping"></div>
              <div className="absolute bottom-2 left-2 w-1 h-1 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
            </div>
          </motion.div>

          {/* Session info - analogiczne do QRCodeScreen */}
          <motion.div variants={itemVariants} className="text-center space-y-2">
            <div className="inline-flex items-center space-x-4 px-4 py-2 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  isConnected ? 'bg-green-400' : 'bg-blue-400'
                }`}></div>
                <span className="text-gray-400 text-xs font-medium">Session {sessionId}</span>
              </div>
              <div className="w-px h-4 bg-gray-600/50"></div>
              <span className="text-gray-500 text-xs font-light">
                {typeof session?.viewingMode === 'string'
                  ? session.viewingMode
                  : session?.viewingMode?.displayName || 'Unknown'
                } Mode
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}