export interface SocialProfile {
  profilepic_url: string | null
  username: string
  platform: 'instagram' | 'linkedin'
  followers_count?: number | null
  posts_count?: number | null
  followers?: number | null
  connections?: number | null
  full_name?: string | null
  headline?: string | null
}

export interface ProfileCheckResponse {
  exist: boolean
  profilepic_url?: string | null
  username?: string
  followers_count?: number | null
  posts_count?: number | null
  followers?: number | null
  connections?: number | null
  full_name?: string | null
  headline?: string | null
}