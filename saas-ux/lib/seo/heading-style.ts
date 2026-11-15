// lib/seo/heading-style.ts
//
// How a page's second H1 actually looks, as the browser computes it from the
// theme's CSS. The single-H1 fix shows later H1s as H2s and sends these values
// along, so the connector can keep the heading's look exactly.

import 'server-only';

import { getRenderContext, resetRenderContext } from '@/lib/browser/chromium';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { cleanHeadingStyle } from '@/lib/wordpress/rollback';
import type { HeadingStyle } from '@/lib/wordpress/types';

const PROPERTIES = ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'font-family', 'margin-top', 'margin-bottom'] as const;
const TIMEOUT_MS = 20_000;

/** Computed style of the page's second H1, or null when there is none or the page could not be rendered. */
export async function measureExtraH1Style(url: string): Promise<HeadingStyle | null> {
  if (!(await isPublicUrlResolved(url).catch(() => false))) return null;
  const context = await getRenderContext().catch(() => null);
  if (!context) return null;
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT_MS });
    const raw = await page.evaluate((properties) => {
      const heading = document.querySelectorAll('h1')[1];
      if (!heading) return null;
      const computed = getComputedStyle(heading);
      return Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]));
    }, [...PROPERTIES]);
    const style = raw ? cleanHeadingStyle(raw) : null;
    // Without a size the look cannot be kept.
    return style && style['font-size'] ? style : null;
  } catch (error) {
    if (error instanceof Error && /closed|crashed|disconnected/i.test(error.message)) resetRenderContext(context);
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}
