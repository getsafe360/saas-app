// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Add "CMS" category for the CMS detector
type Category = "SEO" | "Accessibility" | "Performance" | "Security" | "CMS";
type Severity = "info" | "warn" | "error";

function ndjson(obj: any) {
  return JSON.stringify(obj) + "\n";
}

// ---------------------------
// GET /api/analyze?url=...
// Streams NDJSON chunks: status/score/finding/screenshot/favicon/done
// ---------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing `url` query param" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = async (chunk: any) => controller.enqueue(encoder.encode(ndjson(chunk)));

      try {
        await write({ event: "status", message: "starting", url });

        // Kick off screenshot + favicon in parallel
        const screenshotPromise = takeScreenshotFlexible(url, write).catch(async (err) => {
          await write({ event: "error", message: `screenshot failed: ${String(err)}` });
          return null;
        });
        const faviconPromise = captureFavicon(url, write).catch(async (err) => {
          await write({ event: "status", message: `favicon skipped: ${String(err)}` });
          return null;
        });

        // --- DEMO STREAM (replace with WebsiteAnalyzerCrew) ---
        const early: { cat: Category; score: number; msg: string; sev: Severity }[] = [
          { cat: "SEO",           score: 64, msg: "Missing meta description",           sev: "warn"  },
          { cat: "Performance",   score: 58, msg: "LCP above 4s on mobile",             sev: "error" },
          { cat: "Accessibility", score: 79, msg: "Buttons have insufficient contrast", sev: "warn"  },
          { cat: "Security",      score: 72, msg: "No HSTS header found",               sev: "warn"  },
        ];
        for (const e of early) {
          await write({ event: "score",   category: e.cat, score: e.score });
          await new Promise((r) => setTimeout(r, 180));
          await write({ event: "finding", category: e.cat, severity: e.sev, message: e.msg });
          await new Promise((r) => setTimeout(r, 120));
        }
        // --- /DEMO ---

        // Wait for screenshot + favicon
        const [shot, fav] = await Promise.all([screenshotPromise, faviconPromise]);

        if (shot) await write({ event: "screenshot", screenshotUrl: shot });
        else await write({ event: "status", message: "no screenshot produced" });

        if (fav) await write({ event: "favicon", faviconUrl: fav });

        await write({ event: "done" });
        controller.close();
      } catch (err) {
        try { await controller.enqueue(encoder.encode(ndjson({ event: "error", message: String(err) }))); } catch {}
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Dev uses `puppeteer` (auto Chrome), Prod uses `puppeteer-core` + `@sparticuz/chromium`. */
type PBrowser = import("puppeteer-core").Browser | import("puppeteer").Browser;
type PPage    = import("puppeteer-core").Page    | import("puppeteer").Page;

async function takeScreenshotFlexible(targetUrl: string, write: (c: any) => Promise<void>): Promise<string | null> {
  const isProd       = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  let browser: PBrowser | null = null;

  try {
    await write({ event: "status", message: "launching browser" });

    if (isProd) {
      const chromium      = (await import("@sparticuz/chromium")).default;
      const puppeteerCore = (await import("puppeteer-core")).default;

      const executablePath = await chromium.executablePath();
      browser = await puppeteerCore.launch({
        args: [
          ...chromium.args,
          "--disable-dev-shm-usage",
          "--hide-scrollbars",
          "--disable-gpu",
          "--no-zygote",
          "--single-process",
        ],
        defaultViewport: { width: 1280, height: 800 },
        executablePath,
        headless: true,
      });
    } else {
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        defaultViewport: { width: 1280, height: 800 },
      });
    }

    const page: PPage = await (browser as any).newPage();

    const UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    await page.setUserAgent(UA).catch(() => {});
    await page.setBypassCSP(true).catch(() => {});
    await page.emulateMediaType("screen").catch(() => {});

    try {
      await page.setRequestInterception(true);
      page.on("request", (req: any) => {
        const type = req.resourceType();
        if (type === "media" || type === "font") return req.abort();
        return req.continue();
      });
    } catch {}

    await write({ event: "status", message: "navigating" });

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle2",    timeout: 30000 });
    } catch {
      await write({ event: "status", message: "networkidle2 timed out; trying domcontentloaded" });
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    }

    // tiny settle
    await new Promise((res) => setTimeout(res, 900));

    // --- CMS Detection (WordPress) ---
    await write({ event: "status", message: "detecting CMS" });
    try {
      const cms = await detectCMS(page, targetUrl);
      if (cms) {
        // as requested: no details, just "WordPress"
        await write({ event: "finding", category: "CMS", severity: "info", message: cms.name });
      }
    } catch (e) {
      await write({ event: "status", message: `cms detection skipped: ${String(e)}` });
    }

    // --- Screenshot: capture at 1280×800, then resize to 450px width with sharp ---
    await page.setViewport({ width: 1280, height: 800 }).catch(() => {});
    await write({ event: "status", message: "taking screenshot" });

    let raw: Buffer | null = null;
    try {
      raw = (await page.screenshot({
        type: "webp",
        quality: 80,     // capture a bit higher quality first
        fullPage: false, // above-the-fold only
        clip: { x: 0, y: 0, width: 1280, height: 800 },
      })) as Buffer;
    } catch {
      raw = (await page.screenshot({ type: "webp", fullPage: false, quality: 80 })) as Buffer;
    }

    if (!raw) {
      await write({ event: "error", message: "screenshot buffer is empty" });
      return null;
    }

    // Resize → 450px width, WEBP q=72 (typically ~40–80 KB)
    const preview = await sharp(raw).resize({ width: 450 }).webp({ quality: 72 }).toBuffer();

    if (hasBlobToken) {
      await write({ event: "status", message: "uploading screenshot" });
      const key = `screenshots/${hash(targetUrl)}-${Date.now()}.webp`;
      const res = await put(key, preview, { access: "public", contentType: "image/webp" });
      await write({ event: "status", message: "upload complete" });
      return res.url;
    } else {
      await write({ event: "status", message: "no BLOB token; returning data URL" });
      return `data:image/webp;base64,${preview.toString("base64")}`;
    }
  } catch (err) {
    await write({ event: "error", message: `screenshot exception: ${String(err)}` });
    return null;
  } finally {
    try { await (browser as any)?.close(); } catch {}
  }
}

