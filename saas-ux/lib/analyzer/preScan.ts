import { fetchWithTimeout } from "@/lib/net/fetchWithTimeout";
import { balanceTags, extractTitle, restoreLt } from "@/lib/net/sanitizeHtml";

type CmsInfo =
  | { type: "wordpress"; signals: string[]; wp: { version?: string | null; jsonApi: boolean | null; xmlrpc: boolean | null; usersExposed?: boolean | null } }
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

/**
 * true  = anonymous GET /wp-json/wp/v2/users returned user records (enumeration possible)
 * false = the route is blocked or absent (401/403/404, or no records)
 * null  = could not tell (timeout, odd status)
 */
export async function usersEndpointExposed(origin: string): Promise<boolean | null> {
  try {
    const res = await fetchWithTimeout(`${origin}/wp-json/wp/v2/users?per_page=1`, {
      timeoutMs: 2500,
      redirect: "manual" as RequestRedirect,
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
    if (res.status !== 200) return null;
    const text = (await res.text()).slice(0, 50_000);
    const body = JSON.parse(text);
    return Array.isArray(body) && body.some((u) => u && typeof u === "object" && ("slug" in u || "id" in u));
  } catch {
    return null;
  }
}

export async function preScan(inputUrl: string) {
  const res = await fetchWithTimeout(inputUrl, { timeoutMs: 5000, redirect: "follow" as RequestRedirect });
  const finalUrl = res.url;
  const status = res.status;
  const isHttps = finalUrl.startsWith("https://");
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  // cap, then neutralise unclosed "<" so the regexes below stay linear on hostile pages
  const html = balanceTags((await res.text()).slice(0, 300_000));
  const title = extractTitle(html);
  const metaDesc = restoreLt((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim());
  const robotsMeta = restoreLt((html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || "").trim());
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  // Signals the SEO fix planner needs. All three are things the WordPress
  // connector can inject into <head>, so detecting them is what makes a
  // "fix available" claim honest.
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html);
  const hasTwitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(html);

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

    // Is user enumeration actually possible? /wp-json/ answering says nothing about it: the
    // users route must return records to an anonymous caller (true), refuse (false), or we
    // could not tell (null).
    const usersExposed = origin ? await usersEndpointExposed(origin) : null;

    cms = {
      type: "wordpress",
      signals,
      wp: {
        version: wpVersion,
        jsonApi: jsonApiHead ? true : null,   // null = unknown (timeout)
        xmlrpc: xmlrpcHead ? true : null,
        usersExposed,
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
      hasCanonical,
      hasJsonLd,
      hasOgTitle,
      hasOgImage,
      hasTwitterCard
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
