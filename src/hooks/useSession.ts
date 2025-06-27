// src/hooks/useSession.ts - WERSJA Z POPRAWIONYM ZWRACANIEM DANYCH
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AppSession,
  ClientSession,
  SessionProfile
} from '@/types/session'
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'
import { sessionManager, ClientSessionManager } from '@/lib/sessionManager'

interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number
}

interface UseSessionReturn {
  session: AppSession | null
  clientSession: ClientSession | null
  isLoading: boolean
  error: string | null
  createSession: () => Promise<boolean>
  loadSession: (sessionId?: string) => Promise<boolean>
  clearSession: () => void
  updatePlatforms: (platforms: StreamingPlatform[]) => Promise<boolean>
  updateMode: (mode: ViewingMode) => Promise<boolean>
  // ZMIANA SYGNATURY: Zwraca obiekt sesji lub null
  updateAdminProfile: (socialProfile: SocialProfile) => Promise<AppSession | null>
  updateParticipantProfile: (socialProfile: SocialProfile) => Promise<boolean>
  submitQuizResults: (answers: QuizAnswer[]) => Promise<boolean>
  getQuizResults: () => Promise<any[]>
  joinSession: (sessionId: string) => Promise<boolean>
  closeRegistration: () => Promise<boolean>
  startQuiz: () => Promise<boolean>
  getParticipantStatus: () => { ready: number, total: number }
  isAdmin: boolean
  canContinue: boolean
  refreshSession: () => Promise<boolean>
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<AppSession | null>(null)
  const [clientSession, setClientSession] = useState<ClientSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const convertToSessionProfile = useCallback((socialProfile: SocialProfile): SessionProfile => {
    return {
      profilepic_url: socialProfile.profilepic_url,
      username: socialProfile.username,
      platform: socialProfile.platform,
      displayName: socialProfile.full_name || `@${socialProfile.username}`,
      profilePicUrl: socialProfile.profilepic_url,
      followers_count: socialProfile.followers_count,
      posts_count: socialProfile.posts_count,
      followers: socialProfile.followers,
      connections: socialProfile.connections,
      full_name: socialProfile.full_name,
      headline: socialProfile.headline
    }
  }, [])

