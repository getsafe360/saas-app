import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Category = "SEO" | "Accessibility" | "Performance" | "Security";
function ndjson(obj: any) { return JSON.stringify(obj) + "\n"; }

// ---------------------------
// GET /api/analyze?url=...
// Streams NDJSON chunks: status/score/finding/screenshot/done
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

        // Kick off screenshot in parallel
        const screenshotPromise = takeScreenshotFlexible(url, write).catch(async (err) => {
          await write({ event: "error", message: `screenshot failed: ${String(err)}` });
          return null;
        });

        // --- DEMO STREAM (replace with WebsiteAnalyzerCrew) ---
        const early: { cat: Category; score: number; msg: string; sev: "info"|"warn"|"error" }[] = [
          { cat: "SEO", score: 64, msg: "Missing meta description", sev: "warn" },
          { cat: "Performance", score: 58, msg: "LCP above 4s on mobile", sev: "error" },
          { cat: "Accessibility", score: 79, msg: "Buttons have insufficient contrast", sev: "warn" },
          { cat: "Security", score: 72, msg: "No HSTS header found", sev: "warn" },
        ];
        for (const e of early) {
          await write({ event: "score", category: e.cat, score: e.score });
          await new Promise((r) => setTimeout(r, 180));
          await write({ event: "finding", category: e.cat, severity: e.sev, message: e.msg });
          await new Promise((r) => setTimeout(r, 120));
        }
        // --- /DEMO ---

        const shot = await screenshotPromise;
        if (shot) {
          await write({ event: "screenshot", screenshotUrl: shot });
        } else {
          await write({ event: "status", message: "no screenshot produced" });
        }

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
type PPage = import("puppeteer-core").Page | import("puppeteer").Page;

async function takeScreenshotFlexible(targetUrl: string, write: (c: any) => Promise<void>): Promise<string | null> {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  let browser: PBrowser | null = null;

  try {
    await write({ event: "status", message: "launching browser" });

    if (isProd) {
      const chromium = (await import("@sparticuz/chromium")).default;
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

    // Modern UA helps with sites that block headless defaults
    const UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    await page.setUserAgent(UA).catch(() => {});
    await page.setBypassCSP(true).catch(() => {});
    await page.emulateMediaType("screen").catch(() => {});
    // Block heavy resources to improve reliability
    try {
      await page.setRequestInterception(true);
      page.on("request", (req: any) => {
        const type = req.resourceType();
        if (type === "media" || type === "font") return req.abort();
        return req.continue();
      });
    } catch {}

    await write({ event: "status", message: "navigating" });

    // Phase 1: try networkidle2 (best case)
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
    } catch (e) {
      // Phase 2: fall back to DOMContentLoaded
      await write({ event: "status", message: "networkidle2 timed out; trying domcontentloaded" });
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    }

    // small settle delay for lazy content
    await new Promise(res => setTimeout(res, 900));

    // Try fullPage screenshot; if it fails, fall back to viewport
    await write({ event: "status", message: "taking screenshot" });
    let buf: Buffer | null = null;
    try {
      buf = (await page.screenshot({ type: "webp", fullPage: true, quality: 80 })) as Buffer;
    } catch {
      await write({ event: "status", message: "fullPage failed; taking viewport screenshot" });
      buf = (await page.screenshot({ type: "webp", fullPage: false, quality: 80 })) as Buffer;
    }

    if (!buf) {
      await write({ event: "error", message: "screenshot buffer is empty" });
      return null;
    }

    if (hasBlobToken) {
      await write({ event: "status", message: "uploading screenshot" });
      const key = `screenshots/${hash(targetUrl)}-${Date.now()}.webp`;
      const res = await put(key, buf, { access: "public", contentType: "image/webp" });
      await write({ event: "status", message: "upload complete" });
      return res.url;
    } else {
      await write({ event: "status", message: "no BLOB token; returning data URL" });
      return `data:image/webp;base64,${buf.toString("base64")}`;
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
