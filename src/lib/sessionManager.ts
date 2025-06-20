// lib/sessionManager.ts
import {
  AppSession,
  SessionProfile,
  SessionParticipant,
  QuizResults,
  CreateSessionResponse,
  ClientSession
} from '@/types/session'
import { StreamingPlatform } from '@/types/platform'
import { ViewingMode } from '@/types/mode'

class SessionManager {
  private sessions: Map<string, AppSession> = new Map()

  // Generowanie unikalnego ID sesji (6 znaków)
  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // Sprawdź czy już istnieje (bardzo mała szansa kolizji)
    if (this.sessions.has(result)) {
      return this.generateSessionId() // Rekursywnie generuj nowy
    }

    return result
  }

  // Generowanie unikalnego userId
  generateUserId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `user_${timestamp}_${random}`
  }

  // Tworzenie nowej sesji
  createSession(adminId: string): CreateSessionResponse {
    const sessionId = this.generateSessionId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 godziny

    const session: AppSession = {
      sessionId,
      adminId,
      createdAt: now,
      expiresAt,
      adminProfile: null,
      selectedPlatforms: [],
      viewingMode: null,
      participants: [],
      quizResults: [],
      status: 'setup',
      currentStep: 'platforms',
      lastUpdated: now
    }

    this.sessions.set(sessionId, session)

    console.log(`✅ Created new session: ${sessionId} for admin: ${adminId}`)

    return {
      sessionId,
      userId: adminId,
      expiresAt
    }
  }

  // Pobieranie sesji
  getSession(sessionId: string): AppSession | null {
    const session = this.sessions.get(sessionId)

    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return null
    }

    // Sprawdź czy sesja nie wygasła
    if (new Date() > session.expiresAt) {
      console.log(`⏰ Session expired: ${sessionId}`)
      this.sessions.delete(sessionId)
      return null
    }

    return session
  }

  // Aktualizacja platform w sesji
  updatePlatforms(sessionId: string, userId: string, platforms: StreamingPlatform[]): boolean {
    const session = this.getSession(sessionId)
    if (!session || session.adminId !== userId) {
      console.log(`❌ Cannot update platforms: invalid session or user not admin`)
      return false
    }

    session.selectedPlatforms = platforms
    session.lastUpdated = new Date()

    console.log(`✅ Updated platforms for session ${sessionId}:`, platforms.map(p => p.displayName))
    return true
  }

  // Aktualizacja trybu w sesji
  updateMode(sessionId: string, userId: string, mode: ViewingMode): boolean {
    const session = this.getSession(sessionId)
    if (!session || session.adminId !== userId) {
      console.log(`❌ Cannot update mode: invalid session or user not admin`)
      return false
    }

    session.viewingMode = mode
    session.currentStep = mode.id === 'solo' ? 'admin_profile' : 'admin_profile'
    session.lastUpdated = new Date()

    console.log(`✅ Updated mode for session ${sessionId}: ${mode.displayName}`)
    return true
  }

  // Aktualizacja profilu admina
  updateAdminProfile(sessionId: string, userId: string, profile: SessionProfile): boolean {
    const session = this.getSession(sessionId)
    if (!session || session.adminId !== userId) {
      console.log(`❌ Cannot update admin profile: invalid session or user not admin`)
      return false
    }

    session.adminProfile = profile

    // Aktualizuj status w zależności od trybu
    if (session.viewingMode?.id === 'solo') {
      session.status = 'quiz'
      session.currentStep = 'quiz'
    } else {
      session.status = 'collecting_profiles'
      session.currentStep = 'waiting_for_participants'
    }

    session.lastUpdated = new Date()

    console.log(`✅ Updated admin profile for session ${sessionId}: ${profile.displayName}`)
    return true
  }

  // Dołączanie uczestnika do sesji
  joinSession(sessionId: string, participantId: string): boolean {
    const session = this.getSession(sessionId)
    if (!session) {
      console.log(`❌ Cannot join: session ${sessionId} not found`)
      return false
    }

    // Sprawdź czy to nie jest tryb solo
    if (session.viewingMode?.id === 'solo') {
      console.log(`❌ Cannot join solo session`)
      return false
    }

    // Sprawdź czy uczestnik już nie jest w sesji
    const existingParticipant = session.participants.find(p => p.participantId === participantId)
    if (existingParticipant) {
      console.log(`⚠️ Participant ${participantId} already in session ${sessionId}`)
      return true
    }

    // Sprawdź limit uczestników
    const maxParticipants = session.viewingMode?.id === 'couple' ? 1 : 7 // Admin + max 7 uczestników
    if (session.participants.length >= maxParticipants) {
      console.log(`❌ Session ${sessionId} is full`)
      return false
    }

    // Dodaj uczestnika
    const participant: SessionParticipant = {
      participantId,
      profile: null,
      joinedAt: new Date(),
      isReady: false,
      isOnline: true
    }

    session.participants.push(participant)
    session.lastUpdated = new Date()

    console.log(`✅ Participant ${participantId} joined session ${sessionId}`)
    return true
  }

  // Aktualizacja profilu uczestnika
  updateParticipantProfile(sessionId: string, participantId: string, profile: SessionProfile): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    const participant = session.participants.find(p => p.participantId === participantId)
    if (!participant) {
      console.log(`❌ Participant ${participantId} not found in session ${sessionId}`)
      return false
    }

    participant.profile = profile
    participant.isReady = true
    session.lastUpdated = new Date()

    // Sprawdź czy wszyscy uczestnicy są gotowi
    const allReady = session.participants.every(p => p.isReady)
    if (allReady && session.adminProfile) {
      session.status = 'quiz'
      session.currentStep = 'quiz'
    }

    console.log(`✅ Updated participant profile for ${participantId} in session ${sessionId}`)
    return true
  }

  // Zapisanie wyników quizu
  submitQuizResults(sessionId: string, userId: string, results: QuizResults): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    // Sprawdź czy użytkownik należy do sesji
    const isAdmin = session.adminId === userId
    const isParticipant = session.participants.some(p => p.participantId === userId)

    if (!isAdmin && !isParticipant) {
      console.log(`❌ User ${userId} not authorized for session ${sessionId}`)
      return false
    }

    // Usuń poprzednie wyniki tego użytkownika (jeśli istnieją)
    session.quizResults = session.quizResults.filter(r => r.userId !== userId)

    // Dodaj nowe wyniki
    session.quizResults.push(results)
    session.lastUpdated = new Date()

    // Sprawdź czy wszyscy ukończyli quiz
    const expectedCount = 1 + session.participants.length // Admin + uczestnicy
    if (session.quizResults.length >= expectedCount) {
      session.status = 'generating'
      session.currentStep = 'ai_generation'
    }

    console.log(`✅ Quiz results submitted for ${userId} in session ${sessionId}`)
    return true
  }

  // Pobieranie wszystkich aktywnych sesji (dla debugowania)
  getAllSessions(): AppSession[] {
    const now = new Date()
    const activeSessions: AppSession[] = []

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt > now) {
        activeSessions.push(session)
      } else {
        // Usuń wygasłe sesje
        this.sessions.delete(sessionId)
      }
    }

    return activeSessions
  }

  // Czyszczenie wygasłych sesji (wywoływane okresowo)
  cleanExpiredSessions(): number {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId)
        cleanedCount++
        console.log(`🗑️ Cleaned expired session: ${sessionId}`)
      }
    }

    return cleanedCount
  }

  // Statystyki sesji
  getStats() {
    const sessions = this.getAllSessions()
    return {
      totalSessions: sessions.length,
      soloSessions: sessions.filter(s => s.viewingMode?.id === 'solo').length,
      coupleSessions: sessions.filter(s => s.viewingMode?.id === 'couple').length,
      groupSessions: sessions.filter(s => s.viewingMode?.id === 'group').length,
      setupPhase: sessions.filter(s => s.status === 'setup').length,
      collectingProfiles: sessions.filter(s => s.status === 'collecting_profiles').length,
      quizPhase: sessions.filter(s => s.status === 'quiz').length,
      generating: sessions.filter(s => s.status === 'generating').length,
      results: sessions.filter(s => s.status === 'results').length,
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager()

// Helper functions for localStorage management
export const ClientSessionManager = {
  // Zapisz session info do localStorage
  saveClientSession(sessionData: ClientSession): void {
    try {
      localStorage.setItem('vodmatch_session', JSON.stringify(sessionData))
      console.log(`💾 Saved client session: ${sessionData.sessionId}`)
    } catch (error) {
      console.error('❌ Failed to save client session:', error)
    }
  },

  // Pobierz session info z localStorage
  getClientSession(): ClientSession | null {
    try {
      const stored = localStorage.getItem('vodmatch_session')
      if (!stored) return null

      const parsed = JSON.parse(stored) as ClientSession

      // Sprawdź czy sesja nie jest zbyt stara (4 godziny max w localStorage)
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
      if (new Date(parsed.lastSync) < fourHoursAgo) {
        console.log('🗑️ Client session too old, clearing')
        this.clearClientSession()
        return null
      }

      return parsed
    } catch (error) {
      console.error('❌ Failed to load client session:', error)
      return null
    }
  },

  // Wyczyść session info z localStorage
  clearClientSession(): void {
    try {
      localStorage.removeItem('vodmatch_session')
      console.log('🗑️ Cleared client session')
    } catch (error) {
      console.error('❌ Failed to clear client session:', error)
    }
  },

  // Aktualizuj timestamp ostatniej synchronizacji
  updateLastSync(sessionId: string): void {
    const current = this.getClientSession()
    if (current && current.sessionId === sessionId) {
      current.lastSync = new Date()
      this.saveClientSession(current)
    }
  }
}

export default sessionManager