// app/api/screenshot/route.ts
import { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import core from "puppeteer-core";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function launchBrowser() {
  try {
    const execPath = await chromium.executablePath();
    if (execPath) {
      return await core.launch({
        args: chromium.args,
        defaultViewport: { width: 1200, height: 800, deviceScaleFactor: 1 },
        executablePath: execPath,
        headless: true
      });
    }
  } catch {}
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 800, deviceScaleFactor: 1 }
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  // params
  const w = clamp(parseInt(req.nextUrl.searchParams.get("w") || "650", 10), 400, 1600);
  let q = clamp(parseInt(req.nextUrl.searchParams.get("q") || "60", 10), 25, 90);
  const mobile = req.nextUrl.searchParams.get("mobile") === "1";
  const fmt = (req.nextUrl.searchParams.get("fmt") || "avif").toLowerCase() as
    | "avif"
    | "webp"
    | "jpeg";
  const maxBytes = clamp(
    parseInt(req.nextUrl.searchParams.get("max") || String(30 * 1024), 10),
    10 * 1024,
    200 * 1024
  );

  let browser: any;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage(); // ✅ Puppeteer: no args here

    if (mobile) {
      await page.setViewport({
        width: 390,
        height: 800,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      });
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      );
    } else {
      await page.setViewport({
        width: w,
        height: Math.round((w * 7) / 12),
        deviceScaleFactor: 1
      });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
      );
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => {});

    // Capture PNG first; we’ll transcode via Sharp.
    const raw: Buffer = (await page.screenshot({ type: "png" })) as Buffer;
    await page.close();

    // Resize + compress to target format with size cap
    const base = sharp(raw).resize({ width: w });
    const encode = async (quality: number) => {
      if (fmt === "avif") return base.avif({ quality, effort: 4 }).toBuffer();
      if (fmt === "webp") return base.webp({ quality }).toBuffer();
      return base.jpeg({ quality }).toBuffer();
    };

    let out = await encode(q);
    while (out.byteLength > maxBytes && q > 25) {
      q -= 5;
      out = await encode(q);
    }

    const contentType =
      fmt === "avif" ? "image/avif" : fmt === "webp" ? "image/webp" : "image/jpeg";

    return new Response(out, {
      headers: {
        "Content-Type": contentType,
        // 30d at the edge, 10m in the browser → dedup identical query strings
        "Cache-Control": "public, s-maxage=2592000, max-age=600"
      }
    });
  } catch {
    return new Response(null, { status: 204 });
  } finally {
    try {
      await browser?.close();
    } catch {}
  }
}
