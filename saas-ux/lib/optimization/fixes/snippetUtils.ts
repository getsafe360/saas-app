// lib/optimization/fixes/snippetUtils.ts
// Shared utilities for categorising and normalising fix snippets.
// Used by the WordPress push filter (stream route) and fix-pack builder
// to ensure only valid HTML head content is injected into wp_head.

/**
 * Classify a raw snippet string by its intended deployment target.
 * Returns null when the snippet is empty or unrecognisable.
 */
export function categoriseSnippet(
  snippet: string,
  section?: string | null,
): "head" | "robots" | "htaccess" | "llms" | null {
  const s = snippet.trim();
  if (!s) return null;

  // llms.txt directives — check section hint first, then content markers
  if (
    section === "llms-txt" ||
    (s.startsWith("#") && (s.includes("Canonical") || s.includes("Attribution") || s.includes("Contact")))
  ) return "llms";

  // robots.txt AI-bot directives
  if (s.includes("User-agent:") && (s.includes("Allow:") || s.includes("Disallow:"))) return "robots";

  // Apache / .htaccess directives
  if (
    s.includes("ServerTokens") ||
    s.includes("ServerSignature") ||
    s.includes("<Files") ||
    s.includes("Order Deny") ||
    s.includes("Header unset") ||
    s.includes("RewriteRule") ||
    s.includes("Options -Indexes")
  ) return "htaccess";

  // HTML head content (script, meta, link, title tags)
  if (
    s.includes("<script") ||
    s.includes("<link") ||
    s.includes("<title") ||
    s.includes("<meta")
  ) return "head";

  // Bare JSON object/array — valid schema fragment, needs wrapping before head injection
  if (s.startsWith("{") || s.startsWith("[")) return "head";

  return null;
}

/**
 * Normalise a snippet classified as "head" before injecting into wp_head:
 *
 * 1. Bare JSON objects/arrays → wrap in <script type="application/ld+json">
 * 2. Mixed snippets that contain raw JSON FOLLOWED by a <script> wrapper →
 *    strip the raw prefix (avoids duplicate visible text + script block)
 * 3. Partial JSON property strings (e.g. `"sameAs":[...]`) → return null
 *    (these are schema fragments, not valid standalone head content)
 *
 * Returns null when the snippet cannot be made safe for head injection.
 */
export function normaliseHeadSnippet(snippet: string): string | null {
  const s = snippet.trim();
  if (!s) return null;

  // Bare JSON object or array — wrap it
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      JSON.parse(s);
      return `<script type="application/ld+json">${s}</script>`;
    } catch {
      // Not valid standalone JSON — drop it
      return null;
    }
  }

  // Mixed snippet: raw JSON object/array on first line(s), then <script> wrapper
  // Strip the raw prefix and keep only the <script> block.
  const scriptTagIndex = s.search(/<script\s[^>]*type\s*=\s*["']application\/ld\+json["']/i);
  if (scriptTagIndex > 0) {
    const prefix = s.slice(0, scriptTagIndex).trim();
    // Only strip if the prefix looks like raw JSON (not a comment or other tag)
    if (prefix.startsWith("{") || prefix.startsWith("[")) {
      return s.slice(scriptTagIndex).trim();
    }
  }

  // Partial JSON property strings like `"sameAs":[...]` or `"dateModified":"..."`
  // These are not valid HTML or standalone JSON — reject them
  if (s.startsWith('"') && s.includes(":")) {
    return null;
  }

  // Plain text content (e.g. heading text, title text without <title> tag)
  // Reject anything that has no HTML tags at all and isn't JSON
  const hasHtmlTag = /<[a-z][\s\S]*>/i.test(s);
  if (!hasHtmlTag) {
    return null;
  }

  return s;
}
