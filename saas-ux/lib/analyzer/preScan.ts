// lib/analyzer/preScan.ts (no-LLM facts; small & fast)
import { fetchWithTimeout } from "@/lib/net/fetchWithTimeout";

export async function preScan(inputUrl: string) {
  const res = await fetchWithTimeout(inputUrl, { timeoutMs: 5000, redirect: "follow" as RequestRedirect });
  const finalUrl = res.url;
  const status = res.status;
  const isHttps = finalUrl.startsWith("https://");

  const html = (await res.text()).slice(0, 300_000); // cap for safety
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim();
  const robotsMeta = (html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim();
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);

  const scripts = html.match(/<script\b[^>]*>/gi)?.length ?? 0;
  const imgs = html.match(/<img\b[^>]*>/gi)?.length ?? 0;
  const h1s = html.match(/<h1\b[^>]*>/gi)?.length ?? 0;

  // Naive alt coverage
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;
  for (const tag of imgTags) {
    if (!/alt\s*=\s*["'][^"']*["']/i.test(tag)) missingAlt++;
  }

  const contentLength = html.length;
  const aTags = html.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || [];
  const aCount = aTags.length;

  return {
    inputUrl,
    finalUrl,
    status,
    isHttps,
    meta: {
      titleLen: title.length,
      descriptionLen: metaDesc.length,
      robotsMeta,
      hasCanonical
    },
    dom: {
      h1Count: h1s,
      imgCount: imgs,
      scriptCount: scripts,
      linkCount: aCount
    },
    accessibility: {
      imgMissingAlt: missingAlt,
      imgWithoutAltRatio: imgs ? missingAlt / imgs : 0
    },
    perfHints: {
      approxHtmlBytes: contentLength,
      heavyScriptHint: scripts > 20,
      heavyImageHint: imgs > 50
    }
  };
}