function hash(s: string) {
  let h = 0, i = 0;
  while (i < s.length) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return (h >>> 0).toString(36);
}

/* ------------------------- CMS Detection ------------------------- */
async function detectCMS(page: PPage, targetUrl: string): Promise<{ name: string } | null> {
  const metaInfo = await (page as any).evaluate(() => {
    const meta = document.querySelector('meta[name="generator"]') as HTMLMetaElement | null;
    const generator = meta?.content || "";
    const hasWpRest = !!document.querySelector('link[rel="https://api.w.org/"]');
    const html = document.documentElement?.outerHTML || "";
    return { generator, hasWpRest, htmlSlice: html.slice(0, 200_000) };
  });

  if (/wordpress/i.test(metaInfo.generator) ||
      /wp-content|wp-includes/i.test(metaInfo.htmlSlice) ||
      metaInfo.hasWpRest) {
    // Optional: probe /wp-json (fast, but safe to skip if you want to be ultra-cheap)
    try {
      const origin = new URL(targetUrl).origin;
      const wpJson = await fetch(`${origin}/wp-json`, { method: "GET", redirect: "follow" });
      if (wpJson.ok) return { name: "WordPress" };
    } catch { /* ignore */ }
    return { name: "WordPress" };
  }

  return null;
}

/* ------------------------- Favicon capture ------------------------- */
async function captureFavicon(targetUrl: string, write: (c: any) => Promise<void>): Promise<string | null> {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await write({ event: "status", message: "resolving favicon" });
    const origin = new URL(targetUrl).origin;

    // Try common link rels by fetching HTML quickly (cheapest path is to reuse DOM, but we’re in API route)
    // Since we already load the page in puppeteer above, the truly cheap way is to pass the resolved href
    // through a shared channel. To keep this self-contained, try well-known locations first:
    const candidates = [
      `${origin}/favicon.ico`,
      `${origin}/favicon.png`,
      `${origin}/favicon.webp`,
    ];

    // If we fail to fetch any, fall back to Google S2 service
    let data: Buffer | null = null;
    for (const href of candidates) {
      try {
        const r = await fetch(href, { redirect: "follow" });
        if (r.ok && r.headers.get("content-type")?.startsWith("image")) {
          const buf = Buffer.from(await r.arrayBuffer());
          // normalize to 64×64 webp
          data = await sharp(buf).resize({ width: 64, height: 64, fit: "cover" }).webp({ quality: 80 }).toBuffer();
          break;
        }
      } catch {
        // ignore and try next
      }
    }

    if (!data) {
      // fallback external URL (no upload needed)
      const google = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
      return google;
    }

    if (!hasBlobToken) {
      return `data:image/webp;base64,${data.toString("base64")}`;
    }

    const key = `favicons/${hash(targetUrl)}-${Date.now()}.webp`;
    const res = await put(key, data, { access: "public", contentType: "image/webp" });
    return res.url;
  } catch (err) {
    await write({ event: "status", message: `favicon error: ${String(err)}` });
    return null;
  }
}
