// saas-ux/app/api/screenshot/route.ts
import { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import core from "puppeteer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper: choose the best available launcher for the current env
async function launchBrowser() {
  // Prefer serverless-compatible chromium path if available
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
  } catch {
    // swallow and try full puppeteer next
  }

  // Fallback: full puppeteer (bundled Chromium) — perfect for local dev/Windows
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 800, deviceScaleFactor: 1 },
  });
}

function isHttpUrl(u: string | null): u is string {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!isHttpUrl(url)) {
    return new Response("Missing or invalid url", { status: 400 });
  }

  let browser: any;
  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
    );

    // Fast load; if site is heavy, we still get a meaningful screenshot
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});

    const buf = await page.screenshot({ type: "jpeg", quality: 70 });
    await page.close();

    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    // No image available but don't break the page
    return new Response(null, { status: 204 });
  } finally {
    try {
      await browser?.close();
    } catch {}
  }
}
