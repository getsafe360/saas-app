import { NextRequest, NextResponse } from "next/server";

const PAGESPEED_TIMEOUT_MS = 12_000;

type EnvProbe = {
  loaded: boolean;
  length: number;
  preview: string;
};

type PageSpeedProbe = {
  requestedUrl: string;
  status: number | null;
  ok: boolean;
  strategy: string | null;
  categoriesPresent: string[];
  categoryScores: Partial<Record<"performance" | "accessibility" | "seo", number>>;
  error: string | null;
};

function redactEnv(value?: string): EnvProbe {
  if (!value) {
    return { loaded: false, length: 0, preview: "missing" };
  }

  if (value.length <= 8) {
    return { loaded: true, length: value.length, preview: "***" };
  }

  return {
    loaded: true,
    length: value.length,
    preview: `${value.slice(0, 4)}…${value.slice(-3)}`,
  };
}

function normalizeProbeUrl(raw: string | null): string {
  if (!raw) return "https://example.com";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "https://example.com";
    }
    return url.toString();
  } catch {
    return "https://example.com";
  }
}

async function probePageSpeed(url: string, apiKey?: string): Promise<PageSpeedProbe> {
  if (!apiKey) {
    return {
      requestedUrl: url,
      status: null,
      ok: false,
      strategy: null,
      categoriesPresent: [],
      categoryScores: {},
      error: "PAGESPEED_API_KEY missing",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), PAGESPEED_TIMEOUT_MS);

  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}` +
      `&category=performance&category=accessibility&category=seo` +
      `&strategy=mobile&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | {
          lighthouseResult?: {
            categories?: Record<string, { score?: number }>;
            configSettings?: { formFactor?: string };
          };
        }
      | null;

    const categories = body?.lighthouseResult?.categories ?? {};
    const categoryScores: PageSpeedProbe["categoryScores"] = {};

    for (const key of ["performance", "accessibility", "seo"] as const) {
      const rawScore = categories[key]?.score;
      if (typeof rawScore === "number") {
        categoryScores[key] = Math.round(rawScore * 100);
      }
    }

    return {
      requestedUrl: url,
      status: response.status,
      ok: response.ok,
      strategy: body?.lighthouseResult?.configSettings?.formFactor ?? null,
      categoriesPresent: Object.keys(categories),
      categoryScores,
      error: response.ok ? null : "PageSpeed response not OK",
    };
  } catch (error) {
    return {
      requestedUrl: url,
      status: null,
      ok: false,
      strategy: null,
      categoriesPresent: [],
      categoryScores: {},
      error: error instanceof Error ? error.message : "Unknown PageSpeed error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const testUrl = normalizeProbeUrl(req.nextUrl.searchParams.get("url"));

  const pageSpeed = await probePageSpeed(testUrl, process.env.PAGESPEED_API_KEY);

  return NextResponse.json({
    now: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    env: {
      PAGESPEED_API_KEY: redactEnv(process.env.PAGESPEED_API_KEY),
      GEMINI_API_KEY: redactEnv(process.env.GEMINI_API_KEY),
      KV_REST_API_URL: redactEnv(process.env.KV_REST_API_URL),
      KV_REST_API_TOKEN: redactEnv(process.env.KV_REST_API_TOKEN),
      UPSTASH_REDIS_REST_URL: redactEnv(process.env.UPSTASH_REDIS_REST_URL),
      UPSTASH_REDIS_REST_TOKEN: redactEnv(process.env.UPSTASH_REDIS_REST_TOKEN),
    },
    pageSpeed,
  });
}
