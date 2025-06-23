// lib/sessionDb.ts
import { prisma } from './prisma'

export class SessionDatabase {
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

  // 🎯 FIXED: Save user profile - KLUCZOWA POPRAWKA FLOW STATUSÓW
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
          quiz_result: {},
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
          // Solo: od razu do quiz
          await prisma.session.update({
            where: { sessionId: sessionId.toUpperCase() },
            data: {
              currentStep: 'quiz',
              status: 'quiz'
            }
          })
          console.log(`🎯 Solo session: Updated to quiz`)
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

  // 🆕 NEW METHOD: Admin startuje quiz
  async startQuiz(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { sessionId: sessionId.toUpperCase() },
        data: {
          status: 'quiz_active',
          currentStep: 'quiz'
        }
      })
      console.log(`✅ Quiz started for session ${sessionId}`)
      return true
    } catch (error) {
      console.error(`❌ Error starting quiz:`, error)
      return false
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