// src/components/QRCodeScreen.tsx - WERSJA Z POPRAWIONĄ LOGIKĄ AKTYWACJI PRZYCISKU
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Copy, CheckCircle, Clock, ArrowRight, WifiOff } from 'lucide-react'

interface QRCodeScreenProps {
  sessionId: string
  session: any
  realTimeConnected?: boolean
  realTimeConnectionState?: string
  realTimeEventCount?: number
  realTimeLastUpdate?: Date | null
  realTimeReconnect?: () => void
  onCloseRegistration: () => void
  onRefreshSession: () => Promise<void>
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

export default function QRCodeScreen({
  sessionId,
  session,
  realTimeConnected = false,
  realTimeConnectionState = 'disconnected',
  realTimeEventCount = 0,
  realTimeLastUpdate = null,
  realTimeReconnect,
  onCloseRegistration,
  onRefreshSession
}: QRCodeScreenProps) {

  const isConnected = realTimeConnected
  const lastUpdate = realTimeLastUpdate
  const reconnect = realTimeReconnect

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [isGeneratingQR, setIsGeneratingQR] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)

  const joinUrl = `${window.location.origin}/join/${sessionId}`

  const participants: Participant[] = session?.profiles?.map((profile: any) => {
    const hasRealProfile = profile.username && profile.username !== `temp_${profile.userId.slice(-8)}`
    return {
      userId: profile.userId,
      username: profile.username,
      pic_url: profile.pic_url,
      platform: profile.platform,
      isAdmin: profile.isAdmin,
      hasJoined: hasRealProfile,
      createdAt: profile.createdAt
    }
  }) || []

  const adminProfile = participants.find(p => p.isAdmin)
  const participantProfiles = participants.filter(p => !p.isAdmin)
  const joinedParticipants = participantProfiles.filter(p => p.hasJoined)

  // ZMIANA 1: Nowa, czytelna flaga określająca, czy wszyscy dołączyli
  const allParticipantsHaveJoined = participantProfiles.length > 0 && joinedParticipants.length === participantProfiles.length;

