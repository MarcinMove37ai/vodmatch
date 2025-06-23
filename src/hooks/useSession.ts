// src/hooks/useSession.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AppSession,
  ClientSession,
  SessionProfile,
  QuizResults
} from '@/types/session'
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'
import { SocialProfile } from '@/types/social'
import { sessionManager, ClientSessionManager } from '@/lib/sessionManager'

interface UseSessionReturn {
  // Stan sesji
  session: AppSession | null
  clientSession: ClientSession | null
  isLoading: boolean
  error: string | null

  // Metody zarządzania sesją
  createSession: () => Promise<boolean>
  loadSession: (sessionId?: string) => Promise<boolean>
  clearSession: () => void

  // Metody aktualizacji sesji
  updatePlatforms: (platforms: StreamingPlatform[]) => Promise<boolean>
  updateMode: (mode: ViewingMode) => Promise<boolean>
  updateAdminProfile: (socialProfile: SocialProfile) => Promise<boolean>
  updateParticipantProfile: (socialProfile: SocialProfile) => Promise<boolean>
  submitQuizResults: (results: QuizResults) => Promise<boolean>

  // Metody uczestników
  joinSession: (sessionId: string) => Promise<boolean>

  // NOWE: Metody admin control
  closeRegistration: () => Promise<boolean>
  startQuiz: () => Promise<boolean>
  getParticipantStatus: () => { ready: number, total: number }

  // Pomocnicze
  isAdmin: boolean
  canContinue: boolean
  refreshSession: () => Promise<boolean>
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<AppSession | null>(null)
  const [clientSession, setClientSession] = useState<ClientSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Konwertuj SocialProfile na SessionProfile
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

