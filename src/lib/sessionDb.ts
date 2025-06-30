// lib/sessionDb.ts
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

import {
  broadcastSessionStatusChanged,
  broadcastSessionUpdate
} from '../app/api/session/[id]/events/route'

interface QuizAnswer {
  questionId: number
  selectedOption: 'A' | 'B' | 'C' | 'D'
  answeredAt: Date
  timeSpent: number
}

interface QuizResults {
  userId: string
  displayName: string
  answers: QuizAnswer[]
  completedAt: Date
  totalTime: number
  questionsCount: number
}

interface MoviePick {
    movieId: string;
    vote: 'watched' | 'not_watched';
}

// Typ dla finalnego głosu dla większej czytelności
interface FinalVote {
  movieId: string;
  timeTaken: number;
}

export class SessionDatabase {
  private isQuizResultComplete(quizResult: any): boolean {
    return !!(quizResult &&
             typeof quizResult === 'object' &&
             (quizResult as any).completedAt &&
             Array.isArray((quizResult as any).answers) &&
             (quizResult as any).totalTime !== undefined &&
             (quizResult as any).answers.length > 0)
  }

  private async generateSessionId(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for (let attempts = 0; attempts < 5; attempts++) {
      let sessionId = ''
      for (let i = 0; i < 6; i++) {
        sessionId += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      const existing = await prisma.session.findUnique({ where: { sessionId } })
      if (!existing) {
        return sessionId
      }
    }
    throw new Error('Failed to generate unique session ID')
  }

  private async checkAndTriggerVectorSearch(sessionId: string): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: {
          llm_movies: true,
          movie_preferences: true
        }
      })

      if (!session) {
        console.log(`⚠️ [Vector Search Check] Session not found: ${sessionId}`)
        return
      }

      if (session.llm_movies && session.movie_preferences) {
        console.log(`✅ [Vector Search Check] Both conditions met for ${sessionId} - triggering vector search`)
        this.triggerMovieVectorSearch(sessionId).catch((error) => {
          console.log(`⚠️ [Movie Vector Search] Failed for session ${sessionId}:`, error)
        })
      } else {
        console.log(`⏳ [Vector Search Check] Conditions not met for ${sessionId}:`, {
          llm_movies: !!session.llm_movies,
          movie_preferences: !!session.movie_preferences
        })
      }
    } catch (error) {
      console.error(`❌ [Vector Search Check] Error for session ${sessionId}:`, error)
    }
  }

  private async triggerLLMCharacterization(profileId: number): Promise<void> {
    try {
      console.log(`🤖 [LLM Characterization] Starting for profileId: ${profileId}`)

      const profile = await prisma.sessionProfile.findUnique({
        where: { id: profileId },
        select: { userId: true, username: true, sessionId: true }
      })

      if (!profile) {
        console.log(`❌ [LLM Characterization] Profile not found for profileId: ${profileId}`)
        return
      }

      console.log(`🤖 [LLM Characterization] Triggering for user: ${profile.username} (${profile.userId})`)

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/llm-characterization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.userId })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [LLM Characterization] HTTP error ${response.status}: ${errorText}`)
        return
      }

      const result = await response.json()

      if (result.success) {
        console.log(`✅ [LLM Characterization] Success for ${profile.username}: "${result.characterization}" (${result.length} chars)`)

        try {
          await broadcastSessionUpdate(profile.sessionId, 'llm_characterization_completed')
          console.log(`📤 [LLM Characterization] Broadcast sent for session ${profile.sessionId}`)
        } catch (broadcastError) {
          console.log(`⚠️ [LLM Characterization] Broadcast failed:`, broadcastError)
        }
      } else {
        console.error(`❌ [LLM Characterization] API error for ${profile.username}:`, result.error)
      }

    } catch (error) {
      console.error(`❌ [LLM Characterization] Failed for profileId ${profileId}:`, error)
    }
  }

  private async triggerMovieRecommendations(sessionId: string): Promise<void> {
    try {
      console.log(`🎬 [Movie Recommendations] Starting for session: ${sessionId}`)

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/movie-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [Movie Recommendations] HTTP error ${response.status}: ${errorText}`)
        return
      }

      const result = await response.json()

      if (result.success) {
        console.log(`✅ [Movie Recommendations] Success for session ${sessionId}: ${result.concepts?.length || 0} concepts generated`)

        console.log(`🔍 [Movie Recommendations] Checking conditions for vector search...`)
        this.checkAndTriggerVectorSearch(sessionId)

        try {
          await broadcastSessionUpdate(sessionId, 'movie_recommendations_ready')
          console.log(`📤 [Movie Recommendations] Broadcast sent for session ${sessionId}`)
        } catch (broadcastError) {
          console.log(`⚠️ [Movie Recommendations] Broadcast failed:`, broadcastError)
        }
      } else {
        console.error(`❌ [Movie Recommendations] API error for session ${sessionId}:`, result.error)
      }

    } catch (error) {
      console.error(`❌ [Movie Recommendations] Failed for session ${sessionId}:`, error)
    }
  }

  private async triggerMovieVectorSearch(sessionId: string): Promise<void> {
    try {
      console.log(`🔍 [Movie Vector Search] Starting for session: ${sessionId}`)

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/movie-vector-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [Movie Vector Search] HTTP error ${response.status}: ${errorText}`)
        return
      }

      const result = await response.json()

      if (result.success) {
        console.log(`✅ [Movie Vector Search] Success for session ${sessionId}: ${result.totalMoviesFound || 0} movies found`)

        try {
          await broadcastSessionUpdate(sessionId, 'movie_search_completed')
          console.log(`📤 [Movie Vector Search] Broadcast sent for session ${sessionId}`)
        } catch (broadcastError) {
          console.log(`⚠️ [Movie Vector Search] Broadcast failed:`, broadcastError)
        }
      } else {
        console.error(`❌ [Movie Vector Search] API error for session ${sessionId}:`, result.error)
      }

    } catch (error) {
      console.error(`❌ [Movie Vector Search] Failed for session ${sessionId}:`, error)
    }
  }

  private async checkAndTriggerMovieRecommendations(sessionId: string): Promise<void> {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: { group_analysis: true }
      })

      if (!session?.group_analysis) {
        console.log(`⏳ [Movie Recommendations Check] No group analysis yet for ${sessionId}`)
        return
      }

      const socialProgress = await this.getSocialAnalysisProgress(sessionId)
      const hasCompletedAnalysis = socialProgress.completed > 0 || socialProgress.failed > 0

      if (hasCompletedAnalysis) {
        console.log(`✅ [Movie Recommendations Check] Social analysis ready for ${sessionId} (${socialProgress.completed} completed, ${socialProgress.failed} failed) - triggering movie recommendations`)
        this.triggerMovieRecommendations(sessionId).catch((error) => {
          console.log(`⚠️ [Movie Recommendations] Failed for session ${sessionId}:`, error)
        })
      } else {
        console.log(`⏳ [Movie Recommendations Check] Social analysis not ready for ${sessionId} (${socialProgress.pending} pending, ${socialProgress.in_progress} in progress)`)
      }
    } catch (error) {
      console.error(`❌ [Movie Recommendations Check] Error for session ${sessionId}:`, error)
    }
  }

  // ✅ NOWA FUNKCJA: Broadcast zakończenia sesji do wszystkich uczestników
  async broadcastSessionFinish(sessionId: string): Promise<boolean> {
    try {
      console.log(`🏁 [Session Finish] Broadcasting session finish for: ${sessionId}`);

      // Wyślij broadcast do wszystkich uczestników
      await broadcastSessionUpdate(sessionId, 'session_finished');

      console.log(`✅ [Session Finish] Successfully broadcasted session finish for: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`❌ [Session Finish] Failed to broadcast finish for ${sessionId}:`, error);
      return false;
    }
  }

  async createSession(adminId: string): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = await this.generateSessionId()
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
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

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        include: {
          profiles: true
        }
      })
      if (!session) {
        console.log(`❌ Session not found: ${sessionId}`)
        return null
      }
      if (new Date() > session.expiresAt) {
        console.log(`⏰ Session expired: ${sessionId}`)
        await prisma.session.delete({ where: { sessionId: sessionId.toUpperCase() } })
        return null
      }
      const adminProfile = session.profiles.find(p => p.isAdmin)
      const sessionWithLegacyFields = {
        ...session,
        adminProfile: adminProfile ? {
          platform: adminProfile.platform,
          username: adminProfile.username,
          profilePicUrl: adminProfile.pic_url,
          displayName: adminProfile.username,
          followers_count: null,
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

  async updatePlatforms(sessionId: string, platforms: any[]): Promise<boolean> {
    try {
      let platformIds: string[] = (platforms.length > 0 && typeof platforms[0] === 'object' && platforms[0].id)
        ? platforms.map(p => p.id)
        : platforms as string[]
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          selectedPlatforms: platformIds,
          currentStep: 'mode'
        }
      })
      console.log(`✅ Updated platforms for session ${sessionId}:`, platformIds)
      return true
    } catch (error) {
      console.error(`❌ Error updating platforms for session ${sessionId}:`, error)
      return false
    }
  }

  async updateMode(sessionId: string, mode: any): Promise<boolean> {
    try {
      let modeId: string = (typeof mode === 'object' && mode.id) ? mode.id : mode as string
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          viewingMode: modeId,
          currentStep: 'profile'
        }
      })
      console.log(`✅ Updated mode for session ${sessionId}: ${modeId}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating mode for session ${sessionId}:`, error)
      return false
    }
  }

  async setMoviePreferences(sessionId: string, moviePreferences: { excludedGenres: string[], minImdbRating: number }): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          movie_preferences: moviePreferences
        }
      })
      console.log(`✅ Updated movie preferences for session ${sessionId}:`, moviePreferences)

      console.log(`🔍 [Movie Preferences] Checking conditions for vector search...`)
      this.checkAndTriggerVectorSearch(sessionId)

      return true
    } catch (error) {
      console.error(`❌ Error updating movie preferences for session ${sessionId}:`, error)
      return false
    }
  }

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
      await prisma.sessionProfile.upsert({
        where: {
          sessionId_userId: { sessionId: sessionId.toUpperCase(), userId: userId }
        },
        create: { sessionId: sessionId.toUpperCase(), userId: userId, platform: profileData.platform, username: profileData.username, pic_url: profileData.pic_url || null, posts: profileData.posts || null, quiz_result: Prisma.JsonNull, seen: [], isAdmin: isAdmin },
        update: { platform: profileData.platform, username: profileData.username, pic_url: profileData.pic_url || null, posts: profileData.posts || null, isAdmin: isAdmin }
      })
      if (isAdmin) {
        const session = await prisma.session.findUnique({ where: { sessionId: sessionId.toUpperCase() } })
        if (session?.viewingMode === 'solo') {
          await this.startQuiz(sessionId)
        } else {
          await prisma.session.update({ where: { sessionId: sessionId.toUpperCase() }, data: { currentStep: 'recruiting', status: 'recruiting' } })
        }
      } else {
        const allProfiles = await this.getSessionProfiles(sessionId)
        const participantProfiles = allProfiles.filter(p => !p.isAdmin)
        const joinedParticipants = participantProfiles.filter(p => p.platform && p.username && !p.username.startsWith('temp_'))
        if (joinedParticipants.length === participantProfiles.length && participantProfiles.length > 0) {
          await prisma.session.update({ where: { sessionId: sessionId.toUpperCase() }, data: { status: 'ready_for_quiz', currentStep: 'ready_for_quiz' } })
        }
      }
      return true
    } catch (error) {
      return false
    }
  }

  async getUserProfile(sessionId: string, userId: string): Promise<any | null> {
    try {
      return await prisma.sessionProfile.findUnique({ where: { sessionId_userId: { sessionId: sessionId.toUpperCase(), userId: userId } } })
    } catch (error) { return null }
  }

  async getSessionProfiles(sessionId: string): Promise<any[]> {
    try {
      return await prisma.sessionProfile.findMany({ where: { sessionId: sessionId.toUpperCase() }, orderBy: [{ isAdmin: 'desc' }, { createdAt: 'asc' }] })
    } catch (error) { return [] }
  }

  async closeRegistration(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({ where: { sessionId: sessionId.toUpperCase() }, data: { status: 'collecting_profiles', currentStep: 'collecting_profiles' } })
      return true
    } catch (error) { return false }
  }

  async startQuiz(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({ where: { sessionId: sessionId.toUpperCase() }, data: { status: 'quiz_active', currentStep: 'quiz' } })
      await this.setSocialAnalysisPending(sessionId)
      this.triggerBackgroundAnalysis(sessionId).catch((error) => console.log(`⚠️ Background analysis failed:`, error))
      return true
    } catch (error) { return false }
  }

  async saveQuizResults(sessionId: string, userId: string, quizResults: QuizResults): Promise<boolean> {
    try {
      const simplifiedQuizResult = {
        userId: quizResults.userId,
        displayName: quizResults.displayName,
        totalTime: quizResults.totalTime,
        completedAt: new Date(quizResults.completedAt).toISOString(),
        answers: quizResults.answers.map(answer => answer.selectedOption)
      }
      const result = await prisma.sessionProfile.updateMany({ where: { sessionId: sessionId.toUpperCase(), userId: userId }, data: { quiz_result: simplifiedQuizResult } })
      if (result.count === 0) return false
      try {
        await broadcastSessionUpdate(sessionId, 'participant_finished_quiz')
      } catch (sseError) { console.log(`⚠️ SSE broadcast failed:`, sseError) }
      await this.checkQuizCompletion(sessionId)
      return true
    } catch (error) { return false }
  }

  private async triggerSemanticAnalysis(sessionId: string): Promise<void> {
    console.log(`🧠 [Semantic Analysis] Starting for session: ${sessionId}`);
    try {
      const profiles = await prisma.sessionProfile.findMany({
        where: {
          sessionId: sessionId.toUpperCase(),
          quiz_result: { not: Prisma.JsonNull }
        },
        select: { quiz_result: true }
      });

      const quizResultsForApi = profiles
        .map(p => p.quiz_result)
        .filter(qr => this.isQuizResultComplete(qr));

      if (quizResultsForApi.length === 0 || quizResultsForApi.length !== profiles.length) {
        console.log(`⚠️ [Semantic Analysis] Insufficient or incomplete quiz data for session ${sessionId}. Aborting.`);
        return;
      }
      console.log(`🧠 [Semantic Analysis] Found ${quizResultsForApi.length} valid quiz results. Calling API.`);

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/analyze-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizResultsForApi),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}: ${await response.text()}`);
      }
      const analysisData = await response.json();
      if (!analysisData.success) {
        throw new Error('API returned success: false');
      }
      console.log(`🧠 [Semantic Analysis] API call successful. Saving results to DB.`);

      const { group_insights, individual_insights } = analysisData;

      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: { group_analysis: group_insights || Prisma.JsonNull },
      });

      const updatePromises = individual_insights.map((insight: any) =>
        prisma.sessionProfile.update({
          where: { sessionId_userId: { sessionId: sessionId.toUpperCase(), userId: insight.userId } },
          data: { individual_analysis: insight || Prisma.JsonNull },
        })
      );
      await prisma.$transaction(updatePromises);

      console.log(`✅ [Semantic Analysis] Successfully saved group and ${individual_insights.length} individual analyses for session ${sessionId}.`);

      console.log(`📢 [Semantic Analysis] Triggering session broadcast after analysis completion for ${sessionId}`);
      await broadcastSessionUpdate(sessionId, 'analysis_completed');

      console.log(`🔍 [Semantic Analysis] Checking conditions for movie recommendations...`);
      this.checkAndTriggerMovieRecommendations(sessionId)

    } catch (error) {
      console.error(`❌ [Semantic Analysis] Background task failed for session ${sessionId}:`, error);
    }
  }

  async checkQuizCompletion(sessionId: string): Promise<boolean> {
    try {
      const profiles = await this.getSessionProfiles(sessionId);
      const profilesWithQuizResults = profiles.filter(p => this.isQuizResultComplete(p.quiz_result));
      const allCompleted = profiles.length > 0 && profilesWithQuizResults.length === profiles.length;

      console.log(`📊 Quiz completion status: ${profilesWithQuizResults.length}/${profiles.length} completed`);

      if (allCompleted) {
        console.log(`🏆 All participants completed quiz! Session ${sessionId} moved to insights_ready`);
        await prisma.session.update({
          where: { sessionId: sessionId.toUpperCase() },
          data: { status: 'insights_ready', currentStep: 'insights_ready' }
        });

        try {
          broadcastSessionStatusChanged(sessionId, 'insights_ready', 'quiz_active');
          await broadcastSessionUpdate(sessionId, 'quiz_completed');
        } catch (sseError) {
          console.log(`⚠️ SSE broadcast on completion failed:`, sseError);
        }

        console.log(`🚀 Triggering background semantic analysis for session ${sessionId}`);
        this.triggerSemanticAnalysis(sessionId).catch(error => {
            console.error(`🚨 Unhandled error in background semantic analysis trigger for session ${sessionId}:`, error);
        });

        try {
          const results = await this.getQuizResults(sessionId);
          console.log(`🏆 FINAL RANKING for session ${sessionId}:`);
          results.forEach(r => console.log(`  ${r.medal} ${r.rank}. ${r.username} - ${r.totalTime}s`));
        } catch (rankingError) {
          console.log(`⚠️ Could not generate ranking:`, rankingError);
        }
        return true;
      }
      console.log(`⏳ Waiting for more participants to complete quiz: ${profilesWithQuizResults.length}/${profiles.length}`);
      return false;
    } catch (error) {
      console.error(`❌ Error checking quiz completion for session ${sessionId}:`, error);
      return false;
    }
  }

  async releaseInsights(sessionId: string): Promise<boolean> {
    try {
      console.log(`🚀 [Release Insights] Admin releasing insights for session ${sessionId}`);

      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: { status: 'insights_released', currentStep: 'insights_released' }
      });

      try {
        broadcastSessionStatusChanged(sessionId, 'insights_released', 'insights_ready');
        await broadcastSessionUpdate(sessionId, 'insights_released');
      } catch (sseError) {
        console.log(`⚠️ SSE broadcast on insights release failed:`, sseError);
      }

      console.log(`✅ [Release Insights] Insights released for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`❌ [Release Insights] Failed to release insights for session ${sessionId}:`, error);
      return false;
    }
  }

  async getQuizCompletionStatus(sessionId: string): Promise<{ totalProfiles: number, completedProfiles: number, pendingProfiles: any[], allCompleted: boolean, sessionStatus: string | null }> {
    try {
      const profiles = await this.getSessionProfiles(sessionId)
      const session = await this.getSession(sessionId)
      const completedProfiles = profiles.filter(profile => this.isQuizResultComplete(profile.quiz_result))
      const pendingProfiles = profiles.filter(profile => !this.isQuizResultComplete(profile.quiz_result)).map(p => ({ userId: p.userId, username: p.username, isAdmin: p.isAdmin, hasQuizResult: !!p.quiz_result && typeof p.quiz_result === 'object', hasValidQuizResult: this.isQuizResultComplete(p.quiz_result) }))
      return { totalProfiles: profiles.length, completedProfiles: completedProfiles.length, pendingProfiles, allCompleted: completedProfiles.length === profiles.length && profiles.length > 0, sessionStatus: session?.status || null }
    } catch (error) { return { totalProfiles: 0, pendingProfiles: [], completedProfiles: 0, allCompleted: false, sessionStatus: null } }
  }

  async getQuizResults(sessionId: string): Promise<any[]> {
    try {
      const profiles = await prisma.sessionProfile.findMany({ where: { sessionId: sessionId.toUpperCase() }, select: { userId: true, username: true, platform: true, pic_url: true, isAdmin: true, quiz_result: true, createdAt: true } })
      const resultsWithRanking = profiles.filter(profile => this.isQuizResultComplete(profile.quiz_result)).map(profile => { const quizResult = profile.quiz_result as any; return { userId: profile.userId, username: profile.username, platform: profile.platform, pic_url: profile.pic_url, isAdmin: profile.isAdmin, displayName: quizResult.displayName || profile.username, completedAt: new Date(quizResult.completedAt), totalTime: quizResult.totalTime || 0, answers: Array.isArray(quizResult.answers) ? quizResult.answers : [], answersCount: Array.isArray(quizResult.answers) ? quizResult.answers.length : 0, answerPattern: Array.isArray(quizResult.answers) ? quizResult.answers.join(',') : '' } }).sort((a, b) => a.totalTime - b.totalTime).map((result, index) => ({ ...result, rank: index + 1, medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '' }))
      return resultsWithRanking
    } catch (error) { return [] }
  }

  private async triggerBackgroundAnalysis(sessionId: string): Promise<void> {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/background/social-analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
    if (!response.ok) { throw new Error(`Background analysis HTTP error: ${response.status} ${response.statusText}`) }
    await response.json()
  }

  async setSocialAnalysisPending(sessionId: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({ where: { sessionId: sessionId.toUpperCase() }, select: { viewingMode: true } })
      if (!session) return false
      let whereCondition: any = { sessionId: sessionId.toUpperCase(), social_analysis_status: null }
      if (session.viewingMode === 'solo') { whereCondition.isAdmin = true }
      const result = await prisma.sessionProfile.updateMany({ where: whereCondition, data: { social_analysis_status: 'pending' } })
      return true
    } catch (error) { return false }
  }

  async getProfilesForAnalysis(sessionId: string): Promise<any[]> {
    try {
      const session = await prisma.session.findUnique({ where: { sessionId: sessionId.toUpperCase() }, select: { viewingMode: true } })
      if (!session) return []
      let whereCondition: any = { sessionId: sessionId.toUpperCase(), social_analysis_status: 'pending' }
      if (session.viewingMode === 'solo') { whereCondition.isAdmin = true }
      const profiles = await prisma.sessionProfile.findMany({ where: whereCondition, select: { id: true, userId: true, username: true, platform: true, social_analysis_status: true, isAdmin: true } })
      return profiles
    } catch (error) { return [] }
  }

  async updateSocialAnalysisStatus(profileId: number, status: 'pending' | 'in_progress' | 'completed' | 'failed', error?: string): Promise<boolean> {
    try {
      await prisma.sessionProfile.update({ where: { id: profileId }, data: { social_analysis_status: status, social_analysis_error: error || null, social_analyzed_at: status === 'completed' || status === 'failed' ? new Date() : null } })
      return true
    } catch (error) { return false }
  }

  async saveSocialAnalysisResults(profileId: number, postsData: string[], platform: 'instagram' | 'linkedin'): Promise<boolean> {
    try {
      const socialPostsData = { posts: postsData, metadata: { total_posts_analyzed: postsData.length, platform: platform, analyzed_at: new Date().toISOString() } }
      await prisma.sessionProfile.update({ where: { id: profileId }, data: { social_posts: socialPostsData, social_analysis_status: 'completed', social_analyzed_at: new Date() } })

      console.log(`🤖 [Social Analysis] Successfully saved posts for profileId ${profileId}, triggering LLM characterization...`)
      this.triggerLLMCharacterization(profileId).catch((error) => {
        console.log(`⚠️ [LLM Characterization] Failed for profileId ${profileId}:`, error)
      })

      const profile = await prisma.sessionProfile.findUnique({
        where: { id: profileId },
        select: { sessionId: true }
      })

      if (profile) {
        console.log(`🔍 [Social Analysis] Checking if movie recommendations can be triggered for session ${profile.sessionId}...`)
        this.checkAndTriggerMovieRecommendations(profile.sessionId)
      }

      return true
    } catch (error) { return false }
  }

  async getSocialAnalysisProgress(sessionId: string): Promise<{ total: number, pending: number, in_progress: number, completed: number, failed: number }> {
    try {
      const session = await prisma.session.findUnique({ where: { sessionId: sessionId.toUpperCase() }, select: { viewingMode: true } })
      if (!session) return { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 }
      let whereCondition: any = { sessionId: sessionId.toUpperCase() }
      if (session.viewingMode === 'solo') { whereCondition.isAdmin = true }
      const profiles = await prisma.sessionProfile.findMany({ where: whereCondition, select: { social_analysis_status: true, isAdmin: true, username: true } })
      const stats = { total: profiles.length, pending: profiles.filter(p => p.social_analysis_status === 'pending').length, in_progress: profiles.filter(p => p.social_analysis_status === 'in_progress').length, completed: profiles.filter(p => p.social_analysis_status === 'completed').length, failed: profiles.filter(p => p.social_analysis_status === 'failed').length }
      return stats
    } catch (error) { return { total: 0, pending: 0, in_progress: 0, completed: 0, failed: 0 } }
  }

  async updateAdminProfile(sessionId: string, profile: any): Promise<boolean> {
    const session = await prisma.session.findUnique({ where: { sessionId: sessionId.toUpperCase() } })
    if (!session) return false
    const platform = profile.platform || 'instagram'
    const username = profile.username || profile.displayName || 'unknown'
    const pic_url = profile.profilePicUrl || profile.profilepic_url || null
    let posts: string | undefined = undefined
    if (profile.followers_count || profile.posts_count || profile.followers || profile.connections) {
      const stats = []
      if (profile.followers_count) stats.push(`${profile.followers_count} followers`)
      if (profile.posts_count) stats.push(`${profile.posts_count} posts`)
      if (profile.followers) stats.push(`${profile.followers} followers`)
      if (profile.connections) stats.push(`${profile.connections} connections`)
      posts = stats.join(', ')
    }
    return await this.saveUserProfile(sessionId, session.adminId, { platform: platform as 'instagram' | 'linkedin', username: username, pic_url: pic_url, posts: posts }, true)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.delete({ where: { sessionId: sessionId.toUpperCase() } })
      return true
    } catch (error) { return false }
  }

  async cleanExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      return result.count
    } catch (error) { return 0 }
  }

  async advanceMovieTinderIndex(sessionId: string, batchSize: number): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          movieTinderIndex: {
            increment: batchSize
          }
        }
      });
      console.log(`✅ [advanceMovieTinderIndex] Advanced index for session ${sessionId} by ${batchSize}`);
      return true;
    } catch (error) {
      console.error(`❌ [advanceMovieTinderIndex] Error advancing index for session ${sessionId}:`, error);
      return false;
    }
  }

  // ✅ NOWA FUNKCJA: Resetuje MovieTinder dla kolejnej rundy
  async startNextTinderRound(sessionId: string): Promise<boolean> {
    try {
      const currentSession = await prisma.session.findUnique({
        where: { sessionId: sessionId.toUpperCase() },
        select: { movieTinderIndex: true }
      });

      if (!currentSession) {
        console.error(`❌ [startNextTinderRound] Session not found: ${sessionId}`);
        return false;
      }

      const currentIndex = currentSession.movieTinderIndex || 0;
      const BATCH_SIZE = 10;
      const nextIndex = currentIndex + BATCH_SIZE;

      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          movieTinderIndex: nextIndex,
          currentStep: 'movie_tinder'
        }
      });

      console.log(`✅ [startNextTinderRound] Advanced session ${sessionId} to next round, index: ${nextIndex}`);

      try {
        await broadcastSessionUpdate(sessionId, 'next_tinder_round_started');
        console.log(`📤 [startNextTinderRound] Broadcast sent for session ${sessionId}`);
      } catch (broadcastError) {
        console.log(`⚠️ [startNextTinderRound] Broadcast failed:`, broadcastError);
      }

      return true;
    } catch (error) {
      console.error(`❌ [startNextTinderRound] Error for session ${sessionId}:`, error);
      return false;
    }
  }

  // ✅ ZMODYFIKOWANA FUNKCJA: Dodany broadcast gdy wszyscy skończą
  async saveMoviePicks(sessionId: string, userId: string, batchNumber: number, picks: MoviePick[]): Promise<{ success: boolean; allFinished: boolean }> {
    try {
      const upperSessionId = sessionId.toUpperCase();

      const profile = await prisma.sessionProfile.findUnique({
        where: { sessionId_userId: { sessionId: upperSessionId, userId } }
      });

      if (!profile) {
        console.error(`❌ [saveMoviePicks] Profile not found for userId: ${userId} in session: ${upperSessionId}`);
        return { success: false, allFinished: false };
      }

      const existingPicks = (profile.picks as Prisma.JsonObject) || {};

      const positivePicks = picks
        .filter(p => p.vote === 'not_watched')
        .map(p => p.movieId);

      const batchKey = `batch_${batchNumber}`;

      const newPicks = {
        ...existingPicks,
        [batchKey]: positivePicks
      };

      await prisma.sessionProfile.update({
        where: { id: profile.id },
        data: {
          picks: newPicks
        }
      });

      console.log(`✅ [saveMoviePicks] Saved ${picks.length} picks (${positivePicks.length} positive) for user ${userId} in session ${upperSessionId}, batch ${batchNumber}`);

      // Sprawdź, czy wszyscy aktywni uczestnicy zakończyli tę partię
      const session = await this.getSession(upperSessionId);
      if (!session) {
        console.error(`❌ [saveMoviePicks] Session not found: ${upperSessionId}`);
        return { success: false, allFinished: false };
      }

      const allProfiles = session.profiles;
      let participantsToTrack = [];

      if (session.viewingMode === 'solo') {
        participantsToTrack = allProfiles.filter((p: any) => p.isAdmin);
        console.log(`👤 [saveMoviePicks] Solo mode - tracking admin only`);
      } else {
        participantsToTrack = allProfiles;
        console.log(`👥 [saveMoviePicks] Group mode - tracking ${participantsToTrack.length} participants`);
      }

      if (participantsToTrack.length === 0) {
        console.log(`⚠️ [saveMoviePicks] No participants to track`);
        return { success: true, allFinished: false };
      }

      // Musimy pobrać najświeższe dane profili po aktualizacji
      const updatedProfiles = await this.getSessionProfiles(upperSessionId);
      let finishedCount = 0;

      console.log(`🔍 [saveMoviePicks] Checking completion for batch ${batchNumber}:`);

      for (const p of updatedProfiles) {
          // Sprawdzamy tylko tych uczestników, którzy powinni głosować w danym trybie
          if (participantsToTrack.some((tracked: any) => tracked.userId === p.userId)) {
              const hasBatchPicks = p.picks && typeof p.picks === 'object' && (p.picks as any)[batchKey];
              console.log(`  - ${p.username} (${p.userId}): ${hasBatchPicks ? '✅ completed' : '⏳ pending'}`);

              if (hasBatchPicks) {
                  finishedCount++;
              }
          }
      }

      console.log(`📊 [saveMoviePicks] Completion status for batch ${batchNumber}: ${finishedCount}/${participantsToTrack.length}`);

      const allFinished = finishedCount === participantsToTrack.length;

      if (allFinished) {
          console.log(`🎉 [saveMoviePicks] All participants have completed batch ${batchNumber}! Broadcasting completion event...`);

          // POCZĄTEK PROPONOWANEJ ZMIANY
          // Ustaw currentStep na 'movie_tinder_results' w bazie danych.
          // To jest kluczowy brakujący element.
          await prisma.session.update({
            where: { sessionId: upperSessionId },
            data: { currentStep: 'movie_tinder_results' }
          });
          // KONIEC PROPONOWANEJ ZMIANY

          try {
            // Teraz broadcast wyśle sesję z już zaktualizowanym currentStep.
            await broadcastSessionUpdate(upperSessionId, 'all_participants_finished_tinder_batch');
            console.log(`📤 [saveMoviePicks] Successfully broadcasted all_participants_finished_tinder_batch for batch ${batchNumber}`);
          } catch (broadcastError) {
            console.log(`⚠️ [saveMoviePicks] Broadcast failed:`, broadcastError);
          }
      }

      return { success: true, allFinished: allFinished };
    } catch (error) {
      console.error(`❌ [saveMoviePicks] Error saving picks for user ${userId}:`, error);
      return { success: false, allFinished: false };
    }
  }

  // =================================================================================
  // START: NOWA LOGIKA DO WYŁANIANIA ZWYCIĘZCY
  // =================================================================================
  private _calculateWinner(votes: FinalVote[]): string | null {
    if (!votes || votes.length === 0) return null;
    const voteCounts = votes.reduce((acc, vote) => {
      acc[vote.movieId] = (acc[vote.movieId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const maxVotes = Math.max(...Object.values(voteCounts));
    const tiedMoviesIds = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
    if (tiedMoviesIds.length === 1) {
      return tiedMoviesIds[0];
    }
    const timeSums = tiedMoviesIds.reduce((acc, movieId) => {
      acc[movieId] = votes
        .filter(v => v.movieId === movieId)
        .reduce((sum, v) => sum + v.timeTaken, 0);
      return acc;
    }, {} as Record<string, number>);
    const winnerId = Object.keys(timeSums).reduce((a, b) => timeSums[a] < timeSums[b] ? a : b);
    return winnerId;
  }

  async checkAndDetermineFinalWinner(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      console.error(`[Final Vote Check] Session ${sessionId} not found during check.`);
      return;
    }
    const participantsToTrack = session.viewingMode === 'solo'
      ? session.profiles.filter((p: any) => p.isAdmin)
      : session.profiles;
    if (participantsToTrack.length === 0) {
      console.log(`[Final Vote Check] No participants to track for session ${sessionId}.`);
      return;
    }
    const finalVotes: FinalVote[] = [];
    for (const profile of session.profiles) {
      // ✅ POPRAWKA: Odczytujemy dane z klucza 'batch_final'
      const finalVoteData = (profile.picks as any)?.batch_final;
      if (finalVoteData && finalVoteData.movieId && typeof finalVoteData.timeTaken === 'number') {
        finalVotes.push(finalVoteData);
      }
    }
    if (finalVotes.length < participantsToTrack.length) {
      console.log(`[Final Vote Check] Waiting for more votes for ${sessionId}: ${finalVotes.length}/${participantsToTrack.length}`);
      return;
    }
    console.log(`🏆 [Final Vote Check] All ${finalVotes.length} participants have voted for ${sessionId}! Calculating winner...`);
    const winnerMovieId = this._calculateWinner(finalVotes);
    if (!winnerMovieId) {
      console.error(`❌ [Final Vote Check] Winner calculation failed for session ${sessionId}.`);
      return;
    }
    const winnerMovieDetails = await prisma.sessionMovieResult.findFirst({
        where: { sessionId, movieId: winnerMovieId }
    });
    if (!winnerMovieDetails) {
        console.error(`❌ [Final Vote Check] Could not find movie details for winner ID ${winnerMovieId} in session ${sessionId}.`);
        return;
    }
    await prisma.session.update({
        where: { sessionId },
        data: {
            currentStep: 'final_verdict',
            finalWinnerMovieId: winnerMovieId,
        }
    });
    await broadcastSessionUpdate(sessionId, 'final_verdict_reached', {
        winner: winnerMovieDetails
    });
    console.log(`🎉 [Final Vote Check] Verdict for ${sessionId} is in: "${winnerMovieDetails.movieTitle}". Broadcast sent.`);
  }
}

export const sessionDb = new SessionDatabase()