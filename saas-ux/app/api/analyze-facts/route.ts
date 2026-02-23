// saas-ux/app/api/analyze-facts/route.ts
import { NextRequest } from "next/server";
import { preScan } from "@/lib/analyzer/preScan";
import { isPublicUrl } from "@/lib/net/isPublicUrl";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(30, "1 m") })
  : null;

function normalizeInput(raw: string) {
  const s = (raw || "").trim();
  if (!s) return s;
  try {
    const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const url = new URL(candidate);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return raw;
  }
}

async function getHostIP(url: string): Promise<string | undefined> {
  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const lookup = promisify(dns.lookup);
    
    const hostname = new URL(url).hostname;
    const result = await lookup(hostname);
    return result.address;
  } catch {
    return undefined;
  }
}

/**
 * Helper to get favicon using multiple fallback strategies with caching
 * 
 * Strategy order:
 * 1. Check Redis cache (instant if cached)
 * 2. Google's favicon service (most reliable, handles all edge cases)
 * 3. Direct /favicon.ico check
 * 4. Parse HTML for <link rel="icon"> tags (comprehensive patterns)
 * 5. Return custom fallback icon (UI Avatars based on domain)
 */
async function getFavicon(url: string): Promise<string> {
  try {
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;
    const domain = parsedUrl.hostname;
    
    // Strategy 0: Check Redis cache first (if available)
    if (redis) {
      try {
        const cacheKey = `favicon:${origin}`;
        const cached = await redis.get<string>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch {
        // Cache read failed, continue to fetching
      }
    }
    
    // Strategy 1: Use Google's favicon service (most reliable)
    const googleFaviconUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=32`;
    
    try {
      const response = await fetch(googleFaviconUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) {
        // Cache the result
        if (redis) {
          try {
            await redis.set(`favicon:${origin}`, googleFaviconUrl, { ex: 86400 }); // 24h cache
          } catch {
            // Cache write failed, but we have the result
          }
        }
        return googleFaviconUrl;
      }
    } catch {
      // Google service failed, try next strategy
    }
    
    // Strategy 2: Try direct /favicon.ico
    const directFaviconUrl = `${origin}/favicon.ico`;
    try {
      const response = await fetch(directFaviconUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      });
      
      if (response.ok && response.headers.get('content-type')?.includes('image')) {
        // Cache the result
        if (redis) {
          try {
            await redis.set(`favicon:${origin}`, directFaviconUrl, { ex: 86400 });
          } catch {
            // Cache write failed, but we have the result
          }
        }
        return directFaviconUrl;
      }
    } catch {
      // Direct favicon.ico not found, try next strategy
    }
    
    // Strategy 3: Parse HTML for favicon link tags
    // Comprehensive patterns to catch buried favicons (like Joomla templates)
    try {
      const htmlResponse = await fetch(url, {
        signal: AbortSignal.timeout(3000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzer/1.0)',
        },
      });
      
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        
        // Comprehensive favicon patterns - order matters (most specific first)
        const iconPatterns = [
          // Standard formats with type attribute
          /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*type=["']image\/[^"']+["'][^>]*href=["']([^"']+)["']/i,
          /<link[^>]*href=["']([^"']+)["'][^>]*type=["']image\/[^"']+["'][^>]*rel=["'](?:shortcut )?icon["']/i,
          
          // Apple touch icons (high quality)
          /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
          /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i,
          
          // Standard icon formats
          /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']+)["']/i,
          /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']+)["']/i,
          /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']icon["']/i,
          /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']shortcut icon["']/i,
          
          // Mask icon (Safari)
          /<link[^>]*rel=["']mask-icon["'][^>]*href=["']([^"']+)["']/i,
          
          // Fluid icon (Fluid.app)
          /<link[^>]*rel=["']fluid-icon["'][^>]*href=["']([^"']+)["']/i,
          
          // Generic link with .ico or .png extension in href
          /<link[^>]*href=["']([^"']*(?:favicon|icon)[^"']*\.(?:ico|png|jpg|jpeg|svg|gif))["'][^>]*>/i,
        ];
        
        for (const pattern of iconPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            let faviconPath = match[1].trim();
            
            // Skip data URIs
            if (faviconPath.startsWith('data:')) {
              continue;
            }
            
            // Handle relative URLs
            if (faviconPath.startsWith('//')) {
              faviconPath = `${parsedUrl.protocol}${faviconPath}`;
            } else if (faviconPath.startsWith('/')) {
              faviconPath = `${origin}${faviconPath}`;
            } else if (!faviconPath.startsWith('http')) {
              // Relative path without leading slash
              faviconPath = `${origin}/${faviconPath}`;
            }
            
            // Verify the favicon exists
            try {
              const verifyResponse = await fetch(faviconPath, {
                method: 'HEAD',
                signal: AbortSignal.timeout(2000),
              });
              
              if (verifyResponse.ok) {
                // Cache the result
                if (redis) {
                  try {
                    await redis.set(`favicon:${origin}`, faviconPath, { ex: 86400 });
                  } catch {
                    // Cache write failed, but we have the result
                  }
                }
                return faviconPath;
              }
            } catch {
              // This favicon URL failed, continue to next pattern
              continue;
            }
          }
        }
      }
    } catch {
      // HTML parsing failed
    }
    
    // Strategy 4: Custom fallback icon using UI Avatars
    // Generates a nice letter-based avatar from the domain name
    const fallbackIcon = `https://ui-avatars.com/api/?name=${encodeURIComponent(domain)}&size=32&background=0D8ABC&color=fff&bold=true&format=svg`;
    
    // Cache the fallback too (shorter TTL since it's generated)
    if (redis) {
      try {
        await redis.set(`favicon:${origin}`, fallbackIcon, { ex: 3600 }); // 1h cache for fallback
      } catch {
        // Cache write failed
      }
    }
    
    return fallbackIcon;
    
  } catch (error) {
    // Ultimate fallback if everything fails
    try {
      const parsedUrl = new URL(url);
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(parsedUrl.hostname)}&size=32&background=0D8ABC&color=fff&bold=true&format=svg`;
    } catch {
      // Even URL parsing failed, use a generic icon
      return `https://ui-avatars.com/api/?name=?&size=32&background=0D8ABC&color=fff&bold=true&format=svg`;
    }
  }
}



