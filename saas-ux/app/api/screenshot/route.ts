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
  // Return cached browser if still alive
  if (cachedBrowser && cachedBrowser.isConnected()) {
    return cachedBrowser;
  }
  
  // If already launching, wait for that
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  
  // Launch new browser
  browserLaunchPromise = launchBrowser();
  cachedBrowser = await browserLaunchPromise;
  browserLaunchPromise = null;
  
  return cachedBrowser;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    page = await context.newPage();

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

    // Race between page load and timeout
    try {
      await page.goto(url, { 
        waitUntil: "domcontentloaded",
        timeout: 8000
      });
    } catch {
      // Ignore timeout - we'll screenshot what we have
    }

const quickAnalysis = await page.evaluate(() => {
  // SEO Quick Checks (10 checks, ~50ms)
  const seoIssues = {
    noTitle: !document.title,
    titleTooShort: document.title.length < 30,
    titleTooLong: document.title.length > 60,
    noMetaDescription: !document.querySelector('meta[name="description"]'),
    multipleH1: document.querySelectorAll('h1').length !== 1,
    imagesNoAlt: document.querySelectorAll('img:not([alt])').length,
    noCanonical: !document.querySelector('link[rel="canonical"]'),
    noOpenGraph: !document.querySelector('meta[property^="og:"]'),
  };

// Accessibility Quick Checks (8 checks, ~50ms)
const a11yIssues = {
  lowContrast: 0, // Would need color calculation - skip for quick
  missingLang: !document.documentElement.lang,
  buttonsNoLabel: document.querySelectorAll('button:not([aria-label])').length,
  linksNoText: Array.from(document.querySelectorAll<HTMLAnchorElement>('a:not([aria-label])'))
    .filter(a => !a.textContent?.trim())
    .length,
  formInputsNoLabels: Array.from(document.querySelectorAll<HTMLInputElement>('input'))
    .filter(input => !input.labels?.length && !input.getAttribute('aria-label'))
    .length,
  imagesNoAltA11y: document.querySelectorAll('img:not([alt])').length,
};

  // Performance Quick Checks (6 checks, ~30ms)
  const perfIssues = {
    tooManyResources: performance.getEntriesByType('resource').length > 100,
    largeDOM: document.querySelectorAll('*').length > 1500,
    noLazyLoading: document.querySelectorAll('img:not([loading="lazy"])').length,
    inlineStyles: document.querySelectorAll('[style]').length > 20,
    blockingScripts: document.querySelectorAll('script:not([async]):not([defer])').length,
  };

  // Security Quick Checks (5 checks, ~30ms)
  const secIssues = {
    notHttps: location.protocol !== 'https:',
    mixedContent: Array.from(document.querySelectorAll('[src],[href]')).filter(
      el => el.getAttribute('src')?.startsWith('http:')
    ).length,
    noCSP: !document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
    inlineJavaScript: document.querySelectorAll('script:not([src])').length,
  };

  return {
    seo: seoIssues,
    a11y: a11yIssues,
    perf: perfIssues,
    sec: secIssues,
    timing: (() => {
  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navEntry) {
    return Math.round(navEntry.loadEventEnd - navEntry.fetchStart);
  }
  // Fallback to deprecated API if needed
  return performance.timing ? 
    performance.timing.loadEventEnd - performance.timing.navigationStart : 
    0;
})(),
  };
});

    // Brief render delay
    await delay(600);

    // Take screenshot
    const buf = await page.screenshot({ 
      type: "jpeg", 
      quality: q,
      fullPage: false,
    });

    return new Response(buf, {
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
      // Don't close browser - keep it warm
    } catch {}
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {});
  }
});