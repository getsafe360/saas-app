import { NextRequest } from "next/server";
import { preScan } from "@/lib/analyzer/preScan";
import { buildPrompt } from "@/lib/analyzer/prompt";
import { kvGet, kvSet } from "@/lib/kv";
import { isPublicUrl } from "@/lib/net/isPublicUrl";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// --- rate limit (optional, auto-off if no envs) ---
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(30, "1 m") })
  : null;

// --- helpers ---
function normalizeInput(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    if (!url.protocol) url.protocol = "https:";
    return url.toString();
  } catch {
    return u;
  }
}

function safeLocale(raw?: string) {
  const v = (raw || "en").trim().toLowerCase();
  // allow simple BCP47 like "en", "de", "pt-br"
  return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(v) ? v : "en";
}

async function hashKey(s: string) {
  const h = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s)
  );
  // short hex prefix keeps keys compact
  return Array.from(new Uint8Array(h))
    .slice(0, 10)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const unsafeUrl = body?.url as string | undefined;
    const rawLocale = body?.locale as string | undefined;

    if (!unsafeUrl || typeof unsafeUrl !== "string" || unsafeUrl.length > 2048) {
      return new Response("Invalid URL", { status: 400 });
    }

    const target = normalizeInput(unsafeUrl);
    if (!isPublicUrl(target)) {
      return new Response("Invalid URL", { status: 400 });
    }

    const locale = safeLocale(rawLocale);

    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") ?? "anon";
      const { success } = await ratelimit.limit(`analyze:${ip}`);
      if (!success) return new Response("Rate limit", { status: 429 });
    }

    // --- cache (short key via hash) ---
    const cacheKey = `anlz:v1:${await hashKey(`${target}|${locale}`)}`;
    const cached = await kvGet(cacheKey);
    if (cached) {
      const enc = new TextEncoder();
      // send cached as a single chunk (still a stream for consistency)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode(cached));
            controller.close();
          },
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Language": locale,
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // --- Stage 1: Cheap pre-scan (no LLM) ---
    let facts: any;
    try {
      facts = await preScan(target);
    } catch {
      // keep going with minimal facts; prompt will still deliver helpful guidance
      facts = {
        inputUrl: target,
        status: "unknown",
        meta: {},
        dom: {},
        accessibility: {},
        perfHints: {},
      };
    }

    // --- Stage 2: LLM summary (tiny, language-locked, strict format) ---
    const prompt = buildPrompt({ locale, facts });

    const { textStream } = streamText({
      model: openai("gpt-4o-mini"),
      temperature: 0.2,
      maxOutputTokens: 400, // v5 setting
      system: prompt.system,
      prompt: prompt.user,
    });

    const enc = new TextEncoder();
    const chunks: string[] = [];
    const ZWSP = "\u200B"; // kick off streaming immediately
    let sentKickoff = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // early flush for faster TTFB
          controller.enqueue(enc.encode(ZWSP));
          sentKickoff = true;

          for await (const delta of textStream) {
            if (delta) {
              controller.enqueue(enc.encode(delta));
              chunks.push(delta);
            }
          }

          // Guard: if model yielded nothing, produce a friendly minimal message
          if (chunks.length === 0) {
            const fallback = [
              "# Rundown",
              "No content received from analyzer. Please retry in a moment.",
              "If this persists, ensure the URL is publicly reachable.",
            ].join("\n\n");
            controller.enqueue(enc.encode(fallback));
            chunks.push(fallback);
          }

          controller.close();

          // cache short-lived
          const body = chunks.join("");
          await kvSet(cacheKey, body, 60 * 60 * 6); // 6h TTL
        } catch (err: any) {
          // Try to emit a graceful inline error if streaming already started
          const msg =
            "\n\n⚠️ Error generating summary. Please try again shortly.";
          try {
            if (!sentKickoff) controller.enqueue(enc.encode(ZWSP));
            controller.enqueue(enc.encode(msg));
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Language": locale,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}
