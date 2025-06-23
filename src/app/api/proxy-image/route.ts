// src/app/api/proxy-image/route.ts - POPRAWIONA WERSJA
import { NextRequest, NextResponse } from 'next/server';

// 🌍 INSTAGRAM CDN DOMAINS
const INSTAGRAM_CDN_DOMAINS = [
  'scontent-del1-2.cdninstagram.com',
  'scontent-frx5-1.cdninstagram.com',
  'scontent-lhr8-1.cdninstagram.com',
  'scontent.cdninstagram.com',
  'instagram.fxxx-x.fna.fbcdn.net'
];

// 🔗 LINKEDIN CDN DOMAINS - ROZSZERZONE
const LINKEDIN_CDN_DOMAINS = [
  'media.licdn.com',
  'media-exp1.licdn.com',
  'media-exp2.licdn.com',
  'media-exp3.licdn.com',
  'dms.licdn.com',
  'static-exp1.licdn.com',
  'static-exp2.licdn.com',
  'static.licdn.com'
];

// 🔄 Generate LinkedIn CDN alternatives
function generateLinkedInAlternatives(originalUrl: string): string[] {
  const alternatives: string[] = [originalUrl];

  const urlPattern = /https:\/\/[^\/]+(.+)/;
  const pathMatch = originalUrl.match(urlPattern);

  if (!pathMatch) return alternatives;

  const pathAndParams = pathMatch[1];

  // Generate alternatives with different LinkedIn CDN domains
  LINKEDIN_CDN_DOMAINS.forEach(domain => {
    if (!originalUrl.includes(domain)) {
      alternatives.push(`https://${domain}${pathAndParams}`);
    }
  });

  return alternatives;
}

// 🔄 Generate Instagram CDN alternatives
function generateInstagramAlternatives(originalUrl: string): string[] {
  const alternatives: string[] = [originalUrl];

  const urlPattern = /https:\/\/[^\/]+(.+)/;
  const pathMatch = originalUrl.match(urlPattern);

  if (!pathMatch) return alternatives;

  const pathAndParams = pathMatch[1];

  INSTAGRAM_CDN_DOMAINS.forEach(domain => {
    if (!originalUrl.includes(domain)) {
      alternatives.push(`https://${domain}${pathAndParams}`);
    }
  });

  return alternatives;
}

