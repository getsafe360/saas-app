// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";        // serverless (NOT edge) so we can run puppeteer
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Strongly-typed categories for stream contract
type Category = "SEO" | "Accessibility" | "Performance" | "Security";

function ndjson(obj: any) {
  return JSON.stringify(obj) + "\n";
}

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

        // kick off screenshot in parallel and surface errors through the stream
        const screenshotPromise = takeScreenshotFlexible(url, write).catch(async (err) => {
          await write({ event: "error", message: `screenshot failed: ${String(err)}` });
          return null;
        });

        // TODO: Replace this demo with your WebsiteAnalyzerCrew streaming
        const early: { cat: Category; score: number; msg: string; sev: "info" | "warn" | "error" }[] = [
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

        const shot = await screenshotPromise;
        if (shot) {
          await write({ event: "screenshot", screenshotUrl: shot });
        } else {
          await write({ event: "status", message: "no screenshot produced" });
        }

        await write({ event: "done" });
        controller.close();
      } catch (err) {
        await write({ event: "error", message: String(err) });
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

// ------------------- Screenshot helpers -------------------

// Union type: OK for dev (puppeteer) and prod (puppeteer-core)
type PBrowser = import("puppeteer-core").Browser | import("puppeteer").Browser;

async function takeScreenshotFlexible(
  targetUrl: string,
  write: (c: any) => Promise<void>
): Promise<string | null> {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  let browser: PBrowser | null = null;

  try {
    await write({ event: "status", message: "launching browser" });

    if (isProd) {
      // Vercel serverless: puppeteer-core + @sparticuz/chromium (dynamic import avoids bundling locally)
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteerCore = (await import("puppeteer-core")).default;
      const executablePath = await chromium.executablePath();

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 800 },
        executablePath,
        headless: chromium.headless,
      });
    } else {
      // Local dev: full puppeteer (downloads Chrome/Chromium automatically)
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: { width: 1280, height: 800 },
      });
    }

    const page = await (browser as any).newPage();
    await write({ event: "status", message: "navigating" });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForTimeout(1200);

    await write({ event: "status", message: "taking screenshot" });
    const buf = (await page.screenshot({
      type: "webp",
      fullPage: true,
      quality: 80,
    })) as Buffer;

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
    try {
      await (browser as any)?.close();
    } catch {
      /* noop */
    }
  }
}

function hash(s: string) {
  let h = 0,
    i = 0;
  while (i < s.length) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return (h >>> 0).toString(36);
}
