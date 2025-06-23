// src/app/api/proxy-image/route.ts - CDN FALLBACK SOLUTION
import { NextRequest, NextResponse } from 'next/server';

// 🌍 INSTAGRAM CDN DOMAINS (from most reliable to fallbacks)
const INSTAGRAM_CDN_DOMAINS = [
  'scontent-del1-2.cdninstagram.com',  // ✅ Works well
  'scontent-frx5-1.cdninstagram.com',
  'scontent-lhr8-1.cdninstagram.com',
  'scontent.cdninstagram.com',
  'instagram.fxxx-x.fna.fbcdn.net'  // Wildcard pattern for fbcdn
];

// 🔄 Generate alternative CDN URLs for same image
function generateCDNAlternatives(originalUrl: string): string[] {
  const alternatives: string[] = [originalUrl]; // Start with original

  // Extract path and parameters (everything after domain)
  const urlPattern = /https:\/\/[^\/]+(.+)/;
  const pathMatch = originalUrl.match(urlPattern);

  if (!pathMatch) return alternatives;

  const pathAndParams = pathMatch[1];

  // Generate alternatives with different CDN domains
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('📸 Image proxy request for:', imageUrl?.substring(0, 80) + '...');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Domain validation
    const allowedDomains = [
      'cdninstagram.com', 'fbcdn.net', 'instagram.com', 'scontent-',
      'media.licdn.com', 'licdn.com',
    ];

    const isAllowedDomain = allowedDomains.some(domain => imageUrl.includes(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Image URL not from allowed domain' }, { status: 403 });
    }

    const isInstagram = allowedDomains.slice(0, 4).some(domain => imageUrl.includes(domain));
    const isLinkedIn = imageUrl.includes('licdn.com');

    // 🌍 MAIN STRATEGY: CDN alternatives for Instagram
    if (isInstagram) {
      const cdnAlternatives = generateCDNAlternatives(imageUrl);
      console.log(`🔄 Generated ${cdnAlternatives.length} CDN alternatives for Instagram image`);

      // Try each CDN alternative
      for (let i = 0; i < cdnAlternatives.length; i++) {
        const alternativeUrl = cdnAlternatives[i];
        const isOriginal = i === 0;

        console.log(`🎯 Trying CDN ${i + 1}/${cdnAlternatives.length}: ${isOriginal ? 'ORIGINAL' : 'ALTERNATIVE'}`);
        console.log(`🔗 URL: ${alternativeUrl.substring(0, 80)}...`);

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
            signal: AbortSignal.timeout(isOriginal ? 8000 : 6000) // Shorter timeout for alternatives
          });

          if (response.ok) {
            console.log(`✅ CDN ${i + 1} SUCCESS: ${response.status} (${isOriginal ? 'original' : 'alternative'} CDN)`);

            const imageArrayBuffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(imageArrayBuffer);

            console.log(`✅ Image fetched successfully via CDN ${i + 1}, size: ${imageBuffer.length.toLocaleString()} bytes`);

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
                'X-CDN-Used': isOriginal ? 'original' : `alternative-${i}`,
              },
            });
          } else {
            console.log(`❌ CDN ${i + 1} failed: ${response.status}`);
          }

        } catch (error) {
          console.log(`❌ CDN ${i + 1} error:`, (error as Error).message);
        }

        // Small delay between CDN attempts
        if (i < cdnAlternatives.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('❌ ALL CDN alternatives failed for Instagram image');
    }

    // 🔗 LINKEDIN FALLBACK (original logic)
    if (isLinkedIn) {
      console.log('🔗 Trying LinkedIn with optimized headers...');

      try {
        const linkedInHeaders = {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'image/*',
          'Referer': 'https://www.linkedin.com/',
          'Connection': 'close'
        };

        const response = await fetch(imageUrl, {
          headers: linkedInHeaders,
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const imageArrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(imageArrayBuffer);

          console.log(`✅ LinkedIn image fetched, size: ${imageBuffer.length.toLocaleString()} bytes`);

          let contentType = response.headers.get('content-type') || 'image/jpeg';

          return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*',
              'Content-Length': imageBuffer.length.toString(),
            },
          });
        }
      } catch (error) {
        console.log('❌ LinkedIn fetch failed:', (error as Error).message);
      }
    }

    // 🎨 ULTIMATE FALLBACK: Generate avatar initials
    console.log('🎨 All CDN attempts failed, generating avatar fallback');

    // Extract username or initials from URL for personalized avatar
    const usernameMatch = imageUrl.match(/\/([^\/]+)_n\.jpg/);
    const userId = usernameMatch ? usernameMatch[1].substring(0, 2).toUpperCase() : 'IG';

    const avatarSvg = `
      <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="150" height="150" fill="url(#grad)"/>
        <circle cx="75" cy="55" r="25" fill="rgba(255,255,255,0.9)"/>
        <path d="M35 120 Q75 95 115 120 L115 150 L35 150 Z" fill="rgba(255,255,255,0.9)"/>
        <text x="75" y="135" text-anchor="middle" fill="#374151" font-size="12" font-family="Arial">
          ${isInstagram ? 'IG' : isLinkedIn ? 'LI' : userId}
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
      },
    });

  } catch (error) {
    console.error('❌ Critical error in image proxy:', error);

    // Error fallback avatar
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