  const loadSessionFromServer = useCallback(async (sessionId: string, silent = false, skipClearOnError = false): Promise<boolean> => {
    try {
      setIsLoading(true)
      if (!silent) setError(null)
      console.log(`🔄 Loading session from server: ${sessionId}`)
      const response = await fetch(`/api/session/${sessionId}`)
      if (!response.ok) {
        if (response.status === 404) { throw new Error('Session not found or expired') }
        throw new Error(`Failed to load session: ${response.status}`)
      }
      const sessionData: AppSession = await response.json()
      setSession(sessionData)
      if (clientSession) { ClientSessionManager.updateLastSync(sessionId) }
      console.log(`✅ Session loaded successfully: ${sessionId}`)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (!silent) {
        console.error('❌ Failed to load session:', errorMessage)
        setError(errorMessage)
      } else {
        console.log(`⚠️ Session load failed (silent mode): ${errorMessage}`)
      }
      if (errorMessage.includes('not found') && !skipClearOnError) {
        console.log('🗑️ Clearing localStorage due to session not found')
        ClientSessionManager.clearClientSession()
        setClientSession(null)
      } else if (skipClearOnError) {
        console.log('⚠️ Session not found, but skipClearOnError=true, keeping localStorage')
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [clientSession])

  useEffect(() => {
    const saved = ClientSessionManager.getClientSession()
    if (saved) {
      setClientSession(saved)
      loadSessionFromServer(saved.sessionId, true, false)
    }
  }, [])

  const createSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      const userId = sessionManager.generateUserId()
      console.log(`🆕 Creating new session for user: ${userId}`)
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (!response.ok) { throw new Error(`Failed to create session: ${response.status}`) }
      const { sessionId, expiresAt } = await response.json()
      const newClientSession: ClientSession = { sessionId, userId, isAdmin: true, lastSync: new Date() }
      ClientSessionManager.saveClientSession(newClientSession)
      setClientSession(newClientSession)
      console.log(`💾 Session saved to localStorage: ${sessionId}`)
      const loadSuccess = await loadSessionFromServer(sessionId, true, true)
      if (!loadSuccess) { console.log('⚠️ Session load failed but localStorage preserved for next interaction') }
      console.log(`✅ Session created successfully: ${sessionId}`)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to create session:', errorMessage)
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [loadSessionFromServer])

  const loadSession = useCallback(async (sessionId?: string): Promise<boolean> => {
    const targetSessionId = sessionId || clientSession?.sessionId
    if (!targetSessionId) {
      setError('No session ID provided')
      return false
    }
    return await loadSessionFromServer(targetSessionId, false, false)
  }, [clientSession, loadSessionFromServer])

  const clearSession = useCallback((): void => {
    console.log('🗑️ Clearing session')
    ClientSessionManager.clearClientSession()
    setClientSession(null)
    setSession(null)
    setError(null)
  }, [])

  // ‼️ KLUCZOWA ZMIANA 1: Ta funkcja zwraca teraz obiekt sesji lub null
  const updateSession = useCallback(async (action: string, data: any): Promise<AppSession | null> => {
    if (!clientSession) {
      setError('No active session')
      return null
    }
    try {
      setIsLoading(true)
      setError(null)
      console.log(`🔄 Updating session ${clientSession.sessionId}, action: ${action}`)
      const response = await fetch(`/api/session/${clientSession.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId: clientSession.userId, ...data })
      })
      if (!response.ok) { throw new Error(`Failed to update session: ${response.status}`) }
      const updatedSession: AppSession = await response.json()
      setSession(updatedSession)
      ClientSessionManager.updateLastSync(clientSession.sessionId)
      console.log(`✅ Session updated successfully, new status: ${updatedSession.status}`)
      return updatedSession // Zwraca obiekt sesji
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to update session:', errorMessage)
      setError(errorMessage)
      return null // Zwraca null w przypadku błędu
    } finally {
      setIsLoading(false)
    }
  }, [clientSession])

  // Pozostałe funkcje dostosowane, aby nadal zwracały boolean
  const updatePlatforms = useCallback(async (platforms: StreamingPlatform[]): Promise<boolean> => {
    const result = await updateSession('update_platforms', { platforms });
    return !!result;
  }, [updateSession])

  const updateMode = useCallback(async (mode: ViewingMode): Promise<boolean> => {
    const result = await updateSession('update_mode', { mode });
    return !!result;
  }, [updateSession])

  // ‼️ KLUCZOWA ZMIANA 2: Ta funkcja przekazuje dalej obiekt sesji
  const updateAdminProfile = useCallback(async (socialProfile: SocialProfile): Promise<AppSession | null> => {
    const sessionProfile = convertToSessionProfile(socialProfile)
    return await updateSession('update_admin_profile', { profile: sessionProfile })
  }, [updateSession, convertToSessionProfile])

  const updateParticipantProfile = useCallback(async (socialProfile: SocialProfile): Promise<boolean> => {
    const sessionProfile = convertToSessionProfile(socialProfile)
    const result = await updateSession('update_participant_profile', { profile: sessionProfile });
    return !!result;
  }, [updateSession, convertToSessionProfile])

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!clientSession) return false
    return await loadSessionFromServer(clientSession.sessionId, false, false)
  }, [clientSession, loadSessionFromServer])

  const getQuizResults = useCallback(async (): Promise<any[]> => {
    if (!clientSession || !session) { return [] }
    try {
      const response = await fetch(`/api/session/${session.sessionId}/quiz-results`)
      if (!response.ok) { throw new Error(`Failed to get quiz results: ${response.status}`) }
      return await response.json()
    } catch (err) { return [] }
  }, [clientSession, session])

  const submitQuizResults = useCallback(async (answers: QuizAnswer[]): Promise<boolean> => {
    if (!clientSession || !session) {
      setError('No active session')
      return false
    }
    try {
      setIsLoading(true)
      setError(null)
      const totalTime = answers.reduce((sum, answer) => sum + answer.timeSpent, 0)
      const sessionWithProfiles = session as any
      const userProfile = sessionWithProfiles.profiles?.find((p: any) => p.userId === clientSession.userId)
      const quizResults = { userId: clientSession.userId, displayName: userProfile?.username || clientSession.userId, answers: answers, completedAt: new Date(), totalTime: Math.round(totalTime), questionsCount: answers.length }
      const response = await fetch(`/api/session/${session.sessionId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: clientSession.userId, quizResults: quizResults })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to submit quiz: ${response.status}`)
      }
      await response.json()
      await refreshSession()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [clientSession, session, refreshSession])

  const joinSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      const userId = sessionManager.generateUserId()
      const response = await fetch(`/api/session/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (!response.ok) { throw new Error(`Failed to join session: ${response.status}`) }
      const { success, session: joinedSession } = await response.json()
      if (!success) { throw new Error('Failed to join session') }
      const newClientSession: ClientSession = { sessionId, userId, isAdmin: false, lastSync: new Date() }
      ClientSessionManager.saveClientSession(newClientSession)
      setClientSession(newClientSession)
      setSession(joinedSession)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const closeRegistration = useCallback(async (): Promise<boolean> => {
    if (!clientSession || !clientSession.isAdmin) {
      setError('Only admin can close registration')
      return false
    }
    const result = await updateSession('close_registration', {})
    return !!result
  }, [clientSession, updateSession])

  const startQuiz = useCallback(async (): Promise<boolean> => {
    if (!clientSession || !clientSession.isAdmin) {
      setError('Only admin can start quiz')
      return false
    }
    const result = await updateSession('start_quiz', {});
    return !!result
  }, [clientSession, updateSession])

  const getParticipantStatus = useCallback((): { ready: number, total: number } => {
    const sessionWithProfiles = session as any
    if (!sessionWithProfiles?.profiles) { return { ready: 0, total: 0 } }
    const participants = sessionWithProfiles.profiles.filter((p: any) => !p.isAdmin)
    const ready = participants.filter((p: any) => p.username && p.username !== `temp_${p.userId.slice(-8)}`).length
    return { ready, total: participants.length }
  }, [session])

  const isAdmin = clientSession?.isAdmin ?? false
  const canContinue = session ? (session.selectedPlatforms?.length > 0 && session.viewingMode !== null && session.adminProfile !== null) : false

  return {
    session,
    clientSession,
    isLoading,
    error,
    createSession,
    loadSession,
    clearSession,
    updatePlatforms,
    updateMode,
    updateAdminProfile,
    updateParticipantProfile,
    submitQuizResults,
    getQuizResults,
    joinSession,
    refreshSession,
    closeRegistration,
    startQuiz,
    getParticipantStatus,
    isAdmin,
    canContinue
  }
}