import { NextRequest } from 'next/server'

// Mock placeholders for profile storage functions
export async function saveInstagramProfile(profileData: any, request: NextRequest): Promise<string | null> {
  console.log('📝 Mock: Would save Instagram profile:', profileData.username)
  // Return mock ID for now
  return `ig_${profileData.username}_${Date.now()}`
}

export async function saveLinkedInProfile(profileData: any, request: NextRequest): Promise<string | null> {
  console.log('📝 Mock: Would save LinkedIn profile:', profileData.publicIdentifier)
  // Return mock ID for now
  return `li_${profileData.publicIdentifier}_${Date.now()}`
}

export async function normalizeLinkedInData(apifyData: any) {
  console.log('🔧 Mock: Normalizing LinkedIn data for:', apifyData.publicIdentifier)

  // Extract skills from skills array if available
  const topSkills = apifyData.skills && apifyData.skills.length > 0
    ? apifyData.skills.slice(0, 5).map((skill: any) => skill.name || skill).join(', ')
    : null

  return {
    jobTitle: apifyData.jobTitle || null,
    companyName: apifyData.companyName || null,
    location: apifyData.location || null,
    topSkills: topSkills
  }
}

export async function getProfileType(profileId: string): Promise<'instagram' | 'linkedin' | null> {
  console.log('🔍 Mock: Getting profile type for:', profileId)

  // Simple mock logic based on ID prefix
  if (profileId.startsWith('ig_')) return 'instagram'
  if (profileId.startsWith('li_')) return 'linkedin'

  return null
}