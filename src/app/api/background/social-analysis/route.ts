// src/app/api/background/social-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sessionDb } from '@/lib/sessionDb';

// Konfiguracja - ile postów pobierać
const POSTS_LIMIT = 3; // Zmniejszona liczba dla szybkości
const REQUEST_TIMEOUT = 180000; // 3 minuty timeout per profile (zabezpieczenie przed zawieszeniem)

// Funkcja do czyszczenia tekstu (skopiowana z creator analysis)
function cleanText(text: string): string {
  if (!text) return '';

  return text
    // Usuń emotikony
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols & Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    // Usuń znaki specjalne i formatowanie
    .replace(/[\u{200D}\u{FE0F}]/gu, '')    // Zero Width Joiner
    .replace(/\n\s*\n/g, ' ')               // Podwójne nowe linie na spację
    .replace(/\n/g, ' ')                    // Nowe linie na spacje
    .replace(/\s+/g, ' ')                   // Wielokrotne spacje na jedną
    .replace(/[^\w\s\.,!?;:\-()]/g, '')     // Tylko podstawowe znaki interpunkcyjne
    .trim();
}

// Funkcja do pobierania postów Instagram
async function scrapeInstagramPosts(username: string, apifyToken: string): Promise<string[]> {
  console.log(`📱 Scraping Instagram posts for: ${username}`);

  const payload = {
    resultsLimit: POSTS_LIMIT,
    skipPinnedPosts: false,
    username: [username]
  };

  const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items?token=${apifyToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Instagram API error: ${response.status}`);
  }

  const results = await response.json();
  console.log(`📦 Received ${results.length} Instagram posts for ${username}`);

  // Wyciągnij i oczyść teksty z captionów
  const cleanedTexts = results
    .map((post: any) => cleanText(post.caption || ''))
    .filter((text: string) => text.length > 10) // Tylko posty z sensownym tekstem
    .slice(0, POSTS_LIMIT); // Limit bezpieczeństwa

  console.log(`✅ Processed ${cleanedTexts.length} Instagram posts with text for ${username}`);
  return cleanedTexts;
}

// Funkcja do pobierania postów LinkedIn
async function scrapeLinkedInPosts(username: string, apifyToken: string): Promise<string[]> {
  console.log(`💼 Scraping LinkedIn posts for: ${username}`);

  // Usuń linkedin.com prefix jeśli obecny
  let cleanUsername = username;
  if (username.includes('linkedin.com/in/')) {
    const match = username.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match) cleanUsername = match[1];
  }

  const payload = {
    limit: POSTS_LIMIT,
    username: username, // Używaj oryginalnego username (może być URL)
    page_number: 1
  };

  const response = await fetch(`https://api.apify.com/v2/acts/LQQIXN9Othf8f7R5n/run-sync-get-dataset-items?token=${apifyToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`LinkedIn API error: ${response.status}`);
  }

  const results = await response.json();
  console.log(`📦 Received ${results.length} LinkedIn posts for ${cleanUsername}`);

  // Wyciągnij i oczyść teksty
  const cleanedTexts = results
    .map((post: any) => cleanText(post.text || ''))
    .filter((text: string) => text.length > 10) // Tylko posty z sensownym tekstem
    .slice(0, POSTS_LIMIT); // Limit bezpieczeństwa

  console.log(`✅ Processed ${cleanedTexts.length} LinkedIn posts with text for ${cleanUsername}`);
  return cleanedTexts;
}

