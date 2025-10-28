// saas-ux/app/api/screenshot/route.ts
import { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import core from "puppeteer-core";

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
        headless: true,
      });
    }
  } catch {}
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 800, deviceScaleFactor: 1 },
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  const w = clamp(parseInt(req.nextUrl.searchParams.get("w") || "900", 10), 400, 1600);
  const q = clamp(parseInt(req.nextUrl.searchParams.get("q") || "65", 10), 30, 90);
  const mobile = req.nextUrl.searchParams.get("mobile") === "1";

  let browser: any;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    if (mobile) {
      await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      );
    } else {
      await page.setViewport({ width: w, height: Math.round((w * 7) / 12), deviceScaleFactor: 1 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
      );
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
    const buf = await page.screenshot({ type: "jpeg", quality: q });
    await page.close();

    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, s-maxage=86400, max-age=600", // CDN 1d, browser 10m
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  } finally {
    try { await browser?.close(); } catch {}
  }
}

