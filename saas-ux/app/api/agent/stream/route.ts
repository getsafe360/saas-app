import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { kvGet, kvIncr, kvSet } from "@/lib/kv";
import { PageSpeedSummary } from "@/lib/analyzer/pageSpeed";
import { buildGeminiSnapshotPrompt } from "@/lib/agent/snapshotPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotSections = {
  seoGeo: string;
  accessibility: string;
  performance: string;
  security: string;
  content: string;
  ctaLine: string;
};

type TerminalLog = {
  level: "INFO" | "SUCCESS" | "WARNING" | "METRIC" | "ERROR";
  stage: string;
  text: string;
};

type SnapshotPayload = {
  url: string;
  locale: string;
  generatedAt: string;
  text: string;
  platform: "wordpress" | "generic";
  sections: SnapshotSections;
  greeting?: string;
  wordpressSection?: string;
};

type FetchSnapshot = {
  html: string;
  finalUrl: string;
  status: number;
  fetchMs: number;
  bytes: number;
  headers: Record<string, string>;
};

type SectionFallbackStats = {
  usedAnyFallback: boolean;
  fallbackCount: number;
  fallbackBySection: Record<keyof SnapshotSections, boolean>;
};

type GeminiSnapshotResult = {
  greeting: string;
  summaryText: string;
  sections: SnapshotSections;
  terminalLogs: TerminalLog[];
  fallbackStats: SectionFallbackStats;
  wordpressSection?: string;
};

type GeminiResponsePayload = {
  greeting?: string;
  summaryText?: string;
  terminalLogs?: Array<{
    level?: "INFO" | "SUCCESS" | "WARNING" | "METRIC" | "ERROR" | string;
    stage?: string;
    text?: string;
  }>;
  sections?: Partial<SnapshotSections>;
  seoGeo?: string;
  accessibility?: string;
  performance?: string;
  security?: string;
  content?: string;
  ctaLine?: string;
  wordpressSection?: string;
};

const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 8_000;
const FETCH_MAX_BYTES = 300_000;
const LLM_TIMEOUT_MS = 20_000;
const CACHE_TTL_SECONDS = 60 * 60;
const GEMINI_MODEL =
  process.env.GEMINI_SNAPSHOT_MODEL || "gemini-3-flash-preview";
function defaultGreeting(url: string): string {
  const host = new URL(url).hostname;
  return `Here's your quick snapshot for ${host}:`;
}

const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

const IPV4_PRIVATE_RANGES: Array<[number, number]> = [
  [toIPv4Int("0.0.0.0"), toIPv4Int("0.255.255.255")],
  [toIPv4Int("10.0.0.0"), toIPv4Int("10.255.255.255")],
  [toIPv4Int("100.64.0.0"), toIPv4Int("100.127.255.255")],
  [toIPv4Int("127.0.0.0"), toIPv4Int("127.255.255.255")],
  [toIPv4Int("169.254.0.0"), toIPv4Int("169.254.255.255")],
  [toIPv4Int("172.16.0.0"), toIPv4Int("172.31.255.255")],
  [toIPv4Int("192.0.0.0"), toIPv4Int("192.0.0.255")],
  [toIPv4Int("192.168.0.0"), toIPv4Int("192.168.255.255")],
  [toIPv4Int("198.18.0.0"), toIPv4Int("198.19.255.255")],
  [toIPv4Int("224.0.0.0"), toIPv4Int("255.255.255.255")],
];

function toIPv4Int(ip: string): number {
  return (
    ip
      .split(".")
      .map(Number)
      .reduce((acc, part) => (acc << 8) + part, 0) >>> 0
  );
}

function isPrivateIPv4(ip: string): boolean {
  const value = toIPv4Int(ip);
  return IPV4_PRIVATE_RANGES.some(
    ([start, end]) => value >= start && value <= end,
  );
}

function isPrivateIPv6(address: string): boolean {
  const candidate = address.toLowerCase();
  return (
    candidate === "::1" ||
    candidate === "::" ||
    candidate.startsWith("fc") ||
    candidate.startsWith("fd") ||
    candidate.startsWith("fe8") ||
    candidate.startsWith("fe9") ||
    candidate.startsWith("fea") ||
    candidate.startsWith("feb") ||
    candidate.startsWith("::ffff:127.") ||
    candidate.startsWith("::ffff:10.") ||
    candidate.startsWith("::ffff:192.168.")
  );
}

