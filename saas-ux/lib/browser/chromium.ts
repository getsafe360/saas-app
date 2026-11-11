// lib/browser/chromium.ts
//
// A headless Chromium for server-side rendering (report PDFs): the serverless
// build from @sparticuz/chromium on Vercel, the local browser in development.
//
// The serverless build runs single-process: closing a second browser context,
// or its last page, takes the whole browser down. So there is one shared
// context with scripts off, one idle page that keeps it alive, and each
// request opens and closes only its own page.

import { chromium, type Browser, type BrowserContext } from 'playwright-core';

interface Session {
  browser: Browser;
  context: BrowserContext;
}

let cached: Session | null = null;
let launching: Promise<Session> | null = null;

async function start(): Promise<Browser> {
  try {
    const pkg = await import('@sparticuz/chromium');
    const executablePath = await pkg.default.executablePath();
    if (executablePath) return await chromium.launch({ executablePath, args: pkg.default.args, headless: true });
  } catch {
    // Not on a serverless runtime: use the local browser.
  }
  return chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
}

async function launch(): Promise<Session> {
  const browser = await start();
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.newPage();
  return { browser, context };
}

/** The shared context for static rendering (JavaScript disabled). */
export async function getRenderContext(): Promise<BrowserContext> {
  if (cached?.browser.isConnected()) return cached.context;
  if (!launching) {
    launching = launch().finally(() => {
      launching = null;
    });
  }
  cached = await launching;
  return cached.context;
}

/** Forget a browser that failed, so the next call starts a new one. */
export function resetRenderContext(context: BrowserContext): void {
  if (cached?.context !== context) return;
  const { browser } = cached;
  cached = null;
  void browser.close().catch(() => undefined);
}
