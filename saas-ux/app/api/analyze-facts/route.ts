import { NextRequest } from "next/server";
import { preScan } from "@/lib/analyzer/preScan";
import { isPublicUrl } from "@/lib/net/isPublicUrl";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Optional rate limit (auto-off if envs not set)
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

export async function GET(req: NextRequest) {
  try {
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

    const facts = await preScan(target);

    return Response.json(facts, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(e?.message ?? "Server error", { status: 500 });
  }
}