function normalizeLocale(rawLocale: string | null): string {
  const candidate = (rawLocale ?? "en").trim().toLowerCase();
  return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(candidate) ? candidate : "en";
}

function normalizeUrl(rawUrl: string): string | null {
  const withScheme = /^https?:\/\//i.test(rawUrl.trim())
    ? rawUrl.trim()
    : `https://${rawUrl.trim()}`;
  try {
    const parsed = new URL(withScheme);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function assertPublicDestination(urlString: string): Promise<void> {
  const url = new URL(urlString);
  if (url.username || url.password)
    throw new Error("Credentialed URLs are not allowed.");
  const host = url.hostname;

  if (net.isIP(host)) {
    const version = net.isIP(host);
    if (
      (version === 4 && isPrivateIPv4(host)) ||
      (version === 6 && isPrivateIPv6(host))
    ) {
      throw new Error("Private network targets are blocked.");
    }
    return;
  }

  if (
    /localhost$/i.test(host) ||
    /\.local$/i.test(host) ||
    /\.internal$/i.test(host)
  ) {
    throw new Error("Local network hostnames are blocked.");
  }

  const records = await dns.lookup(host, { all: true });
  if (
    records.some((record) =>
      record.family === 4
        ? isPrivateIPv4(record.address)
        : isPrivateIPv6(record.address),
    )
  ) {
    throw new Error("Target resolves to a private IP.");
  }
}

async function limitedHtmlFetch(url: string): Promise<FetchSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`HTML fetch timed out after ${FETCH_TIMEOUT_MS}ms`)),
    FETCH_TIMEOUT_MS,
  );
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SparkySiteAnalyzer/1.0 (+https://www.getsafe360.ai)",
      },
      cache: "no-store",
    });

    if (!response.ok || !response.body)
      throw new Error(`Failed to fetch HTML (${response.status})`);

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > FETCH_MAX_BYTES) {
        controller.abort("max-size");
        throw new Error("HTML exceeded size limit.");
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const headers = Object.fromEntries(response.headers.entries());
    return {
      html: new TextDecoder().decode(merged),
      finalUrl: response.url || url,
      status: response.status,
      fetchMs: Date.now() - started,
      bytes: total,
      headers,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTagContent(html: string, regex: RegExp): string {
  const matched = html.match(regex)?.[1] ?? "";
  return matched.replace(/\s+/g, " ").trim();
}

function parseMetaContent(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return extractTagContent(
    html,
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      "i",
    ),
  );
}

function buildFacts(
  requestedUrl: string,
  fetchSnapshot: FetchSnapshot,
  pageSpeed: PageSpeedSummary | null,
): string {
  const { html, status, finalUrl, fetchMs, bytes, headers } = fetchSnapshot;
  const title = extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = parseMetaContent(html, "description");
  const robots = parseMetaContent(html, "robots");
  const canonical = extractTagContent(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["'][^>]*>/i,
  );
  const ogTitle = parseMetaContent(html, "og:title");
  const ogDescription = parseMetaContent(html, "og:description");
  const twitterCard = parseMetaContent(html, "twitter:card");
  const jsonLdBlocks = (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) ?? []).length;
  const wordCount = (html.match(/\b[\p{L}\p{N}]{2,}\b/gu) ?? []).length;
  const internalLinks = (
    html.match(/<a[^>]+href=["'](?:\/|https?:\/\/[^"'>]*?)["']/gi) ?? []
  ).length;
  const externalLinks = (
    html.match(/<a[^>]+href=["']https?:\/\/(?![^"'>]*?(?:localhost|127\.0\.0\.1))[^"'>]+["']/gi) ?? []
  ).length;
  const imagesWithoutAlt = (
    html.match(/<img(?![^>]*\balt=)[^>]*>/gi) ?? []
  ).length;

  const headings = {
    h1: (html.match(/<h1\b/gi) ?? []).length,
    h2: (html.match(/<h2\b/gi) ?? []).length,
    h3: (html.match(/<h3\b/gi) ?? []).length,
  };

  const securityHeaders = {
    strictTransportSecurity: Boolean(headers["strict-transport-security"]),
    contentSecurityPolicy: Boolean(headers["content-security-policy"]),
    xFrameOptions: Boolean(headers["x-frame-options"]),
    xContentTypeOptions: Boolean(headers["x-content-type-options"]),
    referrerPolicy: Boolean(headers["referrer-policy"]),
    permissionsPolicy: Boolean(headers["permissions-policy"]),
    crossOriginOpenerPolicy: Boolean(headers["cross-origin-opener-policy"]),
  };

  const heuristics = {
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    hasLang: /<html[^>]+lang=["']/i.test(html),
    hasSchemaOrg: /schema\.org/i.test(html),
    hasRobotsMeta: /<meta[^>]+name=["']robots["']/i.test(html),
    hasCspMeta: /<meta[^>]+http-equiv=["']content-security-policy["']/i.test(
      html,
    ),
    hasWpMarkers: /wp-content|wordpress|wp-includes/i.test(html),
    hasInlineScripts: /<script(?![^>]+src=)/i.test(html),
    domNodesEstimate: (html.match(/<[^/!][^>]*>/g) ?? []).length,
  };

  const facts = {
    requestedUrl,
    fetched: {
      finalUrl,
      status,
      fetchMs,
      htmlKb: Number((bytes / 1024).toFixed(1)),
      securityHeaders,
    },
    pageSpeed,
    title,
    description,
    robots,
    canonical,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      twitterCard,
    },
    headings,
    contentSignals: {
      wordCount,
      internalLinks,
      externalLinks,
      imagesWithoutAlt,
      jsonLdBlocks,
    },
    heuristics,
  };

  const compact = JSON.stringify(facts);
  return compact.length > 5000 ? `${compact.slice(0, 4997)}...` : compact;
}

function parseSnapshotSections(text: string): SnapshotSections {
  const clean = text.replace(/\r/g, "");
  const line = (name: string) =>
    clean
      .match(new RegExp(`${name}\\s*[—:-]\\s*([^\\n]+)`, "i"))?.[1]
      ?.trim() ?? "";

  return {
    seoGeo: line("SEO\\s*&\\s*GEO|SEO\\s*&\\s*discovery"),
    accessibility: line("Accessibility"),
    performance: line("Performance"),
    security: line("Security"),
    content: line("Content"),
    ctaLine: line("CTA\\s*line"),
  };
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getClientId(req: NextRequest): string {
  const ipHeader = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ipHeader || "anon";
}

function rateLimitOk(clientId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 20;
  const key = `sparky:${clientId}`;
  const current = memoryRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    memoryRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= max;
}

async function hashKey(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

async function trackFallbackStats(stats: SectionFallbackStats): Promise<void> {
  await kvIncr("sparky:obs:requests_total", 1);
  if (!stats.usedAnyFallback) return;
  await kvIncr("sparky:obs:requests_with_fallback_total", 1);
  await kvIncr("sparky:obs:fallback_sections_total", stats.fallbackCount);
  const updates = Object.entries(stats.fallbackBySection)
    .filter(([, used]) => used)
    .map(([section]) => kvIncr(`sparky:obs:fallback:${section}`, 1));
  await Promise.all(updates);
}

function normalizeGeminiJson(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return (fenced || trimmed).trim();
}

function sanitizeJsonCandidate(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractJsonStringField(input: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:"${escapedKey}"|${escapedKey})\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
    "i",
  );
  const matched = input.match(pattern)?.[1];
  if (!matched) return undefined;
  return matched.replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
}

function parseGeminiJsonHeuristic(
  rawText: string,
): Partial<GeminiSnapshotResult> & { sections?: Partial<SnapshotSections> } {
  const normalized = sanitizeJsonCandidate(normalizeGeminiJson(rawText));
  const extractedSections = parseSnapshotSections(normalized);

  const sections: SnapshotSections = {
    seoGeo: safeText(
      extractJsonStringField(normalized, "seoGeo"),
      extractedSections.seoGeo,
    ),
    accessibility: safeText(
      extractJsonStringField(normalized, "accessibility"),
      extractedSections.accessibility,
    ),
    performance: safeText(
      extractJsonStringField(normalized, "performance"),
      extractedSections.performance,
    ),
    security: safeText(
      extractJsonStringField(normalized, "security"),
      extractedSections.security,
    ),
    content: safeText(
      extractJsonStringField(normalized, "content"),
      extractedSections.content,
    ),
    ctaLine: safeText(
      extractJsonStringField(normalized, "ctaLine"),
      extractedSections.ctaLine,
    ),
  };

  return {
    greeting: extractJsonStringField(normalized, "greeting"),
    summaryText: extractJsonStringField(normalized, "summaryText"),
    sections,
  };
}

function parseGeminiJson(
  rawText: string,
):
  | (GeminiResponsePayload & { sections?: Partial<SnapshotSections> })
  | null {
  const normalized = normalizeGeminiJson(rawText);
  const balanced = extractBalancedJsonObject(normalized);
  const jsonSlice = (() => {
    const first = normalized.indexOf("{");
    const last = normalized.lastIndexOf("}");
    return first >= 0 && last > first ? normalized.slice(first, last + 1) : "";
  })();

  const attempts = [balanced, normalized, jsonSlice]
    .filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    )
    .flatMap((candidate) => {
      const clean = sanitizeJsonCandidate(candidate);
      return clean === candidate ? [candidate] : [candidate, clean];
    });

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as Partial<GeminiSnapshotResult> & {
        sections?: Partial<SnapshotSections>;
      };
    } catch {
      // Try next candidate.
    }
  }

  const heuristic = parseGeminiJsonHeuristic(rawText);
  const hasSignal =
    typeof heuristic.greeting === "string" ||
    typeof heuristic.summaryText === "string" ||
    Object.values(heuristic.sections ?? {}).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

  return hasSignal ? heuristic : null;
}

function pickSectionValue(
  parsed: GeminiResponsePayload,
  key: keyof SnapshotSections,
  fallback: string,
): string {
  const fromSection = safeText(parsed.sections?.[key], "");
  if (fromSection) return fromSection;

  return safeText(parsed[key], fallback);
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = safeText(value, "");
    if (normalized) return normalized;
  }
  return "";
}

function sectionAliasValues(
  parsed: GeminiResponsePayload,
  key: keyof SnapshotSections,
): unknown[] {
  const sectionObject = parsed.sections as Record<string, unknown> | undefined;
  const topLevel = parsed as Record<string, unknown>;

  const aliases: Record<keyof SnapshotSections, string[]> = {
    seoGeo: ["seoGeo", "seo", "seo_geo", "seoAndGeo", "seoDiscovery", "seogeo"],
    accessibility: ["accessibility", "a11y"],
    performance: ["performance", "speed", "coreWebVitals"],
    security: ["security", "sec"],
    content: ["content", "copy", "messaging"],
    ctaLine: ["ctaLine", "cta", "cta_line", "callToAction"],
  };

  const names = aliases[key];
  return names.flatMap((name) => [sectionObject?.[name], topLevel[name]]);
}

const MIN_SECTION_LENGTH = 40;

function hasAllNonEmptySections(sections: SnapshotSections): boolean {
  return (
    sections.seoGeo.length >= MIN_SECTION_LENGTH &&
    sections.accessibility.length >= MIN_SECTION_LENGTH &&
    sections.performance.length >= MIN_SECTION_LENGTH &&
    sections.security.length >= MIN_SECTION_LENGTH &&
    sections.content.length >= MIN_SECTION_LENGTH &&
    Boolean(sections.ctaLine)
  );
}

function buildSectionsFromParsed(
  parsed: GeminiResponsePayload,
  rawText: string,
  fallbacks: SnapshotSections,
): SnapshotSections {
  const fromRaw = parseSnapshotSections(rawText);
  const fromSummary = parseSnapshotSections(safeText(parsed.summaryText, ""));

  const resolved: SnapshotSections = {
    seoGeo: firstNonEmpty(
      ...sectionAliasValues(parsed, "seoGeo"),
      fromSummary.seoGeo,
      fromRaw.seoGeo,
    ),
    accessibility: firstNonEmpty(
      ...sectionAliasValues(parsed, "accessibility"),
      fromSummary.accessibility,
      fromRaw.accessibility,
    ),
    performance: firstNonEmpty(
      ...sectionAliasValues(parsed, "performance"),
      fromSummary.performance,
      fromRaw.performance,
    ),
    security: firstNonEmpty(
      ...sectionAliasValues(parsed, "security"),
      fromSummary.security,
      fromRaw.security,
    ),
    content: firstNonEmpty(
      ...sectionAliasValues(parsed, "content"),
      fromSummary.content,
      fromRaw.content,
    ),
    ctaLine: firstNonEmpty(
      ...sectionAliasValues(parsed, "ctaLine"),
      fromSummary.ctaLine,
      fromRaw.ctaLine,
    ),
  };

  if (hasAllNonEmptySections(resolved)) return resolved;

  return {
    seoGeo:
      resolved.seoGeo.length >= MIN_SECTION_LENGTH
        ? resolved.seoGeo
        : fallbacks.seoGeo,
    accessibility:
      resolved.accessibility.length >= MIN_SECTION_LENGTH
        ? resolved.accessibility
        : fallbacks.accessibility,
    performance:
      resolved.performance.length >= MIN_SECTION_LENGTH
        ? resolved.performance
        : fallbacks.performance,
    security:
      resolved.security.length >= MIN_SECTION_LENGTH
        ? resolved.security
        : fallbacks.security,
    content:
      resolved.content.length >= MIN_SECTION_LENGTH
        ? resolved.content
        : fallbacks.content,
    ctaLine: resolved.ctaLine || fallbacks.ctaLine,
  };
}

function computeFallbackStats(
  sections: SnapshotSections,
  fallbacks: SnapshotSections,
): SectionFallbackStats {
  const fallbackBySection = {
    seoGeo: sections.seoGeo === fallbacks.seoGeo,
    accessibility: sections.accessibility === fallbacks.accessibility,
    performance: sections.performance === fallbacks.performance,
    security: sections.security === fallbacks.security,
    content: sections.content === fallbacks.content,
    ctaLine: sections.ctaLine === fallbacks.ctaLine,
  } satisfies Record<keyof SnapshotSections, boolean>;
  const fallbackCount = Object.values(fallbackBySection).filter(Boolean).length;
  return {
    usedAnyFallback: fallbackCount > 0,
    fallbackCount,
    fallbackBySection,
  };
}

function extractBalancedJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function safeTextMin(
  value: unknown,
  minLength: number,
  fallback: string,
): string {
  return typeof value === "string" && value.trim().length >= minLength
    ? value.trim()
    : fallback;
}

function normalizeLogs(logs: unknown): TerminalLog[] {
  if (!Array.isArray(logs)) return [];
  return logs
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const level = safeText(
        (entry as { level?: string }).level,
        "INFO",
      ).toUpperCase();
      const stage = safeText((entry as { stage?: string }).stage, "Stream");
      const text = safeText((entry as { text?: string }).text, "");
      if (!text) return null;
      const typedLevel = [
        "INFO",
        "SUCCESS",
        "WARNING",
        "METRIC",
        "ERROR",
      ].includes(level)
        ? (level as TerminalLog["level"])
        : "INFO";
      return { level: typedLevel, stage, text };
    })
    .filter((entry): entry is TerminalLog => Boolean(entry));
}

