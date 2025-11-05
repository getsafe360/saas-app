// app/api/screenshot/route.ts
import { NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import core from "puppeteer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  const w = clamp(parseInt(req.nextUrl.searchParams.get("w") || "650", 10), 320, 1600);
  const q = clamp(parseInt(req.nextUrl.searchParams.get("q") || "60", 10), 25, 90);
  const mobile = req.nextUrl.searchParams.get("mobile") === "1";
  const dpr = clamp(Number(req.nextUrl.searchParams.get("dpr") || "1"), 1, 2);

  let browser: any;
  let page: any;
  
  try {
    browser = await launchBrowser();
    page = await browser.newPage();

    if (mobile) {
      await page.setViewport({ 
        width: w, 
        height: 800,
        deviceScaleFactor: dpr, 
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
        deviceScaleFactor: dpr
      });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
      );
    }

    // Use 'load' instead of 'networkidle0' - much more reliable
    await page.goto(url, { 
      waitUntil: "load",
      timeout: 20000
    });

    // Give page time to render (replace waitForTimeout)
    await delay(800);

    const buf: Buffer = (await page.screenshot({ 
      type: "jpeg", 
      quality: q,
      fullPage: false
    })) as Buffer;

    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, s-maxage=2592000, max-age=600"
      }
    });

  } catch (err: any) {
    console.error("Screenshot error for", url, err);
    
    return new Response(null, { status: 204 });
    
  } finally {
    try { 
      if (page) await page.close(); 
    } catch {}
    try { 
      if (browser) await browser.close(); 
    } catch {}
  }
}