// Główna funkcja przetwarzania profilu
async function processProfile(profile: any, apifyToken: string): Promise<{ success: boolean, postsCount: number, error?: string, profileId: number, username: string, platform: string, processingTime: number }> {
  const { id: profileId, username, platform } = profile;
  const startTime = Date.now();

  try {
    console.log(`🔄 Processing ${platform} profile: ${username} (ID: ${profileId})`);

    // Ustaw status na 'in_progress'
    await sessionDb.updateSocialAnalysisStatus(profileId, 'in_progress');

    let cleanedPosts: string[] = [];

    // Pobierz posty w zależności od platformy
    if (platform === 'instagram') {
      cleanedPosts = await scrapeInstagramPosts(username, apifyToken);
    } else if (platform === 'linkedin') {
      cleanedPosts = await scrapeLinkedInPosts(username, apifyToken);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const processingTime = Date.now() - startTime;

    // Zapisz wyniki do bazy
    if (cleanedPosts.length > 0) {
      await sessionDb.saveSocialAnalysisResults(profileId, cleanedPosts, platform);
      console.log(`✅ Successfully processed ${username}: ${cleanedPosts.length} posts saved in ${processingTime}ms`);
      return {
        success: true,
        postsCount: cleanedPosts.length,
        profileId,
        username,
        platform,
        processingTime
      };
    } else {
      // Brak postów nie jest błędem - może być prywatny profil
      await sessionDb.updateSocialAnalysisStatus(profileId, 'completed');
      console.log(`⚠️ No posts found for ${username} (may be private profile) - completed in ${processingTime}ms`);
      return {
        success: true,
        postsCount: 0,
        profileId,
        username,
        platform,
        processingTime
      };
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing ${username} after ${processingTime}ms:`, errorMessage);

    // Zapisz błąd do bazy
    await sessionDb.updateSocialAnalysisStatus(profileId, 'failed', errorMessage);
    return {
      success: false,
      postsCount: 0,
      error: errorMessage,
      profileId,
      username,
      platform,
      processingTime
    };
  }
}

// Główny endpoint POST
export async function POST(request: NextRequest) {
  try {
    console.log('=== BACKGROUND SOCIAL ANALYSIS START (PARALLEL) ===');
    console.log('🕐 Timestamp:', new Date().toISOString());

    // Pobierz sessionId z body
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      console.log('❌ No sessionId provided');
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    console.log(`🎯 Starting parallel background analysis for session: ${sessionId}`);

    // Sprawdź token Apify
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log('❌ APIFY_API_TOKEN not configured');
      return NextResponse.json({ error: 'API not configured' }, { status: 500 });
    }

    // Pobierz profile do analizy
    const profiles = await sessionDb.getProfilesForAnalysis(sessionId);

    if (profiles.length === 0) {
      console.log('📭 No profiles found for analysis');
      return NextResponse.json({
        message: 'No profiles need analysis',
        sessionId,
        processed: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📋 Found ${profiles.length} profiles to analyze - processing in PARALLEL`);
    console.log(`👤 Profiles: ${profiles.map(p => `${p.username}(${p.platform})`).join(', ')}`);

    // 🚀 PARALLEL PROCESSING: Uruchom wszystkie profile jednocześnie
    const overallStartTime = Date.now();

    const promises = profiles.map(profile =>
      processProfile(profile, apifyToken)
        .catch(error => ({
          success: false,
          postsCount: 0,
          error: error.message,
          profileId: profile.id,
          username: profile.username,
          platform: profile.platform,
          processingTime: 0
        }))
    );

    console.log(`🚀 Launched ${promises.length} parallel Apify requests`);

    // Czekaj na wszystkie wyniki (lub timeouty)
    const results = await Promise.allSettled(promises);
    const overallProcessingTime = Date.now() - overallStartTime;

    // Przetworz wyniki
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Promise rejected
        const profile = profiles[index];
        return {
          success: false,
          postsCount: 0,
          error: result.reason?.message || 'Promise rejected',
          profileId: profile.id,
          username: profile.username,
          platform: profile.platform,
          processingTime: overallProcessingTime
        };
      }
    });

    // Statystyki
    const successCount = processedResults.filter(r => r.success).length;
    const errorCount = processedResults.length - successCount;
    const totalPosts = processedResults.reduce((sum, r) => sum + r.postsCount, 0);
    const avgProcessingTime = processedResults.reduce((sum, r) => sum + r.processingTime, 0) / processedResults.length;

    // Podsumowanie
    console.log(`✅ PARALLEL background analysis completed for session ${sessionId}`);
    console.log(`📊 Results: ${successCount} success, ${errorCount} errors`);
    console.log(`⏱️ Overall time: ${overallProcessingTime}ms, Average per profile: ${Math.round(avgProcessingTime)}ms`);
    console.log(`📱 Total posts collected: ${totalPosts}`);
    console.log('=== BACKGROUND SOCIAL ANALYSIS END (PARALLEL) ===');

    return NextResponse.json({
      sessionId,
      processed: profiles.length,
      success: successCount,
      errors: errorCount,
      totalPosts,
      overallProcessingTime,
      averageProcessingTime: Math.round(avgProcessingTime),
      results: processedResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in parallel background social analysis:', error);
    return NextResponse.json({
      error: 'Background analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint dla testów/statusu
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({
      service: 'background-social-analysis',
      usage: 'POST with { "sessionId": "ABC123" }',
      description: 'Analyzes social media profiles for session participants in PARALLEL'
    });
  }

  // Zwróć progress dla sesji
  const progress = await sessionDb.getSocialAnalysisProgress(sessionId);

  return NextResponse.json({
    sessionId,
    progress,
    timestamp: new Date().toISOString()
  });
}