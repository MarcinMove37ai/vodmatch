// src/app/api/linkedin-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveLinkedInProfile, normalizeLinkedInData } from '@/lib/profileStorage';

interface LinkedInProfileResponse {
  exist: boolean;
  is_public: boolean;
  profilepic_url: string | null;
  username: string;
  followers: number | null;
  connections: number | null;
  full_name: string | null;
  headline: string | null;
  jobTitle: string | null;        // DODANE POLE
  companyName: string | null;     // DODANE POLE
  location: string | null;        // DODANE POLE
  topSkills: string | null;       // DODANE POLE
  detection_method: string;
  savedProfileId?: string | null;
  raw_data?: {
    page_title: string;
    meta_description: string;
    json_data_found: boolean;
    html_indicators: string[];
  };
}

interface LinkedInApiRequest {
  url: string;
}

interface LinkedInApiError {
  error: string;
  details?: string;
}

// Typ odpowiedzi z Apify LinkedIn scraper (na podstawie rzeczywistej odpowiedzi)
interface ApifyLinkedInResponse {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  connections: number;
  followers: number;
  email: string | null;
  mobileNumber: string | null;
  jobTitle: string;
  companyName: string | null;
  profilePic: string;
  profilePicHighQuality: string;
  about: string;
  publicIdentifier: string;
  urn: string;
  experiences: any[];
  skills: any[];
  educations: any[];
  updates: any[];
  [key: string]: any;
}

type ApiResponse = LinkedInProfileResponse | LinkedInApiError;

// Główna funkcja POST
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('=== LINKEDIN API CALL START (APIFY) ===');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🏠 Host:', request.headers.get('host'));
    console.log('📍 Client IP:', request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown');
    console.log('🕐 Timestamp:', new Date().toISOString());

    const body: LinkedInApiRequest = await request.json();
    const { url } = body;

    console.log('🔗 Requested URL:', url);

    if (!url) {
      console.log('❌ No URL provided');
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 });
    }

    const username = extractLinkedInUsername(url);

    if (!username) {
      console.log('❌ Invalid LinkedIn URL format');
      return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 });
    }

    console.log('👤 Extracted username:', username);

    // Sprawdź czy token Apify jest dostępny
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log('❌ APIFY_API_TOKEN not configured');
      return NextResponse.json({
        error: 'API configuration error',
        details: 'APIFY_API_TOKEN not configured'
      }, { status: 500 });
    }

    const profileData = await checkLinkedInProfileWithApify(url, apifyToken, request);

    console.log('✅ Profile check completed successfully via Apify');
    console.log('=== LINKEDIN API CALL END ===');

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('❌ CRITICAL ERROR in LinkedIn API:', error);
    console.log('=== LINKEDIN API CALL FAILED ===');
    return NextResponse.json({
      error: 'Failed to check LinkedIn profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Funkcja do wyciągania nazwy użytkownika z LinkedIn URL
function extractLinkedInUsername(url: string): string | null {
  try {
    const patterns: RegExp[] = [
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)\/?$/,
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)\/$/,
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/\/$/, '');
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error extracting LinkedIn username:', error);
    return null;
  }
}

