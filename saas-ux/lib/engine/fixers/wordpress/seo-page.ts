// lib/engine/fixers/wordpress/seo-page.ts
//
// Page SEO fixes through the connector (1.13). Both are per page, decided on
// the page as WordPress renders it, so nothing written for one page reaches
// another:
//  - social tags: every page gets the Open Graph / Twitter tags it lacks, from
//    its own title, description, address and image; tags already there stay.
//  - single H1: each page keeps its first H1 and shows later ones as H2s with
//    the theme's own H1 CSS rewritten for them (media queries included). The database is not touched.
// Each action returns its inverse, so both can be undone.

import { parseSeoPage } from '@/lib/engine/seo/page';
import type { WordPressHeadingFixPayload } from '@/lib/wordpress/types';
import { cleanHeadingCss } from '@/lib/wordpress/rollback';
import { type ConnectorFixer, type FixerVerifyContext, type VerificationCheck, verificationResult } from '../types';

const USER_AGENT = 'GetSafe360-WordPressVerifier/1.0';

export const SOCIAL_TAGS_FIXER_ID = 'seo-social-tags';
export const SINGLE_H1_FIXER_ID = 'seo-single-h1';

/** Findings the social tags fix resolves: the page scan's and the measured crawl's. */
export const SOCIAL_TAG_FINDINGS = new Set(['seo-og-missing', 'seo-social-tags']);
export const MULTIPLE_H1_FINDINGS = new Set(['seo-h1-multiple']);

async function homePage(context: FixerVerifyContext): Promise<string> {
  const url = new URL('/', context.siteUrl);
  url.searchParams.set('gs360_verify', String(Date.now()));
  const response = await (context.fetchImpl ?? fetch)(url.toString(), {
    redirect: 'follow',
    cache: 'no-store',
    headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`The home page answered ${response.status}.`);
  return response.text();
}

function failed(name: string, error: unknown, fallback: string): VerificationCheck {
  return { name, ok: false, detail: error instanceof Error ? error.message : fallback };
}

export const socialTagsFixer: ConnectorFixer = {
  id: SOCIAL_TAGS_FIXER_ID,
  executor: 'wp-connector',

  plan(findings, context) {
    if (!findings.some((finding) => SOCIAL_TAG_FINDINGS.has(finding.id))) return null;
    const noImage = context?.seo?.socialImage === false;
    return {
      type: 'set_social_tags',
      title: 'Add social sharing tags to every page',
      description:
        'Each page gets the Open Graph and Twitter tags it is missing, from its own title, description, address and image (featured image, else the site logo or icon). Tags already there are kept. Undo removes them.' +
        (noImage ? ' The site has no logo or icon yet: add one so shares show a picture.' : ''),
      risk: 'low',
      autoApplyEligible: true,
      requiresApproval: false,
      requiredCapabilities: ['socialTags'],
      verification: {
        kind: 'api',
        expectation: 'The home page carries og:title and twitter:card.',
        assertions: ['og:title', 'twitter:card'],
      },
      payload: { enabled: true },
    };
  },

  toConnectorRequest(action) {
    return { id: action.id, type: 'set_social_tags', payload: { enabled: action.payload.enabled !== false } };
  },

  async verify(context) {
    try {
      const html = await homePage(context);
      const page = parseSeoPage(html, context.siteUrl);
      const twitter = /<meta\b[^>]*name\s*=\s*["']twitter:card["']/i.test(html);
      return verificationResult([
        { name: 'og:title', ok: Boolean(page.og.title), detail: page.og.title ? 'The home page has og:title.' : 'og:title is not on the home page yet. A page cache may still serve the old page.' },
        { name: 'twitter:card', ok: twitter, detail: twitter ? 'The home page has twitter:card.' : 'twitter:card is not on the home page yet.' },
      ]);
    } catch (error) {
      return verificationResult([failed('social:fetch', error, 'Could not reach the home page.')]);
    }
  },
};

export const singleH1Fixer: ConnectorFixer = {
  id: SINGLE_H1_FIXER_ID,
  executor: 'wp-connector',

  plan(findings, context) {
    if (!findings.some((finding) => MULTIPLE_H1_FINDINGS.has(finding.id))) return null;
    const css = context?.headingCss?.css ?? '';
    // The look is kept when the theme's own H1 rules were copied; without them it may change.
    const keepsLook = Boolean(css) && (context?.headingCss?.themeRules ?? 0) > 0;
    return {
      type: 'set_heading_fix',
      title: 'Keep one H1 per page',
      description: keepsLook
        ? "Each page keeps its first H1; later H1 headings are shown as H2s that use your theme's own H1 styles, on every screen size, so the layout does not change. The content in WordPress is not edited. Undo shows them as H1 again."
        : "Each page keeps its first H1; later H1 headings are shown as H2s. Your theme's H1 styles could not be read, so they may look different: check the page and undo if needed. The content in WordPress is not edited.",
      // Without the measured look the layout may change, so it needs the user's click.
      risk: keepsLook ? 'low' : 'medium',
      autoApplyEligible: keepsLook,
      requiresApproval: !keepsLook,
      requiredCapabilities: ['headingFix'],
      verification: {
        kind: 'api',
        expectation: 'The home page has one H1.',
        assertions: ['h1 count = 1'],
      },
      payload: { enabled: true, css },
    };
  },

  toConnectorRequest(action) {
    const css = cleanHeadingCss(action.payload.css);
    if (css === null) return null;
    const payload: WordPressHeadingFixPayload = { enabled: action.payload.enabled !== false, css };
    return { id: action.id, type: 'set_heading_fix', payload };
  },

  async verify(context) {
    try {
      const html = await homePage(context);
      const count = parseSeoPage(html, context.siteUrl).h1.length;
      return verificationResult([{
        name: 'h1:count',
        ok: count <= 1,
        detail: count <= 1 ? 'The home page has one H1.' : `The home page still has ${count} H1 headings. A page cache may still serve the old page.`,
      }]);
    } catch (error) {
      return verificationResult([failed('h1:fetch', error, 'Could not reach the home page.')]);
    }
  },
};
