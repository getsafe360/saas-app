import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
// Do not import Browser globally, import it conditionally below
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Cat = "SEO" | "Accessibility" | "Performance" | "Security";

function ndjson(obj: any) {
  return JSON.stringify(obj) + "\n";
}

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

        const screenshotPromise = takeScreenshotFlexible(url, write).catch(async (err) => {
          await write({ event: "error", message: `screenshot failed: ${String(err)}` });
          return null;
        });

        // TODO: swap with real analyzer calls
        const early: { cat: Cat; score: number; msg: string; sev: "info" | "warn" | "error" }[] = [
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

async function takeScreenshotFlexible(
  targetUrl: string,
  write: (c: any) => Promise<void>
): Promise<string | null> {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  let browser: any = null;

  try {
    if (isProd) {
      // Vercel serverless: puppeteer-core + @sparticuz/chromium
      const executablePath = await chromium.executablePath();
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 800 },
        executablePath,
        headless: true,
      });
    } else {
      // Local dev: full puppeteer to avoid executablePath headaches
      const puppeteer = await import("puppeteer").then((m) => m.default);
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: { width: 1280, height: 800 },
      });
    }

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForTimeout(1200);

    const buf = (await page.screenshot({
      type: "webp",
      fullPage: true,
      quality: 80,
    })) as Buffer;

    // Prefer Blob URL in prod; locally fall back to data URL if no token
    if (hasBlobToken) {
      const url = await uploadToBlob(buf, targetUrl);
      return url;
    } else {
      await write({
        event: "status",
        message:
          "BLOB_READ_WRITE_TOKEN not set locally — returning data URL for screenshot",
      });
      return `data:image/webp;base64,${buf.toString("base64")}`;
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

async function uploadToBlob(buf: Buffer, targetUrl: string): Promise<string> {
  const key = `screenshots/${hash(targetUrl)}-${Date.now()}.webp`;
  const res = await put(key, buf, {
    access: "public",
    contentType: "image/webp",
  });
  return res.url;
}

function hash(s: string) {
  let h = 0,
    i = 0;
  while (i < s.length) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return (h >>> 0).toString(36);
}