function fallbackSnapshot(
  url: string,
  parseError?: string,
): GeminiSnapshotResult {
  const host = new URL(url).hostname;
const fallbackSections: SnapshotSections = {
  seoGeo:
    "Core SEO signals detected. Structural improvements can increase visibility and ranking performance.",
  accessibility:
    "Basic accessibility foundations present. Addressing usability gaps improves compliance and user experience.",
  performance:
    "Initial performance signals captured. Optimization opportunities exist to improve speed and rendering efficiency.",
  security:
    "Baseline security checks completed. Strengthening protections reduces exposure to common web risks.",
  content:
    "Content structure analyzed. Refinements can improve clarity, engagement, and conversion potential.",
  ctaLine:
    "Unlock the full report to identify, prioritize, and fix issues instantly.",
};
  return {
    greeting: defaultGreeting(url),
    summaryText: `Quick snapshot for ${host}: Core checks completed. Some response formatting was incomplete, so Sparky returned a safe fallback. Continue to full report for detailed evidence and one-click fixes.`,
    sections: fallbackSections,
    terminalLogs: parseError
      ? [
          {
            level: "WARNING",
            stage: "AI",
            text: `Malformed AI snapshot JSON handled via fallback (${parseError}).`,
          },
        ]
      : [
          {
            level: "WARNING",
            stage: "AI",
            text: "Malformed AI snapshot JSON handled via fallback.",
          },
        ],
    fallbackStats: computeFallbackStats(fallbackSections, fallbackSections),
  };
}

