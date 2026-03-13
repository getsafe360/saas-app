import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
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

type SnapshotPayload = {
  url: string;
  locale: string;
  generatedAt: string;
  text: string;
  sections: SnapshotSections;
};

const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 8_000;
const FETCH_MAX_BYTES = 300_000;
const LLM_TIMEOUT_MS = 20_000;
const CACHE_TTL_SECONDS = 60 * 60 * 8;

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
  return ip.split(".").map(Number).reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const value = toIPv4Int(ip);
  return IPV4_PRIVATE_RANGES.some(([start, end]) => value >= start && value <= end);
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
  const withScheme = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
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
  if (url.username || url.password) throw new Error("Credentialed URLs are not allowed.");
  const host = url.hostname;

  if (net.isIP(host)) {
    const version = net.isIP(host);
    if ((version === 4 && isPrivateIPv4(host)) || (version === 6 && isPrivateIPv6(host))) {
      throw new Error("Private network targets are blocked.");
    }
    return;
  }

  if (/localhost$/i.test(host) || /\.local$/i.test(host) || /\.internal$/i.test(host)) {
    throw new Error("Local network hostnames are blocked.");
  }

  const records = await dns.lookup(host, { all: true });
  if (
    records.some((record) =>
      record.family === 4 ? isPrivateIPv4(record.address) : isPrivateIPv6(record.address),
    )
  ) {
    throw new Error("Target resolves to a private IP.");
  }
}

async function limitedHtmlFetch(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "SparkySiteAnalyzer/1.0 (+https://getsafe360.com)" },
      cache: "no-store",
    });

    if (!response.ok || !response.body) throw new Error(`Failed to fetch HTML (${response.status})`);

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
    hasCspMeta: /<meta[^>]+http-equiv=["']content-security-policy["']/i.test(html),
    hasWpMarkers: /wp-content|wordpress|wp-includes/i.test(html),
    hasInlineScripts: /<script(?![^>]+src=)/i.test(html),
  };

  const facts = {
    url,
    title,
    description,
    headings,
    heuristics,
  };

  const compact = JSON.stringify(facts);
  return compact.length > 1000 ? `${compact.slice(0, 997)}...` : compact;
}

function parseSnapshotSections(text: string): SnapshotSections {
  const clean = text.replace(/\r/g, "");
  const line = (name: string) =>
    clean.match(new RegExp(`${name}\\s*[—:-]\\s*([^\\n]+)`, "i"))?.[1]?.trim() ?? "No signal.";

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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));

  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  if (!rateLimitOk(getClientId(req))) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) {
    return NextResponse.json({ error: "URL must be valid http/https." }, { status: 400 });
  }

  try {
    await assertPublicDestination(normalizedUrl);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const cacheKey = `sparky:snapshot:${await hashKey(`${normalizedUrl}|${locale}`)}`;
  const encoder = new TextEncoder();

  const cachedRaw = await kvGet(cacheKey);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as SnapshotPayload;
    const cachedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent("message", { text: "Cache hit. Replaying recent snapshot..." })));
        controller.enqueue(encoder.encode(sseEvent("message", { text: cached.text })));
        controller.enqueue(encoder.encode(sseEvent("snapshot", cached)));
        controller.enqueue(encoder.encode(sseEvent("done", { ok: true, cached: true })));
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
      const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      try {
        emit("message", { text: "Hi, I'm Sparky. I'll walk you through what we find in real time." });
        emit("message", { text: "Hi! Here is your test report." });
        emit("message", { text: "Fetching HTML..." });

        const html = await limitedHtmlFetch(normalizedUrl);
        const facts = buildFacts(normalizedUrl, html);

        emit("message", { text: "Analyzing accessibility..." });
        emit("message", { text: "Checking SEO..." });
        emit("message", { text: "Running security checks..." });

        const llmController = new AbortController();
        const llmTimeout = setTimeout(() => llmController.abort("timeout"), LLM_TIMEOUT_MS);

        const systemPrompt = "You are Sparky, a concise website analyzer.";
        const userPrompt = [
          `Target locale: ${locale}`,
          "Use this exact section order and one line per section:",
          "Quick snapshot for <domain>:",
          "SEO & GEO — ...",
          "Accessibility — ...",
          "Performance — ...",
          "Security — ...",
          "Content — ...",
          "CTA line: 'Want the full actionable report and automated fixes.'",
          "Hard limits: 150-200 words total. No reasoning steps. No chain-of-thought. Output only in requested locale.",
          `Facts JSON: ${facts}`,
        ].join("\n");

        const { textStream } = streamText({
          model: openai("gpt-4o-mini"),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.1,
          maxOutputTokens: 260,
          abortSignal: llmController.signal,
        });

        let assembled = "";
        for await (const token of textStream) {
          if (!token) continue;
          assembled += token;
          emit("message", { text: token });
        }

        clearTimeout(llmTimeout);

        const payload: SnapshotPayload = {
          url: normalizedUrl,
          locale,
          generatedAt: new Date().toISOString(),
          text: assembled.trim(),
          sections: parseSnapshotSections(assembled),
        };

        await kvSet(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);
        emit("snapshot", payload);
        emit("done", { ok: true, cached: false });
        controller.close();
      } catch (error) {
        emit("error", { message: (error as Error).message || "Failed to generate snapshot." });
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
