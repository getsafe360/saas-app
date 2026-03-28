export type PageSpeedSummary = {
  strategy: "mobile" | "desktop";
  categories: Partial<Record<"performance" | "accessibility" | "seo", number>>;
  firstContentfulPaintMs?: number;
  largestContentfulPaintMs?: number;
  cumulativeLayoutShift?: number;
  totalBlockingTimeMs?: number;
};

type PageSpeedOptions = {
  apiKey?: string;
  strategy?: "mobile" | "desktop";
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function scoreToPercent(raw: number | undefined): number | undefined {
  return typeof raw === "number" ? Math.round(raw * 100) : undefined;
}

export async function getPageSpeedSummary(
  pageUrl: string,
  options: PageSpeedOptions = {},
): Promise<PageSpeedSummary | null> {
  const apiKey = options.apiKey ?? process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  const strategy = options.strategy ?? "mobile";
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(pageUrl)}&category=performance&category=accessibility&category=seo&strategy=${strategy}&key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
        configSettings?: { formFactor?: "mobile" | "desktop" };
      };
    };

    const categories = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;
    if (!categories) return null;

    return {
      strategy: data.lighthouseResult?.configSettings?.formFactor || strategy,
      categories: {
        performance: scoreToPercent(categories.performance?.score),
        accessibility: scoreToPercent(categories.accessibility?.score),
        seo: scoreToPercent(categories.seo?.score),
      },
      firstContentfulPaintMs: audits?.["first-contentful-paint"]?.numericValue,
      largestContentfulPaintMs: audits?.["largest-contentful-paint"]?.numericValue,
      cumulativeLayoutShift: audits?.["cumulative-layout-shift"]?.numericValue,
      totalBlockingTimeMs: audits?.["total-blocking-time"]?.numericValue,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
