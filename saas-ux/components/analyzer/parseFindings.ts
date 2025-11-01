// saas-ux/components/analyzer/parseFindings.ts
export type Pillar = "seo" | "a11y" | "perf" | "sec";
export type Severity = "minor" | "medium" | "critical";

export type Finding = {
  id: string;
  pillar: Pillar;
  severity: Severity;
  text: string;
};

const PILLAR_HEADERS: Record<string, Pillar> = {
  "## seo": "seo",
  "## accessibility": "a11y",
  "## performance": "perf",
  "## security": "sec",
};

export function parseFindings(md: string): Finding[] {
  const lines = md.split(/\r?\n/);
  let pillar: Pillar | null = null;
  const out: Finding[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    const key = line.toLowerCase();
    if (PILLAR_HEADERS[key as keyof typeof PILLAR_HEADERS]) {
      pillar = PILLAR_HEADERS[key as keyof typeof PILLAR_HEADERS];
      continue;
    }
    if (pillar && /^-\s+/.test(line)) {
      // severities inferred by icon or keyword
      let sev: Severity = "medium";
      if (line.includes("🔴")) sev = "critical";
      else if (line.includes("✅")) sev = "minor";
      else if (line.includes("⚠️")) sev = "medium";

      // strip icon + "- "
      const txt = line.replace(/^-\s+(\[.*?\]\s*)?/, "").replace(/[✅⚠️🔴]\s*/g, "").trim();
      const trimmed = enforceWordLimit(txt, 48); // adjust to 64 if you prefer

      out.push({
        id: simpleHash(`${pillar}|${sev}|${trimmed}`),
        pillar,
        severity: sev,
        text: trimmed,
      });
    }
  }
  return out;
}

function enforceWordLimit(s: string, maxWords: number) {
  const parts = s.split(/\s+/);
  if (parts.length <= maxWords) return s;
  return parts.slice(0, maxWords).join(" ") + "…";
}

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