type WordPressModuleResponse = {
  url?: string;
  selected_modules?: string[];
  results?: {
    wordpress?: unknown;
    report?: unknown;
  };
  usage_metrics?: unknown;
};

async function fetchWordPressModule(url: string): Promise<WordPressModuleResponse | null> {
  const endpoint = process.env.WP_ANALYZER_ENDPOINT || "http://localhost:5555/analyze";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, agents: ["wordpress"] }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = (await response.json()) as WordPressModuleResponse;
    return data;
  } catch {
    return null;
  }
}

function minimalFacts(target: string, hostIP?: string, faviconUrl?: string) {
  try {
    const u = new URL(target);
    const origin = u.origin;
    return {
      inputUrl: target,
      finalUrl: target,
      domain: u.hostname,
      status: 0,
      isHttps: u.protocol === "https:",
      siteLang: null,
      faviconUrl: faviconUrl || `${origin}/favicon.ico`,
      hostIP,
      cms: { type: "unknown" as const },
      meta: { 
        title: "", 
        description: "", 
        titleLen: 0, 
        descriptionLen: 0, 
        robotsMeta: "", 
        hasCanonical: false 
      },
      dom: { 
        h1Count: 0, 
        imgCount: 0, 
        scriptCount: 0, 
        linkCount: 0 
      },
      accessibility: { 
        imgMissingAlt: 0, 
        imgWithoutAltRatio: 0 
      },
      perfHints: { 
        approxHtmlBytes: 0, 
        heavyScriptHint: false, 
        heavyImageHint: false 
      },
      headers: {},
    };
  } catch {
    return {
      inputUrl: target,
      finalUrl: target,
      domain: "",
      status: 0,
      isHttps: false,
      siteLang: null,
      faviconUrl: faviconUrl || null,
      hostIP,
      cms: { type: "unknown" as const },
      meta: { 
        title: "", 
        description: "", 
        titleLen: 0, 
        descriptionLen: 0, 
        robotsMeta: "", 
        hasCanonical: false 
      },
      dom: { 
        h1Count: 0, 
        imgCount: 0, 
        scriptCount: 0, 
        linkCount: 0 
      },
      accessibility: { 
        imgMissingAlt: 0, 
        imgWithoutAltRatio: 0 
      },
      perfHints: { 
        approxHtmlBytes: 0, 
        heavyScriptHint: false, 
        heavyImageHint: false 
      },
      headers: {},
    };
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url") || "";
  const target = normalizeInput(urlParam);

  if (!isPublicUrl(target)) {
    return new Response("Invalid URL", { status: 400 });
  }

  if (ratelimit) {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const { success } = await ratelimit.limit(`facts:${ip}`);
    if (!success) return new Response("Rate limit", { status: 429 });
  }

  // Run all data fetching in parallel for best performance
  const hostIPPromise = getHostIP(target);
  const faviconPromise = getFavicon(target);

  try {
    const [facts, hostIP, faviconUrl] = await Promise.all([
      preScan(target),
      hostIPPromise,
      faviconPromise
    ]);

    const wordpressModule = facts.cms?.type === "wordpress"
      ? await fetchWordPressModule(target)
      : null;

    // Merge all data together
    const enrichedFacts = {
      ...facts,
      hostIP,
      // Always use our reliable favicon fetching
      faviconUrl: faviconUrl,
      wordpressModule,
    };
    
    return Response.json(enrichedFacts, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Get hostIP and favicon even in error case
    const [hostIP, faviconUrl] = await Promise.all([
      hostIPPromise,
      faviconPromise
    ]);
    
    const fallback = minimalFacts(target, hostIP, faviconUrl);
    return Response.json(fallback, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}