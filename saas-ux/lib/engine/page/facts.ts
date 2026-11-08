// lib/engine/page/facts.ts
//
// What a single page fetch observed: the preScan() result, which both the
// quick analysis (analyze-facts) and the site scan start from. Fields stay
// null when not observed, so rules report `unknown` instead of guessing.

type Loose = Record<string, any>;

export interface PageFacts {
  finalUrl: string | null;
  isHttps: boolean | null;
  siteLang: string | null;
  meta: {
    title: string;
    description: string;
    titleLen: number;
    descriptionLen: number;
    robotsMeta: string;
    hasCanonical: boolean;
    hasJsonLd: boolean;
    hasOgTitle: boolean;
    hasOgImage: boolean;
  } | null;
  dom: { h1Count: number; imgCount: number; scriptCount: number } | null;
  accessibility: { imgMissingAlt: number; imgWithoutAltRatio: number } | null;
  perf: { approxHtmlBytes: number; heavyScriptHint: boolean; heavyImageHint: boolean } | null;
  /** Lower-cased response headers; null when not captured. */
  headers: Record<string, string> | null;
  /** Public WordPress signals; null when the site is not WordPress. */
  wordpress: { xmlrpc: boolean | null; usersExposed: boolean | null; version: string | null } | null;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const boolOrNull = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

export function buildPageFacts(data: Loose | null | undefined): PageFacts {
  const meta = data?.meta;
  const dom = data?.dom;
  const a11y = data?.accessibility;
  const perf = data?.perfHints;
  const cms = data?.cms;

  let headers: Record<string, string> | null = null;
  if (data?.headers && typeof data.headers === 'object' && Object.keys(data.headers).length > 0) {
    headers = {};
    for (const [key, value] of Object.entries(data.headers as Loose)) {
      if (typeof value === 'string') headers[key.toLowerCase()] = value;
    }
  }

  return {
    finalUrl: str(data?.finalUrl) || null,
    isHttps: boolOrNull(data?.isHttps),
    siteLang: str(data?.siteLang) || null,
    meta:
      meta && typeof meta === 'object'
        ? {
            title: str(meta.title),
            description: str(meta.description),
            titleLen: num(meta.titleLen) || str(meta.title).length,
            descriptionLen: num(meta.descriptionLen) || str(meta.description).length,
            robotsMeta: str(meta.robotsMeta),
            hasCanonical: meta.hasCanonical === true,
            hasJsonLd: meta.hasJsonLd === true,
            hasOgTitle: meta.hasOgTitle === true,
            hasOgImage: meta.hasOgImage === true,
          }
        : null,
    dom:
      dom && typeof dom === 'object'
        ? { h1Count: num(dom.h1Count), imgCount: num(dom.imgCount), scriptCount: num(dom.scriptCount) }
        : null,
    accessibility:
      a11y && typeof a11y === 'object'
        ? { imgMissingAlt: num(a11y.imgMissingAlt), imgWithoutAltRatio: num(a11y.imgWithoutAltRatio) }
        : null,
    perf:
      perf && typeof perf === 'object'
        ? {
            approxHtmlBytes: num(perf.approxHtmlBytes),
            heavyScriptHint: perf.heavyScriptHint === true,
            heavyImageHint: perf.heavyImageHint === true,
          }
        : null,
    headers,
    wordpress:
      cms?.type === 'wordpress'
        ? {
            xmlrpc: boolOrNull(cms.wp?.xmlrpc),
            usersExposed: boolOrNull(cms.wp?.usersExposed),
            version: str(cms.wp?.version) || null,
          }
        : null,
  };
}
