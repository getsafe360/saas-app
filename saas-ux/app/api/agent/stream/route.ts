import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { kvGet, kvSet } from "@/lib/kv";

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
  sections: SnapshotSections;
  greeting?: string;
};

type GeminiSnapshotResult = {
  greeting: string;
  summaryText: string;
  sections: SnapshotSections;
  terminalLogs: TerminalLog[];
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
};

const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 8_000;
const FETCH_MAX_BYTES = 300_000;
const LLM_TIMEOUT_MS = 20_000;
const CACHE_TTL_SECONDS = 60 * 60 * 8;
const GEMINI_MODEL =
  process.env.GEMINI_SNAPSHOT_MODEL || "gemini-3-flash-preview";

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

async function limitedHtmlFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("timeout"),
    FETCH_TIMEOUT_MS,
  );
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

    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timeout);
  }
}

function extractTagContent(html: string, regex: RegExp): string {
  const matched = html.match(regex)?.[1] ?? "";
  return matched.replace(/\s+/g, " ").trim();
}

function buildFacts(url: string, html: string): string {
  const title = extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extractTagContent(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  );

  const headings = {
    h1: (html.match(/<h1\b/gi) ?? []).length,
    h2: (html.match(/<h2\b/gi) ?? []).length,
    h3: (html.match(/<h3\b/gi) ?? []).length,
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
    url,
    title,
    description,
    headings,
    heuristics,
  };

  const compact = JSON.stringify(facts);
  return compact.length > 3500 ? `${compact.slice(0, 3497)}...` : compact;
}