  // Załaduj sesję z serwera - Z TRZEMA PARAMETRAMI!
  const loadSessionFromServer = useCallback(async (sessionId: string, silent = false, skipClearOnError = false): Promise<boolean> => {
    try {
      setIsLoading(true)
      if (!silent) setError(null)

      console.log(`🔄 Loading session from server: ${sessionId}`)

      const response = await fetch(`/api/session/${sessionId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Session not found or expired')
        }
        throw new Error(`Failed to load session: ${response.status}`)
      }

      const sessionData: AppSession = await response.json()
      setSession(sessionData)

      // Aktualizuj timestamp w localStorage
      if (clientSession) {
        ClientSessionManager.updateLastSync(sessionId)
      }

      console.log(`✅ Session loaded successfully: ${sessionId}`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // Nie loguj błędów w trybie silent (startup/createSession)
      if (!silent) {
        console.error('❌ Failed to load session:', errorMessage)
        setError(errorMessage)
      } else {
        console.log(`⚠️ Session load failed (silent mode): ${errorMessage}`)
      }

      // KLUCZOWA ZMIANA: Jeśli sesja nie istnieje, wyczyść localStorage (ale nie przy createSession!)
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

  // Załaduj sesję z localStorage przy starcie
  useEffect(() => {
    const saved = ClientSessionManager.getClientSession()
    if (saved) {
      setClientSession(saved)
      // Automatycznie załaduj sesję z serwera (silent mode, pozwól wyczyścić localStorage jeśli sesja jest stara)
      loadSessionFromServer(saved.sessionId, true, false)
    }
  }, [])

  // Utwórz nową sesję
  const createSession = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Wygeneruj nowy userId
      const userId = sessionManager.generateUserId()

      console.log(`🆕 Creating new session for user: ${userId}`)

      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`)
      }

      const { sessionId, expiresAt } = await response.json()

      // Zapisz do localStorage
      const newClientSession: ClientSession = {
        sessionId,
        userId,
        isAdmin: true,
        lastSync: new Date()
      }

      ClientSessionManager.saveClientSession(newClientSession)
      setClientSession(newClientSession)

      console.log(`💾 Session saved to localStorage: ${sessionId}`)

      // KLUCZOWA ZMIANA: Załaduj sesję z serwera z skipClearOnError=true
      // Nie usuwaj localStorage jeśli serwer nie ma jeszcze sesji (Next.js dev mode problem)
      const loadSuccess = await loadSessionFromServer(sessionId, true, true)

      if (!loadSuccess) {
        console.log('⚠️ Session load failed but localStorage preserved for next interaction')
      }

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

  // Załaduj istniejącą sesję
  const loadSession = useCallback(async (sessionId?: string): Promise<boolean> => {
    const targetSessionId = sessionId || clientSession?.sessionId

    if (!targetSessionId) {
      setError('No session ID provided')
      return false
    }

    return await loadSessionFromServer(targetSessionId, false, false)
  }, [clientSession, loadSessionFromServer])

  // Wyczyść sesję
  const clearSession = useCallback((): void => {
    console.log('🗑️ Clearing session')
    ClientSessionManager.clearClientSession()
    setClientSession(null)
    setSession(null)
    setError(null)
  }, [])

  // Ogólna funkcja do aktualizacji sesji
  const updateSession = useCallback(async (action: string, data: any): Promise<boolean> => {
    if (!clientSession) {
      setError('No active session')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log(`🔄 Updating session ${clientSession.sessionId}, action: ${action}`)

      const response = await fetch(`/api/session/${clientSession.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: clientSession.userId,
          ...data
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update session: ${response.status}`)
      }

      const updatedSession: AppSession = await response.json()
      setSession(updatedSession)

      // Aktualizuj timestamp
      ClientSessionManager.updateLastSync(clientSession.sessionId)

      console.log(`✅ Session updated successfully, new status: ${updatedSession.status}`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to update session:', errorMessage)
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [clientSession])

  // Aktualizuj platformy
  const updatePlatforms = useCallback(async (platforms: StreamingPlatform[]): Promise<boolean> => {
    return await updateSession('update_platforms', { platforms })
  }, [updateSession])

  // Aktualizuj tryb
  const updateMode = useCallback(async (mode: ViewingMode): Promise<boolean> => {
    return await updateSession('update_mode', { mode })
  }, [updateSession])

  // Aktualizuj profil admina
  const updateAdminProfile = useCallback(async (socialProfile: SocialProfile): Promise<boolean> => {
    const sessionProfile = convertToSessionProfile(socialProfile)

    // NOWE: Jeśli mamy pełne dane sesji z frontend, wyślij je wszystkie
    if (session && clientSession) {
      return await updateSession('update_admin_profile', {
        profile: sessionProfile,
        // Dodaj pełne dane sesji dla recovery
        sessionData: {
          selectedPlatforms: session.selectedPlatforms,
          viewingMode: session.viewingMode
        }
      })
    } else {
      return await updateSession('update_admin_profile', { profile: sessionProfile })
    }
  }, [updateSession, convertToSessionProfile, session, clientSession])

  // Aktualizuj profil uczestnika
  const updateParticipantProfile = useCallback(async (socialProfile: SocialProfile): Promise<boolean> => {
    const sessionProfile = convertToSessionProfile(socialProfile)
    return await updateSession('update_participant_profile', { profile: sessionProfile })
  }, [updateSession, convertToSessionProfile])

  // Wyślij wyniki quizu
  const submitQuizResults = useCallback(async (results: QuizResults): Promise<boolean> => {
    if (!clientSession || !session) {
      setError('No active session')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log(`📝 Submitting quiz results for session ${session.sessionId}`)

      const response = await fetch(`/api/session/${session.sessionId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: clientSession.userId,
          results
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to submit quiz: ${response.status}`)
      }

      const updatedSession: AppSession = await response.json()
      setSession(updatedSession)

      console.log(`✅ Quiz results submitted successfully`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to submit quiz:', errorMessage)
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [clientSession, session])

  // Dołącz do sesji
  const joinSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Wygeneruj userId dla uczestnika
      const userId = sessionManager.generateUserId()

      console.log(`🤝 Joining session ${sessionId} as user ${userId}`)

      const response = await fetch(`/api/session/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.status}`)
      }

      const { success, session: joinedSession } = await response.json()

      if (!success) {
        throw new Error('Failed to join session')
      }

      // Zapisz do localStorage jako uczestnik
      const newClientSession: ClientSession = {
        sessionId,
        userId,
        isAdmin: false,
        lastSync: new Date()
      }

      ClientSessionManager.saveClientSession(newClientSession)
      setClientSession(newClientSession)
      setSession(joinedSession)

      console.log(`✅ Successfully joined session: ${sessionId}`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('❌ Failed to join session:', errorMessage)
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // NOWA METODA 1: Zamknij rejestrację (admin only)
  const closeRegistration = useCallback(async (): Promise<boolean> => {
    if (!clientSession || !clientSession.isAdmin) {
      setError('Only admin can close registration')
      return false
    }

    console.log(`🚪 Closing registration for session ${clientSession.sessionId}`)
    return await updateSession('close_registration', {})
  }, [clientSession, updateSession])

  // NOWA METODA 2: Rozpocznij quiz (admin only)
  const startQuiz = useCallback(async (): Promise<boolean> => {
    if (!clientSession || !clientSession.isAdmin) {
      setError('Only admin can start quiz')
      return false
    }

    console.log(`🎯 Starting quiz for session ${clientSession.sessionId}`)
    return await updateSession('start_quiz', {})
  }, [clientSession, updateSession])

  // NOWA METODA 3: Pobierz status uczestników
const getParticipantStatus = useCallback((): { ready: number, total: number } => {
  // 🔧 TYPE CASTING: Access profiles from real session data
  const sessionWithProfiles = session as any

  if (!sessionWithProfiles?.profiles) {
    return { ready: 0, total: 0 }
  }

  // Filtruj uczestników (nie admin)
  const participants = sessionWithProfiles.profiles.filter((p: any) => !p.isAdmin)

  // Sprawdź ilu ma prawdziwe profile (nie temp_user123)
  const ready = participants.filter((p: any) =>
    p.username && p.username !== `temp_${p.userId.slice(-8)}`
  ).length

  console.log(`📊 Participant status: ${ready}/${participants.length} ready`)
  return { ready, total: participants.length }
}, [session])

  // Odśwież sesję
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!clientSession) return false
    return await loadSessionFromServer(clientSession.sessionId, false, false)
  }, [clientSession, loadSessionFromServer])

  // Computed properties
  const isAdmin = clientSession?.isAdmin ?? false
  const canContinue = session ?
    (session.selectedPlatforms?.length > 0 &&
     session.viewingMode !== null &&
     session.adminProfile !== null) : false

  return {
    // Stan
    session,
    clientSession,
    isLoading,
    error,

    // Metody
    createSession,
    loadSession,
    clearSession,
    updatePlatforms,
    updateMode,
    updateAdminProfile,
    updateParticipantProfile,
    submitQuizResults,
    joinSession,
    refreshSession,

    // NOWE: Admin control metody
    closeRegistration,
    startQuiz,
    getParticipantStatus,

    // Computed
    isAdmin,
    canContinue
  }
}