// Główna funkcja sprawdzająca profil LinkedIn za pomocą Apify
async function checkLinkedInProfileWithApify(
  linkedinUrl: string,
  apifyToken: string,
  request: NextRequest // NOWY PARAMETR
): Promise<LinkedInProfileResponse> {
  try {
    console.log(`🔍 Checking LinkedIn profile via Apify synchronous endpoint: ${linkedinUrl}`);

    // Przygotuj payload dla Apify LinkedIn scraper
    const apifyPayload = {
      profileUrls: [linkedinUrl],
      includeSkills: true, // ZMIANA - włączamy skills dla naszego zapisu
      includeExperience: false,
      includeEducation: false,
      includeRecommendations: false,
      includeAccomplishments: false,
      includePeopleAlsoViewed: false,
      includeActivityPosts: false
    };

    console.log('📤 Sending synchronous request to Apify LinkedIn scraper...');
    console.log('📦 Payload:', JSON.stringify(apifyPayload, null, 2));

    const requestStart = Date.now();

    // Wywołaj Apify LinkedIn scraper synchronicznie - używamy ID aktora zamiast nazwy
    const response = await fetch(`https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/run-sync-get-dataset-items?token=${apifyToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apifyPayload),
      signal: AbortSignal.timeout(360000) // 6 minut timeout
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`⏱️ Apify LinkedIn synchronous request completed in: ${requestDuration}ms`);
    console.log(`📊 Apify response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apify LinkedIn API error response:', errorText);

      if (response.status === 408) {
        throw new Error('Apify LinkedIn request timed out - Actor run took longer than 5 minutes');
      }

      throw new Error(`Apify LinkedIn API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Synchroniczny endpoint zwraca wyniki bezpośrednio
    const results: ApifyLinkedInResponse[] = await response.json();

    console.log(`📦 Received ${results.length} results from Apify LinkedIn synchronous endpoint`);

    if (results.length > 0) {
      console.log(`📦 First LinkedIn result preview:`, JSON.stringify(results[0], null, 2).substring(0, 500));
    }

    if (!results || results.length === 0) {
      console.log('❌ No results from Apify LinkedIn - profile not found');
      return createLinkedInNotFoundResponse(extractLinkedInUsername(linkedinUrl) || 'unknown');
    }

    const apifyData: ApifyLinkedInResponse = results[0];
    console.log('✅ Apify LinkedIn data received:', {
      publicIdentifier: apifyData.publicIdentifier,
      fullName: apifyData.fullName,
      followers: apifyData.followers,
      connections: apifyData.connections,
      headline: apifyData.headline,
      jobTitle: apifyData.jobTitle,
      companyName: apifyData.companyName
    });

    // Mapuj dane z Apify na nasz format (PRZEKAŻ REQUEST)
    const mappedData = await mapApifyLinkedInDataToResponse(apifyData, request);

    console.log('🎯 Final mapped LinkedIn response:', {
      exist: mappedData.exist,
      is_public: mappedData.is_public,
      username: mappedData.username,
      followers: mappedData.followers,
      connections: mappedData.connections,
      jobTitle: mappedData.jobTitle,
      companyName: mappedData.companyName,
      location: mappedData.location,
      topSkills: mappedData.topSkills ? mappedData.topSkills.substring(0, 50) + '...' : null,
      detection_method: mappedData.detection_method,
      savedProfileId: mappedData.savedProfileId
    });

    return mappedData;

  } catch (error) {
    console.error(`❌ Error in Apify LinkedIn synchronous request:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏰ Apify LinkedIn request timed out after 6 minutes');
    }
    throw new Error(`Failed to fetch LinkedIn profile via Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Funkcja mapująca dane z Apify LinkedIn na nasz format
async function mapApifyLinkedInDataToResponse(apifyData: ApifyLinkedInResponse, request: NextRequest): Promise<LinkedInProfileResponse> {
  console.log('🔄 Mapping Apify LinkedIn data to response format...');

  // NOWY KOD - Zapis profilu do bazy danych
  let savedProfileId: string | null = null;
  try {
    console.log('💾 Attempting to save LinkedIn profile to database...');
    savedProfileId = await saveLinkedInProfile(apifyData, request);
    if (savedProfileId) {
      console.log('✅ LinkedIn profile saved to database with ID:', savedProfileId);
    } else {
      console.log('⚠️ Failed to save LinkedIn profile to database');
    }
  } catch (error) {
    console.error('❌ Error during LinkedIn profile save:', error);
    // Kontynuuj normalnie - zapis profilu nie powinien blokować sprawdzenia
  }

  // 🔧 NORMALIZACJA DANYCH - użyj tej samej funkcji co do zapisu
  const normalizedData = normalizeLinkedInData(apifyData);

  console.log('🔧 Normalized LinkedIn data:', {
    jobTitle: normalizedData.jobTitle,
    companyName: normalizedData.companyName,
    location: normalizedData.location,
    topSkills: normalizedData.topSkills ? normalizedData.topSkills.substring(0, 50) + '...' : null
  });

  const originalProfilePicUrl = apifyData.profilePicHighQuality || apifyData.profilePic || null;

  // Stwórz proxy URL dla obrazu profilowego (jeśli istnieje)
  let proxiedProfilePicUrl = null;
  if (originalProfilePicUrl) {
    // Enkoduj URL obrazu dla bezpieczeństwa
    const encodedImageUrl = encodeURIComponent(originalProfilePicUrl);
    proxiedProfilePicUrl = `/api/proxy-image?url=${encodedImageUrl}`;
    console.log('🔄 Created proxy URL for LinkedIn profile picture');
  }

  const response: LinkedInProfileResponse = {
    exist: true,
    is_public: true, // LinkedIn profile scraper zwykle zwraca tylko publiczne profile
    profilepic_url: proxiedProfilePicUrl,
    username: apifyData.publicIdentifier || apifyData.urn || 'unknown',
    followers: apifyData.followers || null,
    connections: apifyData.connections || null,
    full_name: apifyData.fullName,
    headline: apifyData.headline,

    // ✅ DODANE BRAKUJĄCE POLA Z ZNORMALIZOWANYCH DANYCH
    jobTitle: normalizedData.jobTitle,
    companyName: normalizedData.companyName,
    location: normalizedData.location,
    topSkills: normalizedData.topSkills,

    detection_method: 'APIFY_LINKEDIN_API',
    savedProfileId: savedProfileId, // NOWE POLE
    raw_data: {
      page_title: apifyData.fullName ? `${apifyData.fullName} - LinkedIn` : `LinkedIn Profile`,
      meta_description: apifyData.headline || apifyData.about || '',
      json_data_found: true,
      html_indicators: [
        'apify_linkedin_api_data',
        'public_linkedin_profile',
        ...(apifyData.followers > 0 ? ['has_followers'] : []),
        ...(apifyData.connections > 0 ? ['has_connections'] : []),
        ...(normalizedData.companyName ? ['has_company'] : []),
        ...(normalizedData.jobTitle ? ['has_job_title'] : []),
        ...(normalizedData.location ? ['has_location'] : []),
        ...(normalizedData.topSkills ? ['has_skills'] : []),
      ]
    }
  };

  console.log('✅ LinkedIn mapping completed successfully');
  console.log('🎯 Response includes all fields:', {
    jobTitle: response.jobTitle,
    companyName: response.companyName,
    location: response.location,
    topSkills: response.topSkills ? response.topSkills.substring(0, 50) + '...' : null
  });

  return response;
}

function createLinkedInNotFoundResponse(username: string): LinkedInProfileResponse {
  console.log(`📝 Creating LinkedIn not found response for ${username}`);
  return {
    exist: false,
    is_public: false,
    profilepic_url: null,
    username: username,
    followers: null,
    connections: null,
    full_name: null,
    headline: null,
    jobTitle: null,        // DODANE POLE
    companyName: null,     // DODANE POLE
    location: null,        // DODANE POLE
    topSkills: null,       // DODANE POLE
    detection_method: 'APIFY_LINKEDIN_API_NOT_FOUND',
    savedProfileId: null, // NOWE POLE
  };
}

// Opcjonalne: obsługa innych metod HTTP
export async function GET(): Promise<NextResponse> {
  console.log('❌ GET method called on LinkedIn API - should use POST');
  return NextResponse.json({
    error: 'Method not allowed. Use POST instead.'
  }, { status: 405 });
}