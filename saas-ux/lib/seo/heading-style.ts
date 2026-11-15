// lib/seo/heading-style.ts
//
// The theme's own CSS for H1 headings, rewritten for the H2s the single-H1 fix
// shows instead (`h2.gs360-h1`). Copying the rules, with their media queries,
// keeps the look exact at every screen width and in every context the theme
// styles differently; a computed-pixel snapshot could not.

import 'server-only';

import { getRenderContext, resetRenderContext } from '@/lib/browser/chromium';
import { isPublicUrlResolved } from '@/lib/net/isPublicUrlResolved';
import { cleanHeadingCss, HEADING_CSS_MAX } from '@/lib/wordpress/rollback';

const TIMEOUT_MS = 20_000;

/** The browser's default H1 look, so a theme that never styles H1 keeps it too; theme rules follow and win. */
const UA_DEFAULT = 'h2.gs360-h1{font-size:2em;margin-block-start:0.67em;margin-block-end:0.67em;font-weight:bold}';

/**
 * Runs in the page, so it is plain JavaScript text: no compiler may add helpers to it. Reads every
 * readable stylesheet and keeps the rules whose selectors target `h1` as a type, rewritten to
 * `h2.gs360-h1`, inside their @media / @supports / @layer wrappers.
 */
const EXTRACT_H1_CSS = String.raw`(max) => {
  if (document.querySelectorAll('h1').length < 2) return null;
  const H1 = /(^|[\s>+~,(])h1(?=$|[\s.#:[>+~,)])/gi;
  const IS_H1 = /(^|[\s>+~(])h1($|[\s.#:[>+~)])/i;
  const rewrite = (selector) => {
    const parts = selector.split(',').map((part) => part.trim()).filter((part) => IS_H1.test(part));
    return parts.length ? parts.map((part) => part.replace(H1, '$1h2.gs360-h1')).join(',') : null;
  };
  let rules = 0;
  const walk = (list) => {
    let out = '';
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSStyleRule) {
        const selector = rewrite(rule.selectorText);
        if (selector && rule.style.cssText) {
          out += selector + '{' + rule.style.cssText + '}';
          rules++;
        }
      } else if (rule.cssRules && (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule))) {
        const inner = walk(rule.cssRules);
        if (inner) out += rule.cssText.slice(0, rule.cssText.indexOf('{')) + '{' + inner + '}';
      }
    }
    return out;
  };
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += walk(sheet.cssRules);
    } catch (error) {
      // A cross-origin stylesheet cannot be read; it rarely styles H1 (fonts, icons).
    }
    if (css.length > max) break;
  }
  return { css, rules };
}`;

/**
 * CSS that gives `h2.gs360-h1` the H1 look of the site's theme, or null when the page has no second H1
 * or could not be rendered. Every request the browser makes is checked: redirects, stylesheets,
 * images and frames to private or non-http addresses are refused.
 */
export async function collectH1Css(url: string): Promise<{ css: string; themeRules: number } | null> {
  if (!(await isPublicUrlResolved(url).catch(() => false))) return null;
  const context = await getRenderContext().catch(() => null);
  if (!context) return null;
  const page = await context.newPage();
  try {
    await page.route('**/*', async (route) => {
      const target = route.request().url();
      const allowed = /^https?:/i.test(target) && (await isPublicUrlResolved(target).catch(() => false));
      if (allowed) await route.continue();
      else await route.abort('blockedbyclient');
    });
    await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT_MS });
    const result = (await page.evaluate(`(${EXTRACT_H1_CSS})(${HEADING_CSS_MAX})`)) as { css: string; rules: number } | null;
    if (!result) return null;
    const css = cleanHeadingCss(UA_DEFAULT + result.css);
    return css ? { css, themeRules: result.rules } : null;
  } catch (error) {
    if (error instanceof Error && /closed|crashed|disconnected/i.test(error.message)) resetRenderContext(context);
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}
