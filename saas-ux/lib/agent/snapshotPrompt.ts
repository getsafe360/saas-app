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

    "Return STRICT JSON only.",
    "Do not wrap in markdown fences.",
    "Do not add commentary before or after the JSON.",
    "Do not include extra keys.",
    "Use exactly this shape:",

    "greeting (string) — confident 1-sentence intro mentioning the site name or domain; no assistant persona.",
    "summaryText (string) — MUST be formatted as EXACTLY TWO SHORT PARAGRAPHS separated by a newline (\\n).",
    "  Paragraph 1 (trust anchor): exactly 1 sentence describing the site's overall technical baseline, quality, or credibility.",
    "  Paragraph 2 (tension + action): 1–2 sentences highlighting the most important gaps, why they matter, and the benefit of fixing them.",
    "  Paragraph 2 must clearly imply that improvements are actionable and valuable, leading naturally into the CTA.",
    "  Maximum 90 words total across both paragraphs.",
    "  Do NOT merge into one block.",

    "sections (object) — MUST contain exactly these 6 non-empty string keys:",
    "  seoGeo, accessibility, performance, security, content, ctaLine.",

    "SECTION WRITING RULES (CRITICAL):",
    "- Each non-CTA section must be 2–3 sentences, high-signal, concise, and free of fluff.",
    "- Use this structure strictly:",
    "  1. Start with a positive or baseline observation to build trust.",
    "  2. Identify a specific gap, inefficiency, or risk using concrete facts.",
    "  3. End with a clear outcome or benefit if improved (performance, ranking, UX, security, conversion, trust, or visibility).",
    "- Avoid generic phrasing like 'further testing is needed'.",
    "- Avoid hedging words such as 'may', 'could', 'might', and 'suggests'. Use decisive wording.",
    "- Focus on impact, not neutral description.",
    "- Implicitly prioritize what matters most rather than presenting all issues equally.",
    "- Keep the tone professional, concise, and authoritative, like an enterprise-grade audit.",
    "- Use only the provided facts. Do not hallucinate or infer unsupported technical details.",

    "CATEGORY-SPECIFIC REQUIREMENTS:",
    "- seoGeo: reference canonical, structured data (Schema.org presence), meta description, and heading structure; connect to ranking potential and GEO/AIO readiness for AI-driven discovery (AI Overviews, LLM assistants).",
    "- accessibility: reference alt text, ARIA usage, contrast, and keyboard navigation; connect to usability, inclusivity, and compliance.",
    "- performance: reference fetch time, HTML size, and inline-script signals; connect to speed, rendering efficiency, and user retention.",
    "- security: reference present or missing security headers and WordPress-related exposure where relevant; connect to trust and exploit resistance.",
    "- content: reference title, description quality, word count, and internal links; connect to clarity, engagement, authority, and conversion.",
    "CRITICAL: Every section MUST contain a non-empty, meaningful response. If specific metrics are unavailable, write a constructive observation based on the signals that are present.",

    "DATA USAGE RULES:",
    "- When PageSpeed scores are present, cite them explicitly.",
    "- When WordPress markers are present, mention update and security implications.",
    "- Base your writing on the provided facts. When a specific metric is absent, make a professional inference from the signals you do have rather than leaving a section empty.",

    "CTA REQUIREMENTS (HIGH PRIORITY):",
    "- ctaLine must be exactly 1 sentence.",
    "- ctaLine must feel like unlocking value, not signing up.",
    "- Emphasize outcomes such as fixing issues, unlocking the full report, prioritizing actions, or applying optimizations instantly.",
    "- Keep it concise, confident, and action-oriented.",
    "- Do NOT use generic phrases like 'create an account to continue'.",

    "LANGUAGE RULES:",
    "- Write ALL user-facing text strictly in the target locale language.",
    "- Never switch to the analyzed site's language unless it matches the target locale.",

    `Facts JSON: ${facts}`,
  ].join("\n");
}
