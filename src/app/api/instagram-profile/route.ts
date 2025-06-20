// src/app/api/instagram-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveInstagramProfile } from '@/lib/profileStorage';

// Typy wewnątrz pliku route.ts
interface InstagramProfileResponse {
  exist: boolean;
  is_public: boolean;
  profilepic_url: string | null;
  username: string;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  highlight_reel_count?: number | null; // NOWE POLE - liczba highlight reels
  full_name: string | null;
  bio: string | null;
  is_verified: boolean; // DODANE POLE - status weryfikacji
  detection_method: string;
  savedProfileId?: string | null; // NOWE POLE
  raw_data?: {
    page_title: string;
    meta_description: string;
    json_data_found: boolean;
    html_indicators: string[];
  };
}

interface InstagramApiRequest {
  url: string;
}

interface InstagramApiError {
  error: string;
  details?: string;
}

// Typ odpowiedzi z Apify - POPRAWIONY
interface ApifyInstagramResponse {
  inputUrl: string;
  id: string;
  username: string;
  url: string;
  fullName: string | null;
  biography: string | null;
  externalUrls: string[];
  followersCount: number;
  followsCount: number;
  hasChannel: boolean;
  highlightReelCount: number;
  isBusinessAccount: boolean;
  joinedRecently: boolean;
  businessCategoryName: string;
  private?: boolean;           // Stare pole z Apify
  is_private?: boolean;        // Nowe pole z Apify
  verified: boolean;
  profilePicUrl: string;
  profilePicUrlHD: string;
  igtvVideoCount: number;
  relatedProfiles: any[];
  latestIgtvVideos: any[];
  postsCount: number;
  latestPosts: any[];
  fbid: string;
}

type ApiResponse = InstagramProfileResponse | InstagramApiError;