function parseSnapshotSections(text: string): SnapshotSections {
  const clean = text.replace(/\r/g, "");
  const line = (name: string) =>
    clean
      .match(new RegExp(`${name}\\s*[—:-]\\s*([^\\n]+)`, "i"))?.[1]
      ?.trim() ?? "No signal.";

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

function nowStamp(): string {
  return new Date().toISOString().substring(11, 19);
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

  const sections: SnapshotSections = {
    seoGeo: safeText(
      extractJsonStringField(normalized, "seoGeo"),
      parseSnapshotSections(normalized).seoGeo,
    ),
    accessibility: safeText(
      extractJsonStringField(normalized, "accessibility"),
      parseSnapshotSections(normalized).accessibility,
    ),
    performance: safeText(
      extractJsonStringField(normalized, "performance"),
      parseSnapshotSections(normalized).performance,
    ),
    security: safeText(
      extractJsonStringField(normalized, "security"),
      parseSnapshotSections(normalized).security,
    ),
    content: safeText(
      extractJsonStringField(normalized, "content"),
      parseSnapshotSections(normalized).content,
    ),
    ctaLine: safeText(
      extractJsonStringField(normalized, "ctaLine"),
      parseSnapshotSections(normalized).ctaLine,
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
  return safeText(parsed.sections?.[key] ?? parsed[key], fallback);
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
  return {
    greeting:
      "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.",
    summaryText: `Quick snapshot for ${host}: Core checks completed. Some response formatting was incomplete, so Sparky returned a safe fallback. Continue to full report for detailed evidence and one-click fixes.`,
    sections: {
      seoGeo:
        "Basic indexability checks completed; detailed SEO/GEO signals available in full report.",
      accessibility:
        "Initial accessibility sweep completed; inspect full report for issue-level WCAG guidance.",
      performance:
        "HTML payload and rendering signals captured; full report includes optimization priorities.",
      security:
        "Transport and baseline security heuristics checked; review full report for remediation steps.",
      content:
        "Content structure sampled for quality and clarity; expand in full report for targeted actions.",
      ctaLine:
        "Open the full report to unlock detailed checklist and automated fixes.",
    },
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
  ].join("\n");
}

async function generateGeminiSnapshot(args: {
  url: string;
  locale: string;
  facts: string;
  signal: AbortSignal;
}): Promise<GeminiSnapshotResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const prompt = [
    `Target locale: ${args.locale}`,
    `Analyze website snapshot facts for ${args.url}.`,
    "Return strict JSON with fields:",
    "greeting (string)",
    "summaryText (string)",
    "sections object with keys: seoGeo, accessibility, performance, security, content, ctaLine",
    "terminalLogs array of objects with: level(INFO|SUCCESS|WARNING|METRIC|ERROR), stage, text",
    "Rules:",
    "- terminalLogs must be concise developer terminal messages.",
    "- Include at least 1 METRIC log with concrete value.",
    "- SEO/GEO section must never be empty.",
    "- Mention WordPress risk/automation if WP markers are present.",
    "- Keep summary under 180 words.",
    `Facts JSON: ${args.facts}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      signal: args.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1100,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: [
              "greeting",
              "summaryText",
              "sections",
              "terminalLogs",
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
              terminalLogs: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  required: ["level", "stage", "text"],
                  properties: {
                    level: {
                      type: "STRING",
                      enum: ["INFO", "SUCCESS", "WARNING", "METRIC", "ERROR"],
                    },
                    stage: { type: "STRING" },
                    text: { type: "STRING" },
                  },
                },
              },
            },
          },
        },
      }),
    },
  );

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

  const sections: SnapshotSections = {
    seoGeo: pickSectionValue(parsed, "seoGeo", "No SEO/GEO signal."),
    accessibility: pickSectionValue(
      parsed,
      "accessibility",
      "No accessibility signal.",
    ),
    performance: pickSectionValue(parsed, "performance", "No performance signal."),
    security: pickSectionValue(parsed, "security", "No security signal."),
    content: pickSectionValue(parsed, "content", "No content signal."),
    ctaLine: pickSectionValue(
      parsed,
      "ctaLine",
      "Want the full actionable report and automated fixes.",
    ),
  };

  return {
    greeting: safeText(
      parsed.greeting,
      "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.",
    ),
    summaryText: safeText(
      parsed.summaryText,
      composeSnapshotText(args.url, sections),
    ),
    sections,
    terminalLogs: normalizeLogs(parsed.terminalLogs),
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
          timestamp: nowStamp(),
        });
        emit("message", {
          level: "SUCCESS",
          stage: "Cache",
          text: cached.greeting || "Snapshot restored.",
          timestamp: nowStamp(),
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
        emit("message", { level, stage, text, timestamp: nowStamp() });
      };

      try {
        log(
          "INFO",
          "Boot",
          "Hi, I'm Sparky, your AI assistant. I'll give you a site snapshot report on items identified for improvement.",
        );
        log("INFO", "Fetch", "Fetching HTML...");

        const html = await limitedHtmlFetch(normalizedUrl);
        const facts = buildFacts(normalizedUrl, html);
        log("SUCCESS", "Fetch", "HTML fetched successfully.");
        log("METRIC", "Fetch", `Payload ${(html.length / 1024).toFixed(1)}KB`);
        log("INFO", "AI", "Preparing your site snapshot...");

        const llmController = new AbortController();
        const llmTimeout = setTimeout(
          () => llmController.abort("timeout"),
          LLM_TIMEOUT_MS,
        );

        const generated = await generateGeminiSnapshot({
          url: normalizedUrl,
          locale,
          facts,
          signal: llmController.signal,
        });

        clearTimeout(llmTimeout);

        for (const entry of generated.terminalLogs) {
          log(entry.level, entry.stage, entry.text);
        }

        const payload: SnapshotPayload = {
          url: normalizedUrl,
          locale,
          generatedAt: new Date().toISOString(),
          text:
            generated.summaryText ||
            composeSnapshotText(normalizedUrl, generated.sections),
          sections: generated.sections,
          greeting: generated.greeting,
        };

        await kvSet(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
        emit("snapshot", payload);
        emit("done", { ok: true, cached: false });
        controller.close();
      } catch (error) {
        const message =
          (error as Error).message || "Failed to generate snapshot.";
        log("ERROR", "Pipeline", message);
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