  const generateQRCode = useCallback(async () => {
    try {
      setIsGeneratingQR(true)
      if (typeof window !== 'undefined') {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=000000`
        const img = new Image()
        img.onload = () => {
          setQrCodeDataUrl(qrApiUrl)
          setIsGeneratingQR(false)
        }
        img.onerror = () => {
          setIsGeneratingQR(false)
        }
        img.src = qrApiUrl
      }
    } catch (error) {
      setIsGeneratingQR(false)
    }
  }, [joinUrl])

  useEffect(() => {
    generateQRCode()
  }, [generateQRCode])

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('❌ Failed to copy URL:', error)
    }
  }

  const handleManualRefresh = async () => {
    if (isConnected && reconnect) {
      reconnect()
    } else {
      await onRefreshSession()
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900 relative overflow-hidden">
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
          <motion.div variants={itemVariants} className="text-center space-y-3">
            <h1 className="text-3xl font-light bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight">
              Invite Participants
            </h1>
            <div className="w-16 h-px bg-gradient-to-r from-blue-600/60 via-purple-600/60 to-transparent mx-auto"></div>
            <p className="text-gray-400 font-light text-sm">
              Share this code or link with your friends
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <div className="rounded-2xl p-6 backdrop-blur-sm border bg-gradient-to-r from-blue-950/20 to-cyan-950/20 border-blue-800/30">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  {isGeneratingQR ? (
                    <div className="w-48 h-48 bg-white/10 border border-gray-600 rounded-xl flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-500 text-xs">Generating QR...</p>
                      </div>
                    </div>
                  ) : qrCodeDataUrl ? (
                    <div className="p-4 bg-white rounded-xl shadow-lg">
                      <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48"/>
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-white/10 border border-gray-600 rounded-xl flex items-center justify-center p-4">
                      <div className="text-center space-y-2">
                        <p className="text-gray-400 text-xs">QR Generation Failed</p>
                        <button onClick={generateQRCode} className="text-blue-400 text-xs hover:text-blue-300 underline">Retry</button>
                        <p className="text-gray-500 text-xs break-all">{joinUrl.replace(window.location.origin, '').substring(0, 20)}...</p>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={copyJoinUrl} className="w-full py-3 px-4 bg-gradient-to-r from-gray-700/50 to-gray-600/50 hover:from-gray-600/70 hover:to-gray-500/70 text-white font-light rounded-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-2">
                  {copySuccess ? (
                    <><CheckCircle className="w-4 h-4 text-green-400" /> <span className="text-green-400">Link Copied!</span></>
                  ) : (
                    <><Copy className="w-4 h-4" /> <span>Copy Join Link</span></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300 font-light">Participants</span>
                </div>
                {!isConnected && (
                  <button onClick={handleManualRefresh} className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors" title={isConnected ? "Reconnect real-time updates" : "Manual refresh"}>
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
              <div className="space-y-3">
                {adminProfile && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-700/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500">
                        {adminProfile.pic_url ? <img src={adminProfile.pic_url} alt="Admin" className="w-full h-full rounded-full object-cover"/> : <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><span className="text-white text-xs font-medium">{adminProfile.username.charAt(0).toUpperCase()}</span></div>}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-light">@{adminProfile.username}</p>
                        <p className="text-blue-400 text-xs">Session Host • {adminProfile.platform}</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                )}
                {participantProfiles.map((participant) => (
                  <motion.div key={participant.userId} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className={`p-3 rounded-xl bg-gradient-to-r from-gray-900/40 to-gray-800/30 border border-gray-700/50 transition-all duration-300 ${isConnected && participant.hasJoined ? 'ring-1 ring-green-400/20' : ''}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500">
                        {participant.pic_url ? <img src={participant.pic_url} alt="Participant" className="w-full h-full rounded-full object-cover"/> : <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><span className="text-white text-xs font-medium">{participant.username.charAt(0).toUpperCase()}</span></div>}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-light">@{participant.hasJoined ? participant.username : 'Participant'}</p>
                        <p className="text-gray-400 text-xs">{participant.hasJoined ? `${participant.platform} • Profile added` : 'Adding profile...'}</p>
                      </div>
                      {participant.hasJoined ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-yellow-400" />}
                    </div>
                  </motion.div>
                ))}
                {participantProfiles.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for participants to join...</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            {/* ZMIANA 2: Użycie nowej flagi do sterowania przyciskiem */}
            <button
              onClick={onCloseRegistration}
              disabled={!allParticipantsHaveJoined}
              className={`w-full py-4 px-6 font-light rounded-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center space-x-3 ${
                allParticipantsHaveJoined
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border border-green-600/20 hover:border-green-500/40'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border border-gray-600/20 cursor-not-allowed opacity-50'
              }`}
            >
              {/* ZMIANA 3: Dynamiczny tekst przycisku */}
              <span>
                {allParticipantsHaveJoined
                  ? 'Close Registration & Continue'
                  : participantProfiles.length > 0
                  ? `Waiting for profiles... (${joinedParticipants.length}/${participantProfiles.length})`
                  : 'Waiting for participants...'
                }
              </span>
              {allParticipantsHaveJoined && <ArrowRight className="w-5 h-5" />}
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center space-y-2">
            <div className="inline-flex items-center space-x-4 px-4 py-2 rounded-full bg-gray-900/40 border border-gray-700/40 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                <span className="text-gray-400 text-xs font-medium">Session {sessionId}</span>
              </div>
              <div className="w-px h-4 bg-gray-600/50"></div>
              <span className="text-gray-500 text-xs font-light">
                {typeof session?.viewingMode === 'string' ? session.viewingMode : session?.viewingMode?.displayName || 'Unknown'} Mode
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}