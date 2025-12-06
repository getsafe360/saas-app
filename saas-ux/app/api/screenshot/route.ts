// app/api/screenshot/route.ts
import { NextRequest } from "next/server";
import { chromium } from "playwright-core";
import type { Browser, BrowserContext, Page } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Keep browser instance alive
let cachedBrowser: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  // Try to use chromium from @sparticuz/chromium for AWS Lambda
  try {
    const chromiumPkg = await import("@sparticuz/chromium");
    const execPath = await chromiumPkg.default.executablePath();
    
    if (execPath) {
      return await chromium.launch({
        executablePath: execPath,
        args: chromiumPkg.default.args,
        headless: true,
      });
    }
  } catch {
    // Fall back to system chromium
  }
  
  // Local development - use system browser
  return await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.isConnected()) {
    return cachedBrowser;
  }
  
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  
  browserLaunchPromise = launchBrowser();
  cachedBrowser = await browserLaunchPromise;
  browserLaunchPromise = null;
  
  return cachedBrowser;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Cookie consent handler - supports multiple frameworks
async function handleCookieConsent(page: Page) {
  try {
    await page.evaluate(() => {
      // OneTrust selectors (most common)
      const oneTrustSelectors = [
        '#onetrust-accept-btn-handler',
        'button#onetrust-accept-btn-handler',
        '.onetrust-close-btn-handler',
        '[id*="accept-recommended-btn"]',
      ];

      // Cookiebot selectors
      const cookiebotSelectors = [
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '#CybotCookiebotDialogBodyButtonAccept',
        '.CybotCookiebotDialogBodyButton[data-action="accept"]',
      ];

      // Generic selectors (multi-language support)
      const genericSelectors = [
        // English
        'button[aria-label*="accept" i]',
        'button[aria-label*="agree" i]',
        'button[title*="accept" i]',
        'a[aria-label*="accept" i]',
        // German
        'button[aria-label*="akzeptieren" i]',
        'button[aria-label*="zustimmen" i]',
        // Spanish
        'button[aria-label*="aceptar" i]',
        // French
        'button[aria-label*="accepter" i]',
        // Portuguese
        'button[aria-label*="aceitar" i]',
        // Italian
        'button[aria-label*="accettare" i]',
        // Text content fallback
        'button:has-text("Accept all")',
        'button:has-text("Accept All")',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Aceptar todo")',
      ];

      // Try all selector groups
      const allSelectors = [
        ...oneTrustSelectors,
        ...cookiebotSelectors,
        ...genericSelectors,
      ];

      let clicked = false;
      for (const selector of allSelectors) {
        try {
          const el = document.querySelector(selector) as HTMLElement;
          if (el && el.offsetParent !== null) { // Check if visible
            el.click();
            clicked = true;
            break;
          }
        } catch {}
      }

      // If no button found, forcefully hide common overlays
      if (!clicked) {
        const overlaySelectors = [
          // OneTrust
          '#onetrust-banner-sdk',
          '#onetrust-consent-sdk',
          '.onetrust-pc-dark-filter',
          '.ot-sdk-container',
          // Cookiebot
          '#CybotCookiebotDialog',
          '#CookiebotWidget',
          // Generic
          '.cookie-consent',
          '.cookie-banner',
          '.cookie-notice',
          '.cc-window',
          '.cc-banner',
          '[class*="cookie"][class*="banner"]',
          '[class*="cookie"][class*="consent"]',
          '[id*="cookie"][id*="banner"]',
          '[id*="cookie"][id*="consent"]',
          // GDPR-specific
          '.gdpr-banner',
          '#gdpr-banner',
          '[class*="gdpr"]',
        ];

        for (const selector of overlaySelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              if (el instanceof HTMLElement) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
              }
            });
          } catch {}
        }

        // Remove backdrop/overlay filters
        const backdrops = document.querySelectorAll('[class*="backdrop"], [class*="overlay"]');
        backdrops.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.setProperty('display', 'none', 'important');
          }
        });
      }
    });

    // Give page time to settle after interaction
    await page.waitForTimeout(300);
  } catch (error) {
    // Silently fail - don't break screenshot if consent handling fails
    console.warn('Cookie consent handling failed:', error);
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  const w = clamp(parseInt(req.nextUrl.searchParams.get("w") || "650", 10), 320, 1600);
  const h = req.nextUrl.searchParams.get("h") 
    ? clamp(parseInt(req.nextUrl.searchParams.get("h")!, 10), 400, 2000) 
    : undefined;
  const q = clamp(parseInt(req.nextUrl.searchParams.get("q") || "60", 10), 25, 90);
  const mobile = req.nextUrl.searchParams.get("mobile") === "1";
  const handleConsent = req.nextUrl.searchParams.get("consent") !== "0"; // Default true

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    const browser = await getBrowser();
    
    // Create context with viewport
    context = await browser.newContext({
      viewport: {
        width: mobile ? 390 : w,
        height: mobile ? (h || 844) : (h || Math.round((w * 7) / 12))
      },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      userAgent: mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    page = await browser.newPage();

    // Aggressive resource blocking for speed
    await page.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block non-essential resources
      if (
        ['font', 'media', 'websocket'].includes(resourceType) ||
        url.includes('analytics') ||
        url.includes('ads') ||
        url.includes('tracking') ||
        url.includes('gtag') ||
        url.includes('facebook') ||
        url.includes('twitter') ||
        url.includes('doubleclick')
      ) {
        route.abort();
      } else if (resourceType === 'image' && !mobile) {
        // On desktop, be selective about images
        if (url.includes('hero') || url.includes('logo') || url.includes('banner')) {
          route.continue();
        } else {
          route.abort();
        }
      } else {
        route.continue();
      }
    });

    // Navigate to page
    try {
      await page.goto(url, { 
        waitUntil: "domcontentloaded",
        timeout: 8000
      });
    } catch {
      // Ignore timeout - screenshot what we have
    }

    // Handle cookie consent if enabled
    if (handleConsent) {
      await handleCookieConsent(page);
    }

    // Brief render delay
    await page.waitForTimeout(600);

    // Take screenshot
    const buf = await page.screenshot({ 
      type: "jpeg", 
      quality: q,
      fullPage: false,
    });

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, s-maxage=2592000, max-age=600",
        "CDN-Cache-Control": "max-age=2592000"
      }
    });

  } catch (err: any) {
    console.error(`Screenshot failed for ${url}:`, err.message);
    return new Response(null, { status: 204 });
    
  } finally {
    try { 
      if (page) await page.close();
      if (context) await context.close();
    } catch {}
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {});
  }
});