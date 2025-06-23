// src/app/join/[sessionId]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, X, User } from 'lucide-react'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import DesktopBlocker from '@/components/DesktopBlocker'
import { sessionManager } from '@/lib/sessionManager'

interface JoinPreviewData {
  sessionId: string
  viewingMode: string
  selectedPlatforms: string[]
  adminProfile: {
    displayName: string
    profilePicUrl: string | null
    platform: string
    username: string
  } | null
  participantCount: number
  maxParticipants: number
  status: string
  canJoin: boolean
  createdAt: string
  expiresAt: string
}

interface Props {
  params: Promise<{ sessionId: string }>
}

export default function JoinSessionPage({ params }: Props) {
  const { isMobile } = useDeviceDetection()
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [sessionData, setSessionData] = useState<JoinPreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string>('')

  // Extract sessionId from params
  useEffect(() => {
    params.then(({ sessionId: id }) => {
      setSessionId(id.toUpperCase())
    })
  }, [params])

  // Load session preview data
  useEffect(() => {
    if (!sessionId) return

    const loadSessionPreview = async () => {
      try {
        setIsLoading(true)
        setError('')

        console.log(`🔍 Loading session preview: ${sessionId}`)

        const response = await fetch(`/api/session/${sessionId}/join`)

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Session not found or expired')
          }
          throw new Error(`Failed to load session: ${response.status}`)
        }

        const data: JoinPreviewData = await response.json()
        setSessionData(data)

        console.log(`✅ Session preview loaded:`, data)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('❌ Failed to load session preview:', errorMessage)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadSessionPreview()
  }, [sessionId])

  // Handle join session
  const handleJoinSession = async () => {
    if (!sessionData || !sessionData.canJoin) return

    try {
      setIsJoining(true)
      setError('')

      // Generate new userId for participant
      const userId = sessionManager.generateUserId()

      console.log(`🤝 Joining session ${sessionId} as user ${userId}`)

      const response = await fetch(`/api/session/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to join session: ${response.status}`)
      }

      const joinResult = await response.json()

      if (!joinResult.success) {
        throw new Error('Failed to join session')
      }

      console.log(`✅ Successfully joined session: ${sessionId}`)

      // Save participant session to localStorage
      localStorage.setItem('vodmatch_session', JSON.stringify({
        sessionId: sessionId,
        userId: userId,
        isAdmin: false,
        lastSync: new Date()
      }))

      // Redirect to main app
      router.push('/')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to join session:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  // Handle reject/cancel
  const handleReject = () => {
    router.push('/')
  }

  // Show desktop blocker on desktop
  if (!isMobile) {
    return <DesktopBlocker />
  }

  // Animation variants
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
          className="max-w-sm w-full space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Loading state */}
          {isLoading && (
            <motion.div variants={itemVariants} className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-400 font-light">Loading session...</p>
            </motion.div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <motion.div variants={itemVariants} className="text-center space-y-6">
              <div className="space-y-3">
                <h1 className="text-3xl font-light bg-gradient-to-r from-red-400 via-red-300 to-red-500 bg-clip-text text-transparent tracking-tight">
                  Session Not Found
                </h1>
                <div className="w-16 h-px bg-gradient-to-r from-red-600/60 via-red-500/60 to-transparent mx-auto"></div>
                <p className="text-gray-400 font-light text-sm leading-relaxed">
                  {error}
                </p>
              </div>

              <button
                onClick={handleReject}
                className="w-full py-4 px-6 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white font-light rounded-xl transition-all duration-300 hover:scale-[1.02]"
              >
                Go Back
              </button>
            </motion.div>
          )}

          {/* Session preview */}
          {sessionData && !isLoading && !error && (
            <>
              {/* Header */}
              <motion.div variants={itemVariants} className="text-center space-y-3">
                <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
                  Join Session
                </h1>
                <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
                <p className="text-gray-400 font-light text-sm leading-relaxed">
                  You've been invited to a VodMatch session
                </p>
              </motion.div>

              {/* Admin Profile Section */}
              {sessionData.adminProfile && (
                <motion.div variants={itemVariants}>
                  <div className="rounded-2xl p-6 backdrop-blur-sm border bg-gradient-to-r from-blue-950/20 to-cyan-950/20 border-blue-800/30">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500">
                          {sessionData.adminProfile.profilePicUrl ? (
                            <img
                              src={sessionData.adminProfile.profilePicUrl}
                              alt="Host profile"
                              className="w-full h-full rounded-full object-cover border-2 border-white"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                              <User className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-white font-light text-xl">
                          @{sessionData.adminProfile.username}
                        </h3>
                        <p className="text-blue-400 text-sm">
                          invites you to VodMatch
                        </p>
                        <p className="text-gray-500 text-xs">
                          {sessionData.adminProfile.platform === 'instagram' ? 'Instagram' : 'LinkedIn'} Profile
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Session status warning */}
              {!sessionData.canJoin && (
                <motion.div variants={itemVariants}>
                  <div className="text-center">
                    <p className="text-red-400 text-sm">
                      Session is not accepting new participants
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Error message */}
              {error && (
                <motion.div variants={itemVariants}>
                  <div className="text-red-400 text-sm text-center font-light">
                    {error}
                  </div>
                </motion.div>
              )}

              {/* Action buttons */}
              <motion.div variants={itemVariants} className="flex space-x-3">
                <button
                  onClick={handleReject}
                  disabled={isJoining}
                  className="flex-1 py-4 px-6 border border-gray-700 text-gray-300 font-light rounded-xl hover:border-gray-600 hover:text-white transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={handleJoinSession}
                  disabled={!sessionData.canJoin || isJoining}
                  className={`flex-1 py-4 px-6 font-light rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                    sessionData.canJoin && !isJoining
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border border-blue-600/20 hover:border-blue-500/40'
                      : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed'
                  }`}
                >
                  {isJoining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>

              {/* Session ID display */}
              <motion.div variants={itemVariants} className="text-center">
                <p className="text-gray-600 text-xs font-light">
                  Session ID: {sessionData.sessionId}
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}