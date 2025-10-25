// saas-ux/app/api/analyze-facts/route.ts
import { NextRequest } from "next/server";
import { preScan } from "@/lib/analyzer/preScan";
import { isPublicUrl } from "@/lib/net/isPublicUrl";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

// Same convenience as the form: add https:// if missing
function normalizeInput(raw: string) {
  const s = (raw || "").trim();
  if (!s) return s;
  try {
    const candidate = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const url = new URL(candidate);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return raw;
  }
}

function minimalFacts(target: string) {
  try {
    const u = new URL(target);
    const origin = u.origin;
    return {
      inputUrl: target,
      finalUrl: target,
      domain: u.hostname,
      status: 0,
      isHttps: u.protocol === "https:",
      siteLang: null,
      faviconUrl: `${origin}/favicon.ico`,
      cms: { type: "unknown" as const },
      meta: { title: "", description: "", titleLen: 0, descriptionLen: 0, robotsMeta: "", hasCanonical: false },
      dom: { h1Count: 0, imgCount: 0, scriptCount: 0, linkCount: 0 },
      accessibility: { imgMissingAlt: 0, imgWithoutAltRatio: 0 },
      perfHints: { approxHtmlBytes: 0, heavyScriptHint: false, heavyImageHint: false },
      headers: {},
    };
  } catch {
    return {
      inputUrl: target,
      finalUrl: target,
      domain: "",
      status: 0,
      isHttps: false,
      siteLang: null,
      faviconUrl: null,
      cms: { type: "unknown" as const },
      meta: { title: "", description: "", titleLen: 0, descriptionLen: 0, robotsMeta: "", hasCanonical: false },
      dom: { h1Count: 0, imgCount: 0, scriptCount: 0, linkCount: 0 },
      accessibility: { imgMissingAlt: 0, imgWithoutAltRatio: 0 },
      perfHints: { approxHtmlBytes: 0, heavyScriptHint: false, heavyImageHint: false },
      headers: {},
    };
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url") || "";
  const target = normalizeInput(urlParam);

  if (!isPublicUrl(target)) {
    return new Response("Invalid URL", { status: 400 });
  }

  if (ratelimit) {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const { success } = await ratelimit.limit(`facts:${ip}`);
    if (!success) return new Response("Rate limit", { status: 429 });
  }

  try {
    const facts = await preScan(target);
    return Response.json(facts, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // return minimal data so SiteIdentityCard can still render
    const fallback = minimalFacts(target);
    return Response.json(fallback, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
