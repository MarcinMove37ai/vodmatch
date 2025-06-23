// lib/sessionDb.ts - KOMPLETNIE ZAKTUALIZOWANA WERSJA Z POPRAWKAMI QUIZ LOOP
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

// 🆕 QUIZ TYPES: Add quiz result types
interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number // czas w sekundach
}

interface QuizResults {
  userId: string
  displayName: string
  answers: QuizAnswer[]
  completedAt: Date
  totalTime: number // całkowity czas quizu w sekundach
  questionsCount: number
}

export class SessionDatabase {
  // 🆕 UNIFIED HELPER: Single source of truth for quiz completion check
  private isQuizResultComplete(quizResult: any): boolean {
    return !!(quizResult &&
             typeof quizResult === 'object' &&
             (quizResult as any).completedAt &&
             Array.isArray((quizResult as any).answers) &&
             (quizResult as any).totalTime !== undefined &&
             (quizResult as any).answers.length > 0)
  }

  // Generate unique session ID
  private async generateSessionId(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

    for (let attempts = 0; attempts < 5; attempts++) {
      let sessionId = ''
      for (let i = 0; i < 6; i++) {
        sessionId += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      // Check if exists
      const existing = await prisma.session.findUnique({
        where: { sessionId }
      })

      if (!existing) {
        return sessionId
      }
    }

    throw new Error('Failed to generate unique session ID')
  }

  // Create new session
  async createSession(adminId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = await this.generateSessionId()
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

    const session = await prisma.session.create({
      data: {
        sessionId,
        adminId,
        expiresAt
      }
    })

    console.log(`✅ Created session: ${sessionId} for admin: ${adminId}`)
    return { sessionId: session.sessionId, expiresAt: session.expiresAt }
  }

  // 🎯 UPDATED: Get session by ID - includes profiles
  async getSession(sessionId: string): Promise<any | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        include: {
          profiles: true // 🎯 Include related profiles
        }
      })

      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`)
        return null
      }

      // Check if expired
      if (new Date() > session.expiresAt) {
        console.log(`⏰ Session expired: ${sessionId}`)
        // Clean up expired session (cascades to profiles)
        await prisma.session.delete({
          where: { sessionId: sessionId.toUpperCase() }
        })
        return null
      }

      // 🎯 BACKWARDS COMPATIBILITY: Add adminProfile for frontend
      const adminProfile = session.profiles.find(p => p.isAdmin)
      const sessionWithLegacyFields = {
        ...session,
        adminProfile: adminProfile ? {
          platform: adminProfile.platform,
          username: adminProfile.username,
          profilePicUrl: adminProfile.pic_url,
          displayName: adminProfile.username, // Simple mapping
          followers_count: null, // Will be in posts field
          profilepic_url: adminProfile.pic_url
        } : null
      }

      console.log(`✅ Session found: ${sessionId}, status: ${session.status}, profiles: ${session.profiles.length}`)
      return sessionWithLegacyFields

    } catch (error) {
      console.error(`❌ Error getting session ${sessionId}:`, error)
      return null
    }
  }

  // Update current step (screen)
  async updateCurrentStep(sessionId: string, currentStep: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          currentStep
        }
      })

      console.log(`✅ Updated currentStep for session ${sessionId}: ${currentStep}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating currentStep for session ${sessionId}:`, error)
      return false
    }
  }

  // 🆕 NEW: Update session status (recruiting, collecting_profiles, quiz_active, etc.)
  async updateStatus(sessionId: string, status: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          status
        }
      })

      console.log(`✅ Updated status for session ${sessionId}: ${status}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating status for session ${sessionId}:`, error)
      return false
    }
  }

  // Update session platforms
  async updatePlatforms(sessionId: string, platforms: any[]): Promise<boolean> {
    try {
      // Convert platform objects to string array if needed
      let platformIds: string[]

      if (platforms.length > 0 && typeof platforms[0] === 'object' && platforms[0].id) {
        // Frontend sent StreamingPlatform objects - extract IDs
        platformIds = platforms.map(p => p.id)
        console.log(`🔄 Converting platform objects to IDs:`, platformIds)
      } else {
        // Already string array
        platformIds = platforms as string[]
      }

      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          selectedPlatforms: platformIds,
          currentStep: 'mode' // Auto-progress to next step
        }
      })

      console.log(`✅ Updated platforms for session ${sessionId}:`, platformIds)
      return true
    } catch (error) {
      console.error(`❌ Error updating platforms for session ${sessionId}:`, error)
      return false
    }
  }

  // Update session mode
  async updateMode(sessionId: string, mode: any): Promise<boolean> {
    try {
      // Convert mode object to string if needed
      let modeId: string

      if (typeof mode === 'object' && mode.id) {
        // Frontend sent ViewingMode object - extract ID
        modeId = mode.id
        console.log(`🔄 Converting mode object to ID: ${modeId}`)
      } else {
        // Already string
        modeId = mode as string
      }

      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          viewingMode: modeId,
          currentStep: 'profile' // Auto-progress to next step
        }
      })

      console.log(`✅ Updated mode for session ${sessionId}: ${modeId}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating mode for session ${sessionId}:`, error)
      return false
    }
  }

  // 🔧 FIXED: saveUserProfile - don't create empty quiz_result
  async saveUserProfile(
    sessionId: string,
    userId: string,
    profileData: {
      platform: 'instagram' | 'linkedin',
      username: string,
      pic_url?: string,
      posts?: string
    },
    isAdmin: boolean = false
  ): Promise<boolean> {
    try {
      console.log(`💾 Saving profile for user ${userId} in session ${sessionId}`)

      // Upsert profile (update if exists, create if not)
      await prisma.sessionProfile.upsert({
        where: {
          sessionId_userId: {
            sessionId: sessionId.toUpperCase(),
            userId: userId
          }
        },
        create: {
          sessionId: sessionId.toUpperCase(),
          userId: userId,
          platform: profileData.platform,
          username: profileData.username,
          pic_url: profileData.pic_url || null,
          posts: profileData.posts || null,
          // 🆕 FIXED: Don't create empty quiz_result that confuses completion logic
          quiz_result: Prisma.JsonNull,
          seen: [],
          isAdmin: isAdmin
        },
        update: {
          platform: profileData.platform,
          username: profileData.username,
          pic_url: profileData.pic_url || null,
          posts: profileData.posts || null,
          isAdmin: isAdmin
        }
      })

      // 🎯 KLUCZOWA POPRAWKA: Różny flow dla admina w zależności od trybu sesji
      if (isAdmin) {
        // Sprawdź tryb sesji
        const session = await prisma.session.findUnique({
          where: { sessionId: sessionId.toUpperCase() }
        })

        if (session?.viewingMode === 'solo') {
          // 🆕 OPCJA A: Solo - wywołaj startQuiz który obsłuży status + background analysis
          await this.startQuiz(sessionId)
          console.log(`🎯 Solo session: Started quiz with background analysis`)
        } else {
          // ✅ POPRAWKA: Multi-user przechodzi do recruiting (pozwala dołączać!)
          await prisma.session.update({
            where: { sessionId: sessionId.toUpperCase() },
            data: {
              currentStep: 'recruiting',
              status: 'recruiting'  // ✅ Ten status pozwala na dołączanie!
            }
          })
          console.log(`🎯 Multi-user session: Updated to recruiting phase - participants can now join!`)
        }
      } else {
        // Uczestnik dodał profil - sprawdź czy wszyscy gotowi
        const allProfiles = await this.getSessionProfiles(sessionId)
        const participantProfiles = allProfiles.filter(p => !p.isAdmin)
        const joinedParticipants = participantProfiles.filter(p =>
          p.platform && p.username && p.username !== `temp_${p.userId.slice(-8)}`
        )

        console.log(`📊 Session progress: ${joinedParticipants.length}/${participantProfiles.length} participants have real profiles`)

        // Jeśli wszyscy uczestnicy mają profile, admin może zacząć quiz
        if (joinedParticipants.length === participantProfiles.length &&
            participantProfiles.length > 0) {
          await prisma.session.update({
            where: { sessionId: sessionId.toUpperCase() },
            data: {
              status: 'ready_for_quiz',
              currentStep: 'ready_for_quiz'
            }
          })
          console.log(`🎯 All participants ready - admin can start quiz`)
        }
      }

      console.log(`✅ Saved profile for user ${userId}: ${profileData.platform}/${profileData.username}`)
      return true

    } catch (error) {
      console.error(`❌ Error saving profile for user ${userId}:`, error)
      return false
    }
  }

  // 🎯 NEW: Get user profile from session
  async getUserProfile(sessionId: string, userId: string): Promise<any | null> {
    try {
      const profile = await prisma.sessionProfile.findUnique({
        where: {
          sessionId_userId: {
            sessionId: sessionId.toUpperCase(),
            userId: userId
          }
        }
      })

      return profile
    } catch (error) {
      console.error(`❌ Error getting profile for user ${userId}:`, error)
      return null
    }
  }

  // 🎯 NEW: Get all profiles for session
  async getSessionProfiles(sessionId: string): Promise<any[]> {
    try {
      const profiles = await prisma.sessionProfile.findMany({
        where: {
          sessionId: sessionId.toUpperCase()
        },
        orderBy: [
          { isAdmin: 'desc' }, // Admin first
          { createdAt: 'asc' }  // Then by creation time
        ]
      })

      return profiles
    } catch (error) {
      console.error(`❌ Error getting profiles for session ${sessionId}:`, error)
      return []
    }
  }

  // 🆕 NEW METHOD: Admin zamyka rejestrację
  async closeRegistration(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          status: 'collecting_profiles',
          currentStep: 'collecting_profiles'
        }
      })
      console.log(`✅ Registration closed for session ${sessionId} - no more participants can join`)
      return true
    } catch (error) {
      console.error(`❌ Error closing registration:`, error)
      return false
    }
  }

  // 🆕 NEW METHOD: Admin startuje quiz + TRIGGER SOCIAL ANALYSIS + AUTO-FETCH BACKGROUND API
  async startQuiz(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          status: 'quiz_active',
          currentStep: 'quiz'
        }
      })

      // 🆕 TRIGGER SOCIAL ANALYSIS: Set profiles for background analysis
      await this.setSocialAnalysisPending(sessionId)

      // 🆕 AUTO-START BACKGROUND ANALYSIS: Call the API endpoint (FIRE AND FORGET - nie czekamy na wynik!)
      console.log(`🚀 Starting background social analysis for session ${sessionId} (non-blocking)`)

      // KLUCZOWA ZMIANA: NIE UŻYWAMY AWAIT - pozwalamy temu działać w tle
      this.triggerBackgroundAnalysis(sessionId)
        .then(() => {
          console.log(`✅ Background analysis completed successfully for session ${sessionId}`)
        })
        .catch((error) => {
          console.log(`⚠️ Background analysis failed for session ${sessionId}:`, error)
          // Nie failujemy - to nie jest krytyczne
        })

      console.log(`✅ Quiz started for session ${sessionId} + social analysis triggered (background API started)`)
      return true
    } catch (error) {
      console.error(`❌ Error starting quiz:`, error)
      return false
    }
  }

  // 🆕 QUIZ RESULTS: Save quiz results to database - ENHANCED VERSION Z LEPSZYM LOGGINGIEM
  async saveQuizResults(
    sessionId: string,
    userId: string,
    quizResults: QuizResults
  ): Promise<boolean> {
    try {
      console.log(`💾 Saving quiz results for user ${userId} in session ${sessionId}`)

      // 🎯 SIMPLIFIED FORMAT: Only store essential data for ranking
      const simplifiedQuizResult = {
        userId: quizResults.userId,
        displayName: quizResults.displayName,
        totalTime: quizResults.totalTime, // For ranking (fastest first)
        // 🆕 POPRAWKA: Używaj new Date() dla pewności
        completedAt: new Date(quizResults.completedAt).toISOString(),
        // 🎯 SIMPLIFIED: Just the answer letters in order (A,B,C,D...)
        answers: quizResults.answers.map(answer => answer.selectedOption) // ["A", "B", "C", "D", ...]
      }

      console.log(`📝 Simplified quiz result:`, {
        userId: simplifiedQuizResult.userId,
        displayName: simplifiedQuizResult.displayName,
        totalTime: simplifiedQuizResult.totalTime,
        answers: simplifiedQuizResult.answers.join(',') // "A,B,C,D,A,B,C,D,A,B"
      })

      // Update user profile with quiz results
      const result = await prisma.sessionProfile.updateMany({
        where: {
          sessionId: sessionId.toUpperCase(),
          userId: userId
        },
        data: {
          quiz_result: simplifiedQuizResult
        }
      })

      if (result.count === 0) {
        console.log(`⚠️ No profile found for user ${userId} in session ${sessionId}`)
        return false
      }

      console.log(`✅ Quiz results saved for user ${userId}:`, {
        totalTime: simplifiedQuizResult.totalTime,
        answersCount: simplifiedQuizResult.answers.length,
        answersPattern: simplifiedQuizResult.answers.join(',')
      })

      // 🆕 IMMEDIATE LOGGING: Show current completion status
      const statusBefore = await this.getQuizCompletionStatus(sessionId)
      console.log(`📊 Quiz status BEFORE check:`, statusBefore)

      // 🎯 CHECK IF ALL PARTICIPANTS COMPLETED QUIZ
      const completionResult = await this.checkQuizCompletion(sessionId)

      // 🆕 IMMEDIATE LOGGING: Show status after completion check
      const statusAfter = await this.getQuizCompletionStatus(sessionId)
      console.log(`📊 Quiz status AFTER check:`, statusAfter)

      if (completionResult) {
        console.log(`🎉 Quiz completion triggered session transition to results!`)
      } else {
        console.log(`⏳ Quiz completion check did not trigger transition - waiting for more participants`)
      }

      return true

    } catch (error) {
      console.error(`❌ Error saving quiz results for user ${userId}:`, error)
      return false
    }
  }

  // 🔧 FIXED: checkQuizCompletion - use unified logic
  async checkQuizCompletion(sessionId: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking quiz completion for session ${sessionId}`)

      // Get all profiles for session
      const profiles = await this.getSessionProfiles(sessionId)

      // 🆕 ENHANCED LOGGING: Show each profile's state
      console.log(`📊 Total profiles found: ${profiles.length}`)
      profiles.forEach(profile => {
        const isComplete = this.isQuizResultComplete(profile.quiz_result)
        const hasAnyResult = !!profile.quiz_result && typeof profile.quiz_result === 'object'
        console.log(`  👤 ${profile.username} (${profile.isAdmin ? 'admin' : 'participant'}): ${isComplete ? '✅ completed' : '❌ not completed'} (hasAnyResult: ${hasAnyResult})`)

        // 🆕 DEBUG: Show quiz_result structure if not complete but has some data
        if (hasAnyResult && !isComplete) {
          const result = profile.quiz_result as any
          console.log(`    🔍 quiz_result debug: completedAt=${!!result.completedAt}, answers=${Array.isArray(result.answers) ? result.answers.length : 'not array'}, totalTime=${result.totalTime}`)
        }
      })

      // 🆕 FIXED: Use unified completion filter
      const profilesWithQuizResults = profiles.filter(profile =>
        this.isQuizResultComplete(profile.quiz_result)
      )

      const totalParticipants = profiles.length
      const completedQuizzes = profilesWithQuizResults.length

      console.log(`📊 Quiz completion status: ${completedQuizzes}/${totalParticipants} completed`)

      // 🆕 IMPROVED CONDITION: More explicit check
      const allCompleted = completedQuizzes === totalParticipants && totalParticipants > 0
      const sessionShouldTransition = allCompleted

      console.log(`🎯 Should transition to results? ${sessionShouldTransition} (all completed: ${allCompleted}, has participants: ${totalParticipants > 0})`)

      // If all participants completed quiz, change session status to results
      if (sessionShouldTransition) {
        const updateResult = await prisma.session.update({
          where: { sessionId: sessionId.toUpperCase() },
          data: {
            status: 'results',
            currentStep: 'results'
          }
        })

        console.log(`🏆 All participants completed quiz! Session ${sessionId} moved to results`)
        console.log(`✅ Database update result:`, {
          sessionId: updateResult.sessionId,
          status: updateResult.status,
          currentStep: updateResult.currentStep
        })

        // 🎯 BONUS: Log the final ranking
        try {
          const results = await this.getQuizResults(sessionId)
          console.log(`🏆 FINAL RANKING for session ${sessionId}:`)
          results.forEach(r =>
            console.log(`  ${r.medal} ${r.rank}. ${r.username} - ${r.totalTime}s`)
          )
        } catch (rankingError) {
          console.log(`⚠️ Could not generate ranking:`, rankingError)
        }

        return true
      }

      console.log(`⏳ Waiting for more participants to complete quiz: ${completedQuizzes}/${totalParticipants}`)
      return false

    } catch (error) {
      console.error(`❌ Error checking quiz completion for session ${sessionId}:`, error)
      return false
    }
  }

  // 🔧 FIXED: getQuizCompletionStatus - use same logic as frontend
  async getQuizCompletionStatus(sessionId: string): Promise<{
    totalProfiles: number,
    completedProfiles: number,
    pendingProfiles: any[],
    allCompleted: boolean,
    sessionStatus: string | null
  }> {
    try {
      const profiles = await this.getSessionProfiles(sessionId)
      const session = await this.getSession(sessionId)

      // 🆕 FIXED: Use unified completion check
      const completedProfiles = profiles.filter(profile =>
        this.isQuizResultComplete(profile.quiz_result)
      )

      const pendingProfiles = profiles.filter(profile =>
        !this.isQuizResultComplete(profile.quiz_result)
      ).map(p => ({
        userId: p.userId,
        username: p.username,
        isAdmin: p.isAdmin,
        hasQuizResult: !!p.quiz_result && typeof p.quiz_result === 'object',
        hasValidQuizResult: this.isQuizResultComplete(p.quiz_result) // 🆕 DEBUG
      }))

      const result = {
        totalProfiles: profiles.length,
        completedProfiles: completedProfiles.length,
        pendingProfiles,
        allCompleted: completedProfiles.length === profiles.length && profiles.length > 0,
        sessionStatus: session?.status || null
      }

      // 🆕 DEBUG: Enhanced logging
      console.log(`📊 UNIFIED Quiz completion status for ${sessionId}:`)
      console.log(`  Total: ${result.totalProfiles}`)
      console.log(`  Completed: ${result.completedProfiles}`)
      console.log(`  All completed: ${result.allCompleted}`)

      profiles.forEach(profile => {
        const isComplete = this.isQuizResultComplete(profile.quiz_result)
        const hasAnyResult = !!profile.quiz_result && typeof profile.quiz_result === 'object'
        console.log(`  👤 ${profile.username} (${profile.isAdmin ? 'admin' : 'participant'}): ${isComplete ? '✅ completed' : '❌ not completed'} (hasAnyResult: ${hasAnyResult})`)
      })

      return result
    } catch (error) {
      console.error(`❌ Error getting quiz completion status:`, error)
      return {
        totalProfiles: 0,
        completedProfiles: 0,
        pendingProfiles: [],
        allCompleted: false,
        sessionStatus: null
      }
    }
  }

  // 🆕 QUIZ RESULTS: Get quiz results for session (for ranking)
  async getQuizResults(sessionId: string): Promise<any[]> {
    try {
      console.log(`📊 Getting quiz results for session ${sessionId}`)

      const profiles = await prisma.sessionProfile.findMany({
        where: {
          sessionId: sessionId.toUpperCase()
        },
        select: {
          userId: true,
          username: true,
          platform: true,
          pic_url: true,
          isAdmin: true,
          quiz_result: true,
          createdAt: true
        }
      })

      // Filter and process profiles with quiz results
      const resultsWithRanking = profiles
        .filter(profile => {
          const quizResult = profile.quiz_result
          return quizResult &&
                 typeof quizResult === 'object' &&
                 (quizResult as any).completedAt &&
                 (quizResult as any).answers
        })
        .map(profile => {
          const quizResult = profile.quiz_result as any
          return {
            userId: profile.userId,
            username: profile.username,
            platform: profile.platform,
            pic_url: profile.pic_url,
            isAdmin: profile.isAdmin,
            displayName: quizResult.displayName || profile.username,
            completedAt: new Date(quizResult.completedAt),
            totalTime: quizResult.totalTime || 0,
            // 🎯 SIMPLIFIED: answers is now just array of letters ["A", "B", "C", ...]
            answers: Array.isArray(quizResult.answers) ? quizResult.answers : [],
            answersCount: Array.isArray(quizResult.answers) ? quizResult.answers.length : 0,
            // 🎯 SUMMARY: Show answer pattern for easy reading
            answerPattern: Array.isArray(quizResult.answers) ? quizResult.answers.join(',') : ''
          }
        })
        .sort((a, b) => a.totalTime - b.totalTime) // Sort by total time (fastest first)
        .map((result, index) => ({
          ...result,
          rank: index + 1,
          // 🏆 MEDAL: Add medal emoji for top 3
          medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
        }))

      console.log(`🏆 Quiz results ranking for session ${sessionId}:`)
      resultsWithRanking.forEach(r =>
        console.log(`  ${r.medal} ${r.rank}. ${r.username} - ${r.totalTime}s - [${r.answerPattern}]`)
      )

      return resultsWithRanking

    } catch (error) {
      console.error(`❌ Error getting quiz results for session ${sessionId}:`, error)
      return []
    }
  }

  // 🆕 HELPER METHOD: Separate background analysis trigger (działa w tle)
  private async triggerBackgroundAnalysis(sessionId: string): Promise<void> {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/background/social-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })

    if (!response.ok) {
      throw new Error(`Background analysis HTTP error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log(`📊 Background analysis results: processed ${result.processed} profiles, ${result.success} succeeded, ${result.errors} failed`)
  }

  // 🆕 SOCIAL MEDIA ANALYSIS: Set status for profiles when quiz starts
  async setSocialAnalysisPending(sessionId: string): Promise<boolean> {
    try {
      console.log(`🔄 Setting social analysis pending for session ${sessionId}`)

      // Sprawdź typ sesji
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: { viewingMode: true }
      })

      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`)
        return false
      }

      let whereCondition: any = {
        sessionId: sessionId.toUpperCase(),
        social_analysis_status: null // Only if not already processed
      }

      // 🎯 POPRAWIONA LOGIKA: W trybie solo tylko admin, w couple/group WSZYSCY
      if (session.viewingMode === 'solo') {
        // Solo: analizuj tylko admina
        whereCondition.isAdmin = true
        console.log(`🎯 Solo mode: analyzing admin profile only`)
      } else {
        // 🆕 POPRAWKA: Multi-user (couple/group) - analizuj WSZYSTKICH (admin + uczestników)
        // NIE DODAJEMY FILTRA isAdmin - chcemy wszystkich!
        console.log(`👥 Multi-user mode (${session.viewingMode}): analyzing ALL profiles (admin + participants)`)
      }

      // Update profiles to pending status
      const result = await prisma.sessionProfile.updateMany({
        where: whereCondition,
        data: {
          social_analysis_status: 'pending'
        }
      })

      console.log(`✅ Set ${result.count} profiles to pending analysis for ${session.viewingMode} session`)
      return true
    } catch (error) {
      console.error(`❌ Error setting social analysis pending:`, error)
      return false
    }
  }

  // 🆕 SOCIAL MEDIA ANALYSIS: Get profiles that need analysis
  async getProfilesForAnalysis(sessionId: string): Promise<any[]> {
    try {
      // Sprawdź typ sesji
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: { viewingMode: true }
      })

      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`)
        return []
      }

      let whereCondition: any = {
        sessionId: sessionId.toUpperCase(),
        social_analysis_status: 'pending'
      }

      // 🎯 POPRAWIONA LOGIKA: W trybie solo tylko admin, w couple/group WSZYSCY
      if (session.viewingMode === 'solo') {
        whereCondition.isAdmin = true
        console.log(`🎯 Solo mode: getting admin profile for analysis`)
      } else {
        // 🆕 POPRAWKA: Multi-user (couple/group) - pobierz WSZYSTKICH (admin + uczestników)
        // NIE DODAJEMY FILTRA isAdmin - chcemy wszystkich!
        console.log(`👥 Multi-user mode (${session.viewingMode}): getting ALL profiles for analysis (admin + participants)`)
      }

      const profiles = await prisma.sessionProfile.findMany({
        where: whereCondition,
        select: {
          id: true,
          userId: true,
          username: true,
          platform: true,
          social_analysis_status: true,
          isAdmin: true
        }
      })

      console.log(`📋 Found ${profiles.length} profiles needing analysis for ${session.viewingMode} session`)
      console.log(`👤 Profiles breakdown:`, profiles.map(p => `${p.username} (${p.isAdmin ? 'admin' : 'participant'})`).join(', '))

      return profiles
    } catch (error) {
      console.error(`❌ Error getting profiles for analysis:`, error)
      return []
    }
  }

  // 🆕 SOCIAL MEDIA ANALYSIS: Update status to in_progress
  async updateSocialAnalysisStatus(
    profileId: number,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    error?: string
  ): Promise<boolean> {
    try {
      await prisma.sessionProfile.update({
        where: { id: profileId },
        data: {
          social_analysis_status: status,
          social_analysis_error: error || null,
          social_analyzed_at: status === 'completed' || status === 'failed' ? new Date() : null
        }
      })

      console.log(`✅ Updated profile ${profileId} status to: ${status}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating analysis status:`, error)
      return false
    }
  }

  // 🆕 SOCIAL MEDIA ANALYSIS: Save analysis results
  async saveSocialAnalysisResults(
    profileId: number,
    postsData: string[],
    platform: 'instagram' | 'linkedin'
  ): Promise<boolean> {
    try {
      const socialPostsData = {
        posts: postsData,
        metadata: {
          total_posts_analyzed: postsData.length,
          platform: platform,
          analyzed_at: new Date().toISOString()
        }
      }

      await prisma.sessionProfile.update({
        where: { id: profileId },
        data: {
          social_posts: socialPostsData,
          social_analysis_status: 'completed',
          social_analyzed_at: new Date()
        }
      })

      console.log(`✅ Saved ${postsData.length} posts for profile ${profileId}`)
      return true
    } catch (error) {
      console.error(`❌ Error saving social analysis results:`, error)
      return false
    }
  }

  // 🆕 SOCIAL MEDIA ANALYSIS: Get analysis progress for session
  async getSocialAnalysisProgress(sessionId: string): Promise<{
    total: number,
    pending: number,
    in_progress: number,
    completed: number,
    failed: number
  }> {
    try {
      // Sprawdź typ sesji
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: { viewingMode: true }
      })

      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`)
        return { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 }
      }

      let whereCondition: any = {
        sessionId: sessionId.toUpperCase()
      }

      // 🎯 POPRAWIONA LOGIKA: W trybie solo tylko admin, w couple/group WSZYSCY
      if (session.viewingMode === 'solo') {
        whereCondition.isAdmin = true
      } else {
        // 🆕 POPRAWKA: Multi-user (couple/group) - sprawdź progress WSZYSTKICH (admin + uczestników)
        // NIE DODAJEMY FILTRA isAdmin - chcemy wszystkich!
      }

      const profiles = await prisma.sessionProfile.findMany({
        where: whereCondition,
        select: {
          social_analysis_status: true,
          isAdmin: true,
          username: true
        }
      })

      const stats = {
        total: profiles.length,
        pending: profiles.filter(p => p.social_analysis_status === 'pending').length,
        in_progress: profiles.filter(p => p.social_analysis_status === 'in_progress').length,
        completed: profiles.filter(p => p.social_analysis_status === 'completed').length,
        failed: profiles.filter(p => p.social_analysis_status === 'failed').length
      }

      console.log(`📊 Social analysis progress for ${sessionId} (${session.viewingMode}):`, stats)
      console.log(`👤 Profiles in analysis:`, profiles.map(p => `${p.username} (${p.isAdmin ? 'admin' : 'participant'}): ${p.social_analysis_status || 'null'}`).join(', '))

      return stats
    } catch (error) {
      console.error(`❌ Error getting social analysis progress:`, error)
      return { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 }
    }
  }

  // 🎯 DEPRECATED: Keep for compatibility but redirect to new method
  async updateAdminProfile(sessionId: string, profile: any): Promise<boolean> {
    console.log(`🔄 Redirecting updateAdminProfile to saveUserProfile...`)

    // Convert old profile format to new format
    const session = await prisma.session.findUnique({
      where: { sessionId: sessionId.toUpperCase() }
    })

    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`)
      return false
    }

    // Extract platform from profile data
    const platform = profile.platform || 'instagram' // Default fallback
    const username = profile.username || profile.displayName || 'unknown'
    const pic_url = profile.profilePicUrl || profile.profilepic_url || null

    // Create posts text from follower data
    let posts: string | undefined = undefined
    if (profile.followers_count || profile.posts_count || profile.followers || profile.connections) {
      const stats = []
      if (profile.followers_count) stats.push(`${profile.followers_count} followers`)
      if (profile.posts_count) stats.push(`${profile.posts_count} posts`)
      if (profile.followers) stats.push(`${profile.followers} followers`)
      if (profile.connections) stats.push(`${profile.connections} connections`)
      posts = stats.join(', ')
    }

    return await this.saveUserProfile(
      sessionId,
      session.adminId,
      {
        platform: platform as 'instagram' | 'linkedin',
        username: username,
        pic_url: pic_url,
        posts: posts
      },
      true // isAdmin = true
    )
  }

  // Delete specific session
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { sessionId: sessionId.toUpperCase() }
      })

      console.log(`✅ Deleted session: ${sessionId}`)
      return true
    } catch (error) {
      console.error(`❌ Error deleting session ${sessionId}:`, error)
      return false
    }
  }

  // Clean expired sessions
  async cleanExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      if (result.count > 0) {
        console.log(`🧹 Cleaned ${result.count} expired sessions`)
      }

      return result.count
    } catch (error) {
      console.error('❌ Error cleaning expired sessions:', error)
      return 0
    }
  }
}

// Export instance
export const sessionDb = new SessionDatabase()