function composeSnapshotText(url: string, sections: SnapshotSections): string {
  const domain = new URL(url).hostname;
  return [
    `Quick snapshot for ${domain}:`,
    `SEO & GEO — ${sections.seoGeo}`,
    `Accessibility — ${sections.accessibility}`,
    `Performance — ${sections.performance}`,
    `Security — ${sections.security}`,
    `Content — ${sections.content}`,
    `CTA line — ${sections.ctaLine}`,
  ].join("\n\n");
}

function detectWordPressPlatform(html: string): "wordpress" | "generic" {
  return /wp-content|wp-includes|wordpress|wp-json/i.test(html)
    ? "wordpress"
    : "generic";
}

async function generateGeminiSnapshot(args: {
  url: string;
  locale: string;
  facts: string;
  signal: AbortSignal;
  isWordPress?: boolean;
}): Promise<GeminiSnapshotResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const prompt = buildGeminiSnapshotPrompt({
    locale: args.locale,
    url: args.url,
    facts: args.facts,
    isWordPress: args.isWordPress,
  });

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        signal: args.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              required: [
                "greeting",
                "summaryText",
                "sections",
                ...(args.isWordPress ? ["wordpressSection"] : []),
              ],
              properties: {
                greeting: { type: "STRING" },
                summaryText: { type: "STRING" },
                sections: {
                  type: "OBJECT",
                  required: [
                    "seoGeo",
                    "accessibility",
                    "performance",
                    "security",
                    "content",
                    "ctaLine",
                  ],
                  properties: {
                    seoGeo: { type: "STRING" },
                    accessibility: { type: "STRING" },
                    performance: { type: "STRING" },
                    security: { type: "STRING" },
                    content: { type: "STRING" },
                    ctaLine: { type: "STRING" },
                  },
                },
                ...(args.isWordPress
                  ? { wordpressSection: { type: "STRING" } }
                  : {}),
              },
            },
          },
        }),
      },
    );
  } catch (fetchErr) {
    if (fetchErr instanceof Error) throw fetchErr;
    throw new Error(
      `Gemini fetch failed: ${typeof fetchErr === "string" ? fetchErr : JSON.stringify(fetchErr)}`,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Gemini request failed (${response.status}): ${text.slice(0, 180)}`,
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";
  if (!raw.trim()) {
    return fallbackSnapshot(args.url, "empty-response");
  }

  const parsed = parseGeminiJson(raw);
  if (!parsed) {
    return fallbackSnapshot(args.url, "json-parse-failed");
  }

  const sectionFallbacks: SnapshotSections = {
    seoGeo: "No SEO/GEO signal.",
    accessibility: "No accessibility signal.",
    performance: "No performance signal.",
    security: "No security signal.",
    content: "No content signal.",
    ctaLine: "Want the full actionable report and automated fixes?",
  };

  const strictSections: SnapshotSections = {
    seoGeo: pickSectionValue(parsed, "seoGeo", ""),
    accessibility: pickSectionValue(parsed, "accessibility", ""),
    performance: pickSectionValue(parsed, "performance", ""),
    security: pickSectionValue(parsed, "security", ""),
    content: pickSectionValue(parsed, "content", ""),
    ctaLine: pickSectionValue(parsed, "ctaLine", ""),
  };

  const sections = hasAllNonEmptySections(strictSections)
    ? strictSections
    : buildSectionsFromParsed(parsed, raw, sectionFallbacks);

  const wordpressSection = args.isWordPress
    ? safeText(parsed.wordpressSection, "") ||
      extractJsonStringField(
        sanitizeJsonCandidate(normalizeGeminiJson(raw)),
        "wordpressSection",
      ) ||
      undefined
    : undefined;

  return {
    greeting: safeTextMin(parsed.greeting, 10, defaultGreeting(args.url)),
    summaryText: safeTextMin(
      parsed.summaryText,
      20,
      composeSnapshotText(args.url, sections),
    ),
    sections,
    terminalLogs: normalizeLogs(parsed.terminalLogs),
    fallbackStats: computeFallbackStats(sections, sectionFallbacks),
    wordpressSection,
  };
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));

  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: "Invalid url parameter." },
      { status: 400 },
    );
  }

  if (!rateLimitOk(getClientId(req))) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429 },
    );
  }

  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) {
    return NextResponse.json(
      { error: "URL must be valid http/https." },
      { status: 400 },
    );
  }

  try {
    await assertPublicDestination(normalizedUrl);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  const cacheKey = `sparky:snapshot:${await hashKey(`${normalizedUrl}|${locale}`)}`;
  const encoder = new TextEncoder();

  const cachedRaw = await kvGet(cacheKey);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as SnapshotPayload;
    const cachedStream = new ReadableStream({
      start(controller) {
        const emit = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        emit("message", {
          level: "INFO",
          stage: "Cache",
          text: "Cache hit. Replaying recent snapshot...",
        });
        emit("message", {
          level: "SUCCESS",
          stage: "Cache",
          text: cached.greeting || "Snapshot restored.",
        });
        emit("snapshot", cached);
        emit("done", { ok: true, cached: true });
        controller.close();
      },
    });

    return new Response(cachedStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      const log = (
        level: TerminalLog["level"],
        stage: string,
        text: string,
      ) => {
        emit("message", { level, stage, text });
      };

      try {
        const host = new URL(normalizedUrl).hostname;
        log("INFO", "Boot", `Analyzing ${host}…`);
        log("INFO", "Fetch", "Fetching HTML…");

        const fetchSnapshot = await limitedHtmlFetch(normalizedUrl);
        const platform = detectWordPressPlatform(fetchSnapshot.html);
        const facts = buildFacts(normalizedUrl, fetchSnapshot, null);
        log("SUCCESS", "Fetch", `HTML fetched in ${fetchSnapshot.fetchMs}ms`);
        log("INFO", "Signals", "Extracting key signals…");
        log("INFO", "Analysis", "Running multi-layer analysis…");

        let generated: GeminiSnapshotResult | undefined;
        let llmError: Error | undefined;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const llmController = new AbortController();
          const llmTimeout = setTimeout(
            () => llmController.abort(new Error(`LLM timed out after ${LLM_TIMEOUT_MS / 1000}s`)),
            LLM_TIMEOUT_MS,
          );
          try {
            log("INFO", "LLM", attempt === 1 ? "Requesting AI analysis…" : "Retrying AI analysis…");
            generated = await generateGeminiSnapshot({
              url: normalizedUrl,
              locale,
              facts,
              signal: llmController.signal,
              isWordPress: platform === "wordpress",
            });
            clearTimeout(llmTimeout);
            break;
          } catch (err) {
            clearTimeout(llmTimeout);
            llmError = err instanceof Error ? err : new Error(String(err));
          }
        }
        if (!generated) throw llmError ?? new Error("AI analysis failed.");

        log("SUCCESS", "Analysis", "Analysis complete");
        log("INFO", "Snapshot", "Generating snapshot…");

        for (const entry of generated.terminalLogs) {
          log(entry.level, entry.stage, entry.text);
        }
        if (generated.fallbackStats.usedAnyFallback) {
          log(
            "WARNING",
            "AI",
            `Fallback text used in ${generated.fallbackStats.fallbackCount} section(s).`,
          );
        }
        await trackFallbackStats(generated.fallbackStats);

        const payload: SnapshotPayload = {
          url: normalizedUrl,
          locale,
          generatedAt: new Date().toISOString(),
          platform,
          text:
            generated.summaryText ||
            composeSnapshotText(normalizedUrl, generated.sections),
          sections: generated.sections,
          greeting: generated.greeting,
          wordpressSection: generated.wordpressSection,
        };

        await kvSet(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
        if (payload.greeting) {
          emit("message", {
            level: "SUCCESS",
            stage: "Analysis",
            text: payload.greeting,
          });
        }
        emit("snapshot", payload);
        emit("done", { ok: true, cached: false });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message || error.name || "LLM error (empty message)"
            : typeof error === "string"
            ? error
            : "Failed to generate snapshot.";
        log("ERROR", "Pipeline", message);
        if (error instanceof Error && error.stack) {
          const firstFrame = error.stack.split("\n").slice(1, 3).join(" | ").trim();
          if (firstFrame) console.error("[Stream] Pipeline error:", firstFrame);
        }
        emit("error", { message });
        emit("done", { ok: false });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
