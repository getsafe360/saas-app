type SnapshotPromptInput = {
  locale: string;
  url: string;
  facts: string;
};

export function buildGeminiSnapshotPrompt({
  locale,
  url,
  facts,
}: SnapshotPromptInput): string {
  return [
    `Target locale: ${locale}`,
    `Analyze website snapshot facts for ${url}.`,

    "Return strict JSON with exactly these fields:",
    "  greeting (string) — confident 1-sentence intro mentioning the site name (no assistant persona).",
    "  summaryText (string) — 2-3 sentence executive summary highlighting overall quality + key opportunities (max 90 words).",
    "  sections (object) — MUST contain all 6 keys with non-empty strings:",
    "    seoGeo, accessibility, performance, security, content, ctaLine.",

    "SECTION WRITING RULES (CRITICAL):",
    "- Each section must be 2–3 sentences, high-signal, no fluff.",
    "- Use this structure strictly:",
    "  1. Start with a positive or baseline observation (build trust)",
    "  2. Identify a specific gap, inefficiency, or risk (be concrete, not vague)",
    "  3. End with a clear outcome or benefit if improved (performance, ranking, UX, security, conversion)",
    "- Avoid generic phrasing like 'further testing is needed'.",
    "- Avoid hedging words: 'may', 'could', 'might', 'suggests'. Be decisive.",
    "- Focus on impact, not description.",
    "- Implicitly prioritize: highlight what matters most without listing everything equally.",
    "- Keep tone professional, concise, and authoritative (enterprise-grade audit style).",

    "CATEGORY-SPECIFIC REQUIREMENTS:",
    "- seoGeo: reference canonical, structured data, meta description, heading structure; connect to ranking and visibility.",
    "- accessibility: reference alt text, ARIA, contrast, keyboard navigation; connect to usability and compliance.",
    "- performance: reference fetch time, HTML size, render-blocking signals; connect to speed and user retention.",
    "- security: reference missing security headers; connect to risk exposure and trust.",
    "- content: reference title, description, word count, internal links; connect to engagement and conversion.",

    "DATA USAGE RULES:",
    "- When PageSpeed scores are present, include them explicitly.",
    "- When WordPress markers are present, mention update/security implications.",
    "- Use only facts provided; do not hallucinate.",

    "CTA REQUIREMENTS (HIGH PRIORITY):",
    "- ctaLine must feel like unlocking value, not signing up.",
    "- Emphasize outcomes: 'fix issues', 'unlock full report', 'apply optimizations instantly'.",
    "- Keep it concise, confident, and action-oriented (1 sentence).",
    "- Do NOT use generic phrases like 'create an account to continue'.",

    "LANGUAGE RULES:",
    "- Write ALL user-facing text strictly in the target locale language.",
    "- Never switch to the analyzed site's language unless it matches the target locale.",

    `Facts JSON: ${facts}`,
  ].join("\n");
}