// 🎲 Get random user agent
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 🔍 Determine platform type
function detectPlatform(imageUrl: string): 'instagram' | 'linkedin' | 'other' {
  // Najpierw sprawdź LinkedIn (żeby uniknąć konfliktu z fbcdn.net)
  const isLinkedIn = LINKEDIN_CDN_DOMAINS.some(domain => imageUrl.includes(domain)) ||
                     imageUrl.includes('linkedin.com');

  if (isLinkedIn) return 'linkedin';

  // Potem sprawdź Instagram
  const isInstagram = INSTAGRAM_CDN_DOMAINS.some(domain => imageUrl.includes(domain)) ||
                     imageUrl.includes('instagram.com') ||
                     imageUrl.includes('cdninstagram.com') ||
                     imageUrl.includes('fbcdn.net'); // Tylko jeśli nie jest LinkedIn

  if (isInstagram) return 'instagram';

  return 'other';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('📸 Image proxy request for:', imageUrl?.substring(0, 80) + '...');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Enhanced domain validation
    const allowedDomains = [
      ...INSTAGRAM_CDN_DOMAINS,
      ...LINKEDIN_CDN_DOMAINS,
      'instagram.com',
      'linkedin.com',
      'fbcdn.net'
    ];

    const isAllowedDomain = allowedDomains.some(domain => imageUrl.includes(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Image URL not from allowed domain' }, { status: 403 });
    }

    const platform = detectPlatform(imageUrl);
    console.log(`🎯 Detected platform: ${platform.toUpperCase()}`);

    // 🔗 LINKEDIN STRATEGY with CDN alternatives
    if (platform === 'linkedin') {
      const cdnAlternatives = generateLinkedInAlternatives(imageUrl);
      console.log(`🔄 Generated ${cdnAlternatives.length} LinkedIn CDN alternatives`);

      // Try each LinkedIn CDN alternative
      for (let i = 0; i < cdnAlternatives.length; i++) {
        const alternativeUrl = cdnAlternatives[i];
        const isOriginal = i === 0;

        console.log(`🎯 Trying LinkedIn CDN ${i + 1}/${cdnAlternatives.length}: ${isOriginal ? 'ORIGINAL' : 'ALTERNATIVE'}`);
        console.log(`🔗 URL: ${alternativeUrl.substring(0, 80)}...`);

        try {
          const linkedInHeaders = {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.linkedin.com/',
            'Connection': 'close',
            'Cache-Control': 'no-cache',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
          };

          const response = await fetch(alternativeUrl, {
            headers: linkedInHeaders,
            signal: AbortSignal.timeout(isOriginal ? 15000 : 10000) // Dłuższy timeout dla LinkedIn
          });

          if (response.ok) {
            console.log(`✅ LinkedIn CDN ${i + 1} SUCCESS: ${response.status} (${isOriginal ? 'original' : 'alternative'} CDN)`);

            const imageArrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);

            console.log(`✅ LinkedIn image fetched successfully via CDN ${i + 1}, size: ${imageBuffer.length.toLocaleString()} bytes`);

            let contentType = response.headers.get('content-type') || 'image/jpeg';
            if (!contentType.startsWith('image/')) {
              contentType = 'image/jpeg';
            }

            return new NextResponse(imageBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Content-Length': imageBuffer.length.toString(),
                'X-CDN-Used': isOriginal ? 'linkedin-original' : `linkedin-alternative-${i}`,
                'X-Platform': 'linkedin'
              },
            });
          } else {
            console.log(`❌ LinkedIn CDN ${i + 1} failed: ${response.status}`);
          }

        } catch (error) {
          console.log(`❌ LinkedIn CDN ${i + 1} error:`, (error as Error).message);
        }

        // Small delay between LinkedIn CDN attempts
        if (i < cdnAlternatives.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('❌ ALL LinkedIn CDN alternatives failed');
    }

    // 🌍 INSTAGRAM STRATEGY with CDN alternatives
    if (platform === 'instagram') {
      const cdnAlternatives = generateInstagramAlternatives(imageUrl);
      console.log(`🔄 Generated ${cdnAlternatives.length} Instagram CDN alternatives`);

      // Try each Instagram CDN alternative
      for (let i = 0; i < cdnAlternatives.length; i++) {
        const alternativeUrl = cdnAlternatives[i];
        const isOriginal = i === 0;

        console.log(`🎯 Trying Instagram CDN ${i + 1}/${cdnAlternatives.length}: ${isOriginal ? 'ORIGINAL' : 'ALTERNATIVE'}`);

        try {
          const headers = {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
          };

          const response = await fetch(alternativeUrl, {
            headers,
            signal: AbortSignal.timeout(isOriginal ? 8000 : 6000)
          });

          if (response.ok) {
            console.log(`✅ Instagram CDN ${i + 1} SUCCESS: ${response.status}`);

            const imageArrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);

            let contentType = response.headers.get('content-type') || 'image/jpeg';
            if (!contentType.startsWith('image/')) {
              contentType = 'image/jpeg';
            }

            return new NextResponse(imageBuffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Content-Length': imageBuffer.length.toString(),
                'X-CDN-Used': isOriginal ? 'instagram-original' : `instagram-alternative-${i}`,
                'X-Platform': 'instagram'
              },
            });
          }

        } catch (error) {
          console.log(`❌ Instagram CDN ${i + 1} error:`, (error as Error).message);
        }

        if (i < cdnAlternatives.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('❌ ALL Instagram CDN alternatives failed');
    }

    // 🎨 ULTIMATE FALLBACK: Generate platform-specific avatar
    console.log('🎨 All CDN attempts failed, generating avatar fallback');

    const avatarSvg = `
      <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${platform === 'linkedin' ? '#0077b5' : '#6366f1'};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${platform === 'linkedin' ? '#004182' : '#8b5cf6'};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="150" height="150" fill="url(#grad)"/>
        <circle cx="75" cy="55" r="25" fill="rgba(255,255,255,0.9)"/>
        <path d="M35 120 Q75 95 115 120 L115 150 L35 150 Z" fill="rgba(255,255,255,0.9)"/>
        <text x="75" y="135" text-anchor="middle" fill="#374151" font-size="12" font-family="Arial">
          ${platform === 'linkedin' ? 'LI' : platform === 'instagram' ? 'IG' : 'PF'}
        </text>
      </svg>
    `;

    return new NextResponse(avatarSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Fallback': 'avatar-generated',
        'X-Platform': platform
      },
    });

  } catch (error) {
    console.error('❌ Critical error in image proxy:', error);

    const errorSvg = `
      <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="150" height="150" fill="#ef4444"/>
        <text x="75" y="80" text-anchor="middle" fill="white" font-size="16">⚠️</text>
        <text x="75" y="100" text-anchor="middle" fill="white" font-size="10">Error</text>
      </svg>
    `;

    return new NextResponse(errorSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Access-Control-Allow-Origin': '*',
        'X-Fallback': 'error',
      },
    });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}