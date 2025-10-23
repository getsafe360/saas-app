import { fetchWithTimeout } from "@/lib/net/fetchWithTimeout";

type CmsInfo =
  | { type: "wordpress"; signals: string[]; wp: { version?: string | null; jsonApi: boolean | null; xmlrpc: boolean | null } }
  | { type: "unknown" };

function detectLang(html: string): string | null {
  const m =
    html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+http-equiv=["']Content-Language["'][^>]*content=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

function getOrigin(u: string) {
  try { return new URL(u).origin; } catch { return null; }
}

async function headOk(url: string, timeoutMs = 1000) {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", timeoutMs });
    return res.ok ? res : null;
  } catch { return null; }
}

export async function preScan(inputUrl: string) {
  const res = await fetchWithTimeout(inputUrl, { timeoutMs: 5000, redirect: "follow" as RequestRedirect });
  const finalUrl = res.url;
  const status = res.status;
  const isHttps = finalUrl.startsWith("https://");
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const html = (await res.text()).slice(0, 300_000); // cap
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim();
  const robotsMeta = (html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim();
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);

  const scripts = html.match(/<script\b[^>]*>/gi)?.length ?? 0;
  const imgs = html.match(/<img\b[^>]*>/gi)?.length ?? 0;
  const h1s = html.match(/<h1\b[^>]*>/gi)?.length ?? 0;

  // naive alt coverage
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;
  for (const tag of imgTags) {
    if (!/alt\s*=\s*["'][^"']*["']/i.test(tag)) missingAlt++;
  }

  const contentLength = html.length;
  const aTags = html.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi) || [];
  const aCount = aTags.length;

  // --- favicon guess ---
  const origin = getOrigin(finalUrl);
  const faviconUrl = origin ? `${origin}/favicon.ico` : null;

  // --- site language (best-effort) ---
  const siteLang = detectLang(html);

  // --- CMS detection (WordPress) ---
  let cms: CmsInfo = { type: "unknown" };
  const signals: string[] = [];
  let wpVersion: string | null = null;
  if (/wp-content\/|wp-includes\/|<meta[^>]+name=["']generator["'][^>]*content=["']WordPress/i.test(html) ||
      /x-powered-by/i.test(JSON.stringify(headers)) ||
      /wordpress/i.test(headers["x-generator"] || "")) {
    signals.push("pattern:wp-* or generator");
    const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']WordPress\s*([0-9.]+)?/i)?.[1] || null;
    if (gen) { wpVersion = gen; signals.push(`version:${gen}`); }

    // quick heads (fast timeout)
    const jsonApiHead = origin ? await headOk(`${origin}/wp-json/`, 800) : null;
    const xmlrpcHead = origin ? await headOk(`${origin}/xmlrpc.php`, 800) : null;

    cms = {
      type: "wordpress",
      signals,
      wp: {
        version: wpVersion,
        jsonApi: jsonApiHead ? true : null,   // null = unknown (timeout)
        xmlrpc: xmlrpcHead ? true : null,
      }
    };
  }

  return {
    inputUrl,
    finalUrl,
    domain: origin ? new URL(finalUrl).hostname : "",
    status,
    isHttps,
    siteLang,
    faviconUrl,
    cms,
    meta: {
      title,
      description: metaDesc,
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
    },
    headers
  };
}
