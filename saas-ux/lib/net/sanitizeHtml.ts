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
// The slow behaviour needs many "<" that are NOT real tag starts (inside quoted
// attribute values, comments, script bodies, or an unterminated tag) but that
// the regexes still treat as tag starts. balanceTags() walks the document once,
// like a browser tokenizer, and rewrites every such "<" to a look-alike
// character (FULLWIDTH_LT) that no tag pattern matches. Real tags are untouched.
// Use restoreLt() on text you extract so that e.g. "Prices < $50" reads normally.

/** U+FF1C '＜': looks like '<', is not a letter/digit (word counts unaffected). */
export const FULLWIDTH_LT = "＜";

/** Undo the look-alike substitution on extracted text. */
export function restoreLt(text: string): string {
  return text.split(FULLWIDTH_LT).join("<");
}

const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

const neutralise = (s: string) => s.split("<").join(FULLWIDTH_LT);

// Elements whose content is raw text (the browser does not parse tags inside).
// Each gets a precompiled closing-tag search (case-insensitive, literal).
const RAW_TEXT: Record<string, RegExp> = {
  script: /<\/script/gi,
  style: /<\/style/gi,
  textarea: /<\/textarea/gi,
  title: /<\/title/gi,
};

/**
 * One O(n) pass. Output differs from the input only in that "<" characters which
 * do not open a real tag are replaced by FULLWIDTH_LT. Returns the input string
 * itself when nothing needs rewriting.
 */
export function balanceTags(html: string): string {
  const n = html.length;
  const out: string[] = [];
  let changed = false;
  let i = 0;

  /** Everything from `from` to the end is text: neutralise it and stop. */
  const finishAsText = (from: number) => {
    out.push(neutralise(html.slice(from)));
    changed = true;
    i = n;
  };

  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    if (lt > i) out.push(html.slice(i, lt)); // plain text before the "<"

    const c1 = html.charCodeAt(lt + 1);

    // ---- start tag: <name ...> ------------------------------------------------
    if (isLetter(c1)) {
      let p = lt + 1;
      // The tag ends at the first ">" that is outside a quoted attribute value.
      let end = -1;
      while (p < n) {
        const ch = html.charCodeAt(p);
        if (ch === 62) {
          end = p;
          break;
        }
        if (ch === 61) {
          // "=": a value may follow; only a quote right after it delimits a value
          let q = p + 1;
          while (q < n && html.charCodeAt(q) <= 32) q++;
          const qc = html.charCodeAt(q);
          if (qc === 34 || qc === 39) {
            const close = html.indexOf(qc === 34 ? '"' : "'", q + 1);
            if (close === -1) break; // unterminated quote: the tag never ends
            p = close + 1;
            continue;
          }
          p = q;
          continue;
        }
        p++;
      }

      if (end === -1) {
        // Unterminated tag (a browser would drop it): the rest is text.
        out.push(FULLWIDTH_LT);
        changed = true;
        finishAsText(lt + 1);
        break;
      }

      // Any further "<" inside a terminated tag sits in a quoted value or is
      // stray: neutralise it, keeping the opening "<".
      const inner = html.slice(lt + 1, end + 1);
      if (inner.indexOf("<") !== -1) {
        out.push("<", neutralise(inner));
        changed = true;
      } else {
        out.push("<", inner);
      }
      i = end + 1;

      // Raw-text elements: their body is text up to the matching close tag.
      let nameEnd = lt + 1;
      while (nameEnd < end && nameEnd - lt < 12 && /[A-Za-z0-9]/.test(html[nameEnd])) nameEnd++;
      const raw = RAW_TEXT[html.slice(lt + 1, nameEnd).toLowerCase()];
      if (raw) {
        raw.lastIndex = i;
        const m = raw.exec(html);
        const bodyEnd = m ? m.index : n;
        const body = html.slice(i, bodyEnd);
        if (body.indexOf("<") !== -1) {
          out.push(neutralise(body));
          changed = true;
        } else {
          out.push(body);
        }
        i = bodyEnd;
      }
      continue;
    }

    // ---- end tag: </name> -----------------------------------------------------
    if (c1 === 47 && isLetter(html.charCodeAt(lt + 2))) {
      const gt = html.indexOf(">", lt + 2);
      if (gt === -1) {
        out.push(FULLWIDTH_LT);
        changed = true;
        finishAsText(lt + 1);
        break;
      }
      out.push(html.slice(lt, gt + 1));
      i = gt + 1;
      continue;
    }

    // ---- comment / doctype / CDATA / processing instruction -------------------
    if (c1 === 33 || c1 === 63) {
      const isComment = html.startsWith("<!--", lt);
      const closer = isComment ? "-->" : ">";
      const bodyStart = isComment ? lt + 4 : lt + 2;
      const close = html.indexOf(closer, bodyStart);
      if (close === -1) {
        out.push(FULLWIDTH_LT);
        changed = true;
        finishAsText(lt + 1);
        break;
      }
      const body = html.slice(bodyStart, close);
      out.push(html.slice(lt, bodyStart), body.indexOf("<") !== -1 ? neutralise(body) : body, closer);
      if (body.indexOf("<") !== -1) changed = true;
      i = close + closer.length;
      continue;
    }

    // ---- a "<" that is just text (e.g. "a < b", "5<6") ------------------------
    out.push(FULLWIDTH_LT);
    changed = true;
    i = lt + 1;
  }

  return changed ? out.join("") : html;
}

const TITLE_OPEN = /<title\b[^>]*>/i;

/**
 * Text of the first <title> element, whitespace-collapsed. A single forward
 * search for the closing tag, instead of a lazy regex that rescans to the end of
 * the document for every unclosed <title>.
 */
export function extractTitle(html: string): string {
  const open = TITLE_OPEN.exec(html);
  if (!open) return "";
  const start = open.index + open[0].length;

  const close = /<\/title/gi;
  close.lastIndex = start;
  const m = close.exec(html);
  if (!m) return "";

  return restoreLt(html.slice(start, m.index)).replace(/\s+/g, " ").trim();
}
