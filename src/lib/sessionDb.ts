// lib/sessionDb.ts - WERSJA Z INTEGRACJĄ LLM CHARACTERIZATION
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

// SSE INTEGRATION
import {
  broadcastSessionStatusChanged,
  broadcastSessionUpdate
} from '../app/api/session/[id]/events/route'

// QUIZ TYPES
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

  // 🆕 NOWA METODA: Wyzwalanie LLM characterization
  private async triggerLLMCharacterization(profileId: number): Promise<void> {
    try {
      console.log(`🤖 [LLM Characterization] Starting for profileId: ${profileId}`)

      // Pobierz userId z profileId
      const profile = await prisma.sessionProfile.findUnique({
        where: { id: profileId },
        select: { userId: true, username: true }
      })

      if (!profile) {
        console.log(`❌ [LLM Characterization] Profile not found for profileId: ${profileId}`)
        return
      }

      console.log(`🤖 [LLM Characterization] Triggering for user: ${profile.username} (${profile.userId})`)

      // Wywołaj endpoint LLM characterization
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
      } else {
        console.error(`❌ [LLM Characterization] API error for ${profile.username}:`, result.error)
      }

    } catch (error) {
      console.error(`❌ [LLM Characterization] Failed for profileId ${profileId}:`, error)
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

      // ⬇️⬇️⬇️ JEDYNA, KLUCZOWA ZMIANA ⬇️⬇️⬇️
      // Po pomyślnym zapisaniu analizy, musimy jawnie poinformować
      // wszystkich klientów, że dostępna jest nowa, kompletna wersja sesji.
      console.log(`📢 [Semantic Analysis] Triggering session broadcast after analysis completion for ${sessionId}`);
      await broadcastSessionUpdate(sessionId, 'analysis_completed');

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
        console.log(`🏆 All participants completed quiz! Session ${sessionId} moved to results`);
        await prisma.session.update({
          where: { sessionId: sessionId.toUpperCase() },
          data: { status: 'results', currentStep: 'results' }
        });

        try {
          broadcastSessionStatusChanged(sessionId, 'results', 'quiz_active');
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

  async getQuizCompletionStatus(sessionId: string): Promise<{ totalProfiles: number, completedProfiles: number, pendingProfiles: any[], allCompleted: boolean, sessionStatus: string | null }> {
    try {
      const profiles = await this.getSessionProfiles(sessionId)
      const session = await this.getSession(sessionId)
      const completedProfiles = profiles.filter(profile => this.isQuizResultComplete(profile.quiz_result))
      const pendingProfiles = profiles.filter(profile => !this.isQuizResultComplete(profile.quiz_result)).map(p => ({ userId: p.userId, username: p.username, isAdmin: p.isAdmin, hasQuizResult: !!p.quiz_result && typeof p.quiz_result === 'object', hasValidQuizResult: this.isQuizResultComplete(p.quiz_result) }))
      return { totalProfiles: profiles.length, completedProfiles: completedProfiles.length, pendingProfiles, allCompleted: completedProfiles.length === profiles.length && profiles.length > 0, sessionStatus: session?.status || null }
    } catch (error) { return { totalProfiles: 0, completedProfiles: 0, pendingProfiles: [], allCompleted: false, sessionStatus: null } }
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

  // 🆕 ZMODYFIKOWANA FUNKCJA: Automatyczne wyzwalanie LLM characterization
  async saveSocialAnalysisResults(profileId: number, postsData: string[], platform: 'instagram' | 'linkedin'): Promise<boolean> {
    try {
      const socialPostsData = { posts: postsData, metadata: { total_posts_analyzed: postsData.length, platform: platform, analyzed_at: new Date().toISOString() } }
      await prisma.sessionProfile.update({ where: { id: profileId }, data: { social_posts: socialPostsData, social_analysis_status: 'completed', social_analyzed_at: new Date() } })

      // 🚀 NOWY KROK: Automatyczne wyzwalanie LLM characterization zaraz po zapisaniu social posts
      console.log(`🤖 [Social Analysis] Successfully saved posts for profileId ${profileId}, triggering LLM characterization...`)
      this.triggerLLMCharacterization(profileId).catch((error) => {
        console.log(`⚠️ [LLM Characterization] Failed for profileId ${profileId}:`, error)
      })

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
}

export const sessionDb = new SessionDatabase()