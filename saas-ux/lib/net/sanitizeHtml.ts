// lib/net/sanitizeHtml.ts
//
// Linear-time guards for scanning HTML that WE DID NOT WRITE (it comes from a
// user-supplied URL, so it can be hostile).
//
// Why this exists: our signal extraction uses regular expressions such as
// /<link[^>]+rel=["']canonical["'][^>]+href=.../. On malformed HTML (a page that
// is just thousands of unclosed "<link rel=canonical " fragments) these
// backtrack catastrophically: 25 KB took ~9 s and 50 KB never finished. Node is
// single-threaded, so one such page freezes the whole function instance.
//
// The slow behaviour needs a "<" whose tag never closes before the next "<".
// balanceTags() neutralises exactly those, in one O(n) pass, so every remaining
// "<" opens a tag that is closed before the next tag starts. Well-formed pages
// come out unchanged.

/**
 * Replaces every "<" that does not open a tag closed by ">" before the next "<"
 * with a space (not "&lt;", which would add a spurious two-letter "word" to word
 * counts). Returns the input untouched (same string) when nothing needs
 * escaping, which is the normal case for real pages.
 */
export function balanceTags(html: string): string {
  const n = html.length;
  let out: string[] | null = null;
  let last = 0;
  let gt = -2; // position of the next ">" at or after the current "<"; -1 = none left

  let i = html.indexOf("<");
  while (i !== -1) {
    // Next ">" at or after i. Recomputed only once we have passed the previous
    // one, so the scanned ranges never overlap: O(n) in total.
    if (gt !== -1 && gt < i) gt = html.indexOf(">", i);

    const nextLt = i + 1 < n ? html.indexOf("<", i + 1) : -1;
    const opensTag = gt !== -1 && (nextLt === -1 || gt < nextLt);

    if (!opensTag) {
      (out ??= []).push(html.slice(last, i), " ");
      last = i + 1;
    }
    i = nextLt;
  }

  if (!out) return html;
  out.push(html.slice(last));
  return out.join("");
}

const TITLE_OPEN = /<title\b[^>]*>/i;

/**
 * Text of the first <title> element, whitespace-collapsed. A single forward
 * search for the closing tag, instead of a lazy regex that rescans to the end of
 * the document for every unclosed <title> in the page.
 */
export function extractTitle(html: string): string {
  const open = TITLE_OPEN.exec(html);
  if (!open) return "";
  const start = open.index + open[0].length;

  const close = /<\/title/gi;
  close.lastIndex = start;
  const m = close.exec(html);
  if (!m) return "";

  return html.slice(start, m.index).replace(/\s+/g, " ").trim();
}
