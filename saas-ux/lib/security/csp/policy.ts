// lib/security/csp/policy.ts
//
// Content-Security-Policy model: building a starting policy from what pages
// actually load, serialising it, and validating any policy before it is sent
// to the connector (which validates again with the same rules).

export const CSP_DIRECTIVES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'frame-src',
  'worker-src',
  'manifest-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
  'upgrade-insecure-requests',
  'report-uri',
] as const;
export type CspDirective = (typeof CSP_DIRECTIVES)[number];
export type CspPolicy = Partial<Record<CspDirective, string[]>>;

/** Directives without values. */
const FLAG_DIRECTIVES: ReadonlySet<string> = new Set(['upgrade-insecure-requests']);
const KEYWORDS: ReadonlySet<string> = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'strict-dynamic'",
  "'unsafe-hashes'",
  "'wasm-unsafe-eval'",
  "'report-sample'",
]);
const SCHEMES: ReadonlySet<string> = new Set(['https:', 'http:', 'data:', 'blob:', 'wss:', 'ws:', 'mediastream:']);
const HASH = /^'sha(256|384|512)-[A-Za-z0-9+/]+=*'$/;
const HOST = /^(?:(?:https?|wss?):\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?(?:\/[A-Za-z0-9._~/-]*)?$/i;

export const CSP_MAX_LENGTH = 4096;

export function isValidSource(token: string): boolean {
  return token === '*' || KEYWORDS.has(token) || SCHEMES.has(token) || HASH.test(token) || HOST.test(token);
}

export type CspValidation = { ok: true } | { ok: false; reason: string };

/**
 * The same rules the connector enforces: known directives only, each once,
 * valid source expressions, report-uri pointing at an allowed https host,
 * no control characters, at most 4 KB.
 */
export function validateCsp(value: string, allowedReportHosts: ReadonlyArray<string> = []): CspValidation {
  if (value.length === 0 || value.length > CSP_MAX_LENGTH) return { ok: false, reason: 'length' };
  if (/[\u0000-\u001f\u007f,]/.test(value)) return { ok: false, reason: 'characters' };
  const seen = new Set<string>();
  for (const part of value.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    const directive = name.toLowerCase();
    if (!(CSP_DIRECTIVES as ReadonlyArray<string>).includes(directive)) return { ok: false, reason: `directive:${directive}` };
    if (seen.has(directive)) return { ok: false, reason: `duplicate:${directive}` };
    seen.add(directive);
    if (FLAG_DIRECTIVES.has(directive)) {
      if (sources.length > 0) return { ok: false, reason: `values:${directive}` };
      continue;
    }
    if (sources.length === 0) return { ok: false, reason: `empty:${directive}` };
    if (directive === 'report-uri') {
      if (sources.length !== 1) return { ok: false, reason: 'report-uri' };
      let url: URL;
      try {
        url = new URL(sources[0]);
      } catch {
        return { ok: false, reason: 'report-uri' };
      }
      if (url.protocol !== 'https:' || !allowedReportHosts.includes(url.hostname)) return { ok: false, reason: 'report-uri' };
      continue;
    }
    for (const source of sources) {
      if (!isValidSource(source)) return { ok: false, reason: `source:${source}` };
    }
  }
  if (!seen.has('default-src')) return { ok: false, reason: 'default-src' };
  return { ok: true };
}

export function serializeCsp(policy: CspPolicy): string {
  return CSP_DIRECTIVES.filter((directive) => policy[directive] !== undefined)
    .map((directive) => {
      const sources = policy[directive] ?? [];
      return FLAG_DIRECTIVES.has(directive) ? directive : `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

export function parseCsp(value: string): CspPolicy {
  const policy: CspPolicy = {};
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (name && (CSP_DIRECTIVES as ReadonlyArray<string>).includes(name.toLowerCase())) {
      policy[name.toLowerCase() as CspDirective] = sources;
    }
  }
  return policy;
}

// ---------- what pages load ----------

export interface PageResources {
  scripts: string[];
  styles: string[];
  images: string[];
  fonts: string[];
  frames: string[];
  media: string[];
  forms: string[];
  manifests: string[];
  inlineScripts: boolean;
  inlineStyles: boolean;
}

const attr = (tag: string, name: string): string | null => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : null;
};
const srcsetUrls = (value: string | null): string[] =>
  value ? value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean) : [];

/** Extracts resource URLs from HTML with plain tag matching (no DOM needed). */
export function extractResources(html: string): PageResources {
  const out: PageResources = {
    scripts: [],
    styles: [],
    images: [],
    fonts: [],
    frames: [],
    media: [],
    forms: [],
    manifests: [],
    inlineScripts: false,
    inlineStyles: /<style[\s>]/i.test(html) || /\sstyle\s*=/i.test(html),
  };
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    const type = (attr(tag, 'type') ?? '').toLowerCase();
    if (src) out.scripts.push(src);
    else if (!type || type.includes('javascript') || type === 'module') out.inlineScripts = true;
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''))) out.inlineScripts = true;
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    if (!href) continue;
    const as = (attr(tag, 'as') ?? '').toLowerCase();
    if (rel.includes('stylesheet') || as === 'style') out.styles.push(href);
    else if (rel.includes('modulepreload') || as === 'script') out.scripts.push(href);
    else if (as === 'font') out.fonts.push(href);
    else if (as === 'image' || rel.includes('icon')) out.images.push(href);
    else if (rel.includes('manifest')) out.manifests.push(href);
  }
  for (const [tag] of html.matchAll(/<(?:img|source|image)\b[^>]*>/gi)) {
    const src = attr(tag, 'src') ?? attr(tag, 'href');
    if (src) out.images.push(src);
    out.images.push(...srcsetUrls(attr(tag, 'srcset')));
  }
  for (const [tag] of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    if (src) out.frames.push(src);
  }
  for (const [tag] of html.matchAll(/<(?:video|audio)\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    if (src) out.media.push(src);
  }
  for (const [tag] of html.matchAll(/<form\b[^>]*>/gi)) {
    const action = attr(tag, 'action');
    if (action) out.forms.push(action);
  }
  for (const [, url] of html.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi)) out.images.push(url);
  return out;
}

// ---------- known services ----------

/** Extra sources a service needs that its first tag does not reveal (fonts, beacons, frames). */
const SERVICES: ReadonlyArray<{ match: RegExp; add: CspPolicy }> = [
  { match: /fonts\.googleapis\.com/, add: { 'style-src': ['https://fonts.googleapis.com'], 'font-src': ['https://fonts.gstatic.com'] } },
  {
    match: /googletagmanager\.com|google-analytics\.com/,
    add: {
      'script-src': ['https://www.googletagmanager.com', 'https://*.google-analytics.com'],
      'img-src': ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
      'connect-src': ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
    },
  },
  { match: /youtube(?:-nocookie)?\.com|youtu\.be/, add: { 'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com'] } },
  { match: /player\.vimeo\.com/, add: { 'frame-src': ['https://player.vimeo.com'] } },
  { match: /google\.com\/maps|maps\.googleapis\.com/, add: { 'frame-src': ['https://www.google.com'], 'script-src': ['https://maps.googleapis.com'], 'img-src': ['https://maps.gstatic.com', 'https://maps.googleapis.com'] } },
  { match: /google\.com\/recaptcha|gstatic\.com\/recaptcha/, add: { 'script-src': ['https://www.google.com', 'https://www.gstatic.com'], 'frame-src': ['https://www.google.com'] } },
  { match: /js\.stripe\.com/, add: { 'script-src': ['https://js.stripe.com'], 'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com'], 'connect-src': ['https://api.stripe.com'] } },
  { match: /connect\.facebook\.net/, add: { 'script-src': ['https://connect.facebook.net'], 'img-src': ['https://www.facebook.com'], 'connect-src': ['https://www.facebook.com'] } },
  { match: /gravatar\.com/, add: { 'img-src': ['https://secure.gravatar.com', 'https://*.gravatar.com'] } },
  // WordPress's emoji script loads images from the WordPress.org CDN.
  { match: /wp-emoji|s\.w\.org/, add: { 'img-src': ['https://s.w.org'] } },
];

function sourceFor(raw: string, base: URL): string | null {
  if (!raw || raw.startsWith('#') || /^(?:javascript|mailto|tel|about):/i.test(raw)) return null;
  if (/^data:/i.test(raw)) return 'data:';
  if (/^blob:/i.test(raw)) return 'blob:';
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.host === base.host) return "'self'";
  // http:// sources are upgraded by upgrade-insecure-requests, so allow them over https.
  return `https://${url.host}`;
}

/**
 * A starting policy from the resources pages actually load. It is meant for
 * report-only testing first: violations reported by real browsers show what
 * it still misses before it is enforced.
 */
export function buildCspPolicy(params: { siteUrl: string; pages: ReadonlyArray<PageResources>; reportUri?: string }): CspPolicy {
  const base = new URL(params.siteUrl);
  const sets: Partial<Record<CspDirective, Set<string>>> = {};
  const add = (directive: CspDirective, ...sources: string[]) => {
    const set = (sets[directive] ??= new Set<string>());
    for (const source of sources) set.add(source);
  };

  add('default-src', "'self'");
  add('script-src', "'self'");
  add('style-src', "'self'");
  add('img-src', "'self'", 'data:');
  add('font-src', "'self'", 'data:');
  add('connect-src', "'self'");
  add('frame-src', "'self'");
  add('object-src', "'none'");
  add('base-uri', "'self'");
  add('form-action', "'self'");
  add('frame-ancestors', "'self'");

  const allUrls: string[] = [];
  const map: Array<[keyof PageResources, CspDirective]> = [
    ['scripts', 'script-src'],
    ['styles', 'style-src'],
    ['images', 'img-src'],
    ['fonts', 'font-src'],
    ['frames', 'frame-src'],
    ['media', 'media-src'],
    ['forms', 'form-action'],
    ['manifests', 'manifest-src'],
  ];
  for (const page of params.pages) {
    if (page.inlineScripts) add('script-src', "'unsafe-inline'");
    if (page.inlineStyles) add('style-src', "'unsafe-inline'");
    for (const [field, directive] of map) {
      for (const raw of page[field] as string[]) {
        allUrls.push(raw);
        const source = sourceFor(raw, base);
        if (source) add(directive, source);
      }
    }
  }
  const haystack = allUrls.join(' ');
  for (const service of SERVICES) {
    if (!service.match.test(haystack)) continue;
    for (const [directive, sources] of Object.entries(service.add) as Array<[CspDirective, string[]]>) add(directive, ...sources);
  }
  if (sets['media-src']) add('media-src', "'self'");
  if (sets['manifest-src']) add('manifest-src', "'self'");

  const policy: CspPolicy = {};
  for (const directive of CSP_DIRECTIVES) {
    const set = sets[directive];
    if (set) policy[directive] = [...set].filter((source) => source === "'self'" || isValidSource(source));
  }
  if (base.protocol === 'https:') policy['upgrade-insecure-requests'] = [];
  if (params.reportUri) policy['report-uri'] = [params.reportUri];
  return policy;
}
