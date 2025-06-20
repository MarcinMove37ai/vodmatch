// types/session.ts
import { SocialProfile } from './social'
import { StreamingPlatform } from './platform'
import { ViewingMode } from './mode'

export interface AppSession {
  // Identyfikatory sesji
  sessionId: string           // 6-znakowy kod (np. "A7X9M2")
  adminId: string            // userId administratora sesji
  createdAt: Date
  expiresAt: Date            // Sesja wygasa po 2 godzinach

  // Stan aplikacji - dane wprowadzone przez admina
  adminProfile: SessionProfile | null
  selectedPlatforms: StreamingPlatform[]
  viewingMode: ViewingMode | null

  // Uczestnicy (dla trybu Couple/Group)
  participants: SessionParticipant[]

  // Wyniki quizu wszystkich uczestników
  quizResults: QuizResults[]

  // AI Generated content (później)
  generatedMovies?: GeneratedMovie[]
  finalRecommendations?: MovieRecommendation[]

  // Status sesji
  status: SessionStatus
  currentStep: string
  lastUpdated: Date
}

export interface SessionProfile {
  // Podstawowe dane z social profile
  profilepic_url: string | null
  username: string
  platform: 'instagram' | 'linkedin'

  // Dane do wyświetlania innym użytkownikom
  displayName: string        // Imię lub @username
  profilePicUrl: string | null // Proxy URL do zdjęcia

  // Dane statystyczne (dla algorytmu)
  followers_count?: number | null
  posts_count?: number | null
  followers?: number | null
  connections?: number | null
  full_name?: string | null
  headline?: string | null
}

export interface SessionParticipant {
  participantId: string       // userId uczestnika
  profile: SessionProfile | null
  joinedAt: Date
  isReady: boolean           // Czy ukończył dodawanie profilu
  isOnline: boolean          // Czy aktualnie online (dla real-time)
}

export interface QuizResults {
  userId: string
  displayName: string        // Dla identyfikacji w grupie
  answers: QuizAnswer[]
  completedAt: Date
  preferences: UserPreferences // Przetworzone odpowiedzi
}

export interface QuizAnswer {
  questionId: string
  selectedOption: string
  timestamp: Date
}

export interface UserPreferences {
  genres: string[]
  moods: string[]
  settings: string[]
  themes: string[]
  // Dodatkowe preferencje z analizy profilu społecznościowego
  personalityTraits?: string[]
}

// Typy pomocnicze
export type SessionStatus =
  | 'setup'              // Konfiguracja przez admina
  | 'collecting_profiles' // Oczekiwanie na profile uczestników
  | 'quiz'               // Faza quizu
  | 'generating'         // AI generuje rekomendacje
  | 'results'            // Wyświetlanie wyników

export interface GeneratedMovie {
  id: string
  title: string
  description: string
  genre: string[]
  mood: string
  generatedFor: string[] // userIds dla których został wygenerowany
}

export interface MovieRecommendation {
  movieId: string
  title: string
  platform: string
  matchScore: number
  reasons: string[]
}

// Client-side session data (localStorage)
export interface ClientSession {
  sessionId: string
  userId: string
  isAdmin: boolean
  lastSync: Date
}

// Session creation request
export interface CreateSessionRequest {
  userId: string
}

export interface CreateSessionResponse {
  sessionId: string
  userId: string
  expiresAt: Date
}

// Session update requests
export interface UpdateSessionPlatformsRequest {
  sessionId: string
  userId: string
  platforms: StreamingPlatform[]
}

export interface UpdateSessionModeRequest {
  sessionId: string
  userId: string
  mode: ViewingMode
}

export interface UpdateSessionProfileRequest {
  sessionId: string
  userId: string
  profile: SessionProfile
}

export interface SubmitQuizResultsRequest {
  sessionId: string
  userId: string
  answers: QuizAnswer[]
}

// Join session request (dla uczestników)
export interface JoinSessionRequest {
  sessionId: string
  userId: string
}

export interface JoinSessionResponse {
  success: boolean
  session: AppSession
  participantId: string
}