// Główna funkcja POST
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('=== INSTAGRAM API CALL START (APIFY) ===');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🏠 Host:', request.headers.get('host'));
    console.log('📍 Client IP:', request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown');
    console.log('🕐 Timestamp:', new Date().toISOString());

    const body: InstagramApiRequest = await request.json();
    const { url } = body;

    console.log('🔗 Requested URL:', url);

    if (!url) {
      console.log('❌ No URL provided');
      return NextResponse.json({ error: 'Instagram URL is required' }, { status: 400 });
    }

    const username = extractUsername(url);

    if (!username) {
      console.log('❌ Invalid Instagram URL format');
      return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
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

    const profileData = await checkInstagramProfileWithApify(url, apifyToken, request);

    console.log('✅ Profile check completed successfully via Apify');
    console.log('=== INSTAGRAM API CALL END ===');

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('❌ CRITICAL ERROR in Instagram API:', error);
    console.log('=== INSTAGRAM API CALL FAILED ===');
    return NextResponse.json({
      error: 'Failed to check Instagram profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Funkcja do wyciągania nazwy użytkownika z URL
function extractUsername(url: string): string | null {
  try {
    const patterns: RegExp[] = [
      /instagram\.com\/([a-zA-Z0-9._]+)\/?$/,
      /instagram\.com\/([a-zA-Z0-9._]+)\/$/,
      /instagram\.com\/([a-zA-Z0-9._]+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/\/$/, '');
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error extracting username:', error);
    return null;
  }
}

// Główna funkcja sprawdzająca profil Instagram za pomocą Apify
async function checkInstagramProfileWithApify(
  instagramUrl: string,
  apifyToken: string,
  request: NextRequest // NOWY PARAMETR
): Promise<InstagramProfileResponse> {
  try {
    console.log(`🔍 Checking profile via Apify synchronous endpoint: ${instagramUrl}`);

    // Przygotuj payload dla Apify
    const apifyPayload = {
      addParentData: false,
      directUrls: [instagramUrl],
      enhanceUserSearchWithFacebookPage: false,
      isUserReelFeedURL: false,
      isUserTaggedFeedURL: false,
      resultsLimit: 1,
      resultsType: "details",
      searchLimit: 1,
      searchType: "hashtag"
    };

    console.log('📤 Sending synchronous request to Apify...');
    console.log('📦 Payload:', JSON.stringify(apifyPayload, null, 2));

    const requestStart = Date.now();

    // Wywołaj Apify API synchronicznie - zwraca wyniki bezpośrednio
    const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apifyPayload),
      signal: AbortSignal.timeout(360000) // 6 minut timeout (Apify ma limit 5 minut + bufor)
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`⏱️ Apify synchronous request completed in: ${requestDuration}ms`);
    console.log(`📊 Apify response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apify API error response:', errorText);

      if (response.status === 408) {
        throw new Error('Apify request timed out - Actor run took longer than 5 minutes');
      }

      throw new Error(`Apify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Synchroniczny endpoint zwraca wyniki bezpośrednio
    const results: ApifyInstagramResponse[] = await response.json();

    console.log(`📦 Received ${results.length} results from Apify synchronous endpoint`);

    if (results.length > 0) {
      console.log(`📦 First result preview:`, JSON.stringify(results[0], null, 2).substring(0, 500));

      // DODANE: Debug logowanie pól związanych z prywatnością
      console.log('🔍 PRIVACY FIELDS DEBUG:');
      console.log('📥 apifyData.is_private:', results[0].is_private);
      console.log('📥 apifyData.private (old field):', (results[0] as any).private);
      console.log('📤 Final isPrivate value:', results[0].is_private ?? (results[0] as any).private ?? false);
    }

    if (!results || results.length === 0) {
      console.log('❌ No results from Apify - profile not found');
      return createNotFoundResponse(extractUsername(instagramUrl) || 'unknown');
    }

    const apifyData: ApifyInstagramResponse = results[0];
    console.log('✅ Apify data received:', {
      username: apifyData.username,
      fullName: apifyData.fullName,
      followersCount: apifyData.followersCount,
      is_private: apifyData.is_private,
      private: (apifyData as any).private,
      final_isPrivate: apifyData.is_private ?? (apifyData as any).private ?? false
    });

    // Mapuj dane z Apify na nasz format (PRZEKAŻ REQUEST)
    const mappedData = await mapApifyDataToResponse(apifyData, request);

    console.log('🎯 Final mapped response:', {
      exist: mappedData.exist,
      is_public: mappedData.is_public,
      username: mappedData.username,
      followers_count: mappedData.followers_count,
      detection_method: mappedData.detection_method,
      savedProfileId: mappedData.savedProfileId // NOWY LOG
    });

    return mappedData;

  } catch (error) {
    console.error(`❌ Error in Apify synchronous request:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏰ Apify request timed out after 6 minutes');
    }
    throw new Error(`Failed to fetch Instagram profile via Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Funkcja mapująca dane z Apify na nasz format - POPRAWIONA
async function mapApifyDataToResponse(apifyData: ApifyInstagramResponse, request: NextRequest): Promise<InstagramProfileResponse> {
  console.log('🔄 Mapping Apify data to response format...');

  // OBSŁUGA ZARÓWNO private JAK I is_private
  const isPrivate = apifyData.is_private ?? apifyData.private ?? false;

  // DODANE: Szczegółowe logowanie prywatnością
  console.log('🔍 DETAILED PRIVACY DEBUG:');
  console.log('📥 Raw Apify is_private:', apifyData.is_private);
  console.log('📥 Raw Apify private:', apifyData.private);
  console.log('📥 Final isPrivate value:', isPrivate);
  console.log('📤 Calculated is_public:', !isPrivate);
  console.log('🎯 Expected display text:', isPrivate ? 'Prywatne' : 'Publiczne');

  // NOWY KOD - Tworzenie proxy URL PRZED zapisem do bazy
  const originalProfilePicUrl = apifyData.profilePicUrlHD || apifyData.profilePicUrl || null;
  let proxiedProfilePicUrl = null;
  let proxiedProfilePicUrlHD = null;

  if (originalProfilePicUrl) {
    // Enkoduj URL obrazu dla bezpieczeństwa
    const encodedImageUrl = encodeURIComponent(originalProfilePicUrl);
    proxiedProfilePicUrl = `/api/proxy-image?url=${encodedImageUrl}`;
    proxiedProfilePicUrlHD = proxiedProfilePicUrl; // Używamy tego samego proxy URL
    console.log('🔄 Created proxy URL for profile picture');
  }

  // NOWY KOD - Zapis profilu do bazy danych Z PROXY URL
  let savedProfileId: string | null = null;

  // POPRAWKA: Zapisuj do bazy tylko gdy mamy wymagane dane
  if (originalProfilePicUrl) {
    try {
      console.log('💾 Attempting to save Instagram profile to database...');

      // MAPOWANIE DANYCH Z PROXY URL DO ZAPISU W BAZIE - POPRAWIONE TYPY
      const profileDataForSave = {
        ...apifyData,
        profilePicUrl: proxiedProfilePicUrl || '', // Używamy pustego stringa zamiast null
        profilePicUrlHD: proxiedProfilePicUrlHD || '', // Używamy pustego stringa zamiast null
        is_private: isPrivate  // Używamy ustalonej wartości
      };

      savedProfileId = await saveInstagramProfile(profileDataForSave, request);
      if (savedProfileId) {
        console.log('✅ Instagram profile saved to database with ID:', savedProfileId);
      } else {
        console.log('⚠️ Failed to save Instagram profile to database');
      }
    } catch (error) {
      console.error('❌ Error during profile save:', error);
      // Kontynuuj normalnie - zapis profilu nie powinien blokować sprawdzenia
    }
  } else {
    console.log('⚠️ Skipping database save - no profile picture URL available');
  }

  const response: InstagramProfileResponse = {
    exist: true,
    is_public: !isPrivate,
    profilepic_url: proxiedProfilePicUrl,
    username: apifyData.username,
    followers_count: apifyData.followersCount,
    following_count: apifyData.followsCount,
    posts_count: apifyData.postsCount,
    highlight_reel_count: apifyData.highlightReelCount, // NOWE POLE - mapowanie z Apify
    full_name: apifyData.fullName,
    bio: apifyData.biography,
    is_verified: apifyData.verified, // DODANE MAPOWANIE - status weryfikacji
    detection_method: 'APIFY_API',
    savedProfileId: savedProfileId, // NOWE POLE
    raw_data: {
      page_title: apifyData.fullName ? `${apifyData.fullName} (@${apifyData.username})` : `@${apifyData.username}`,
      meta_description: apifyData.biography || '',
      json_data_found: true,
      html_indicators: [
        'apify_api_data',
        isPrivate ? 'private_account' : 'public_account',
        apifyData.verified ? 'verified_account' : 'unverified_account',
        apifyData.isBusinessAccount ? 'business_account' : 'personal_account',
        ...(apifyData.followersCount > 0 ? ['has_followers'] : []),
        ...(apifyData.postsCount > 0 ? ['has_posts'] : []),
      ]
    }
  };

  console.log('✅ Mapping completed successfully');
  console.log('🎯 FINAL PRIVACY VALIDATION:');
  console.log('📥 Input isPrivate:', isPrivate);
  console.log('📤 Output is_public:', response.is_public);
  console.log('🔄 Cross-check (should be opposite):', isPrivate === !response.is_public ? '✅ CORRECT' : '❌ ERROR');

  return response;
}

function createNotFoundResponse(username: string): InstagramProfileResponse {
  console.log(`📝 Creating not found response for ${username}`);
  return {
    exist: false,
    is_public: false,
    profilepic_url: null,
    username: username,
    followers_count: null,
    following_count: null,
    posts_count: null,
    highlight_reel_count: null, // NOWE POLE
    full_name: null,
    bio: null,
    is_verified: false, // DODANE POLE - dla nie znalezionych profili
    detection_method: 'APIFY_API_NOT_FOUND',
    savedProfileId: null, // NOWE POLE
  };
}

// Opcjonalne: obsługa innych metod HTTP
export async function GET(): Promise<NextResponse> {
  console.log('❌ GET method called on Instagram API - should use POST');
  return NextResponse.json({
    error: 'Method not allowed. Use POST instead.'
  }, { status: 405 });
}