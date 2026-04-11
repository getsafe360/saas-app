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
    "- seoGeo: reference canonical, structured data presence (Schema.org presence only), meta description, and heading structure.",
    "- seoGeo must explicitly include readiness for Generative Engine Optimization (GEO), including AI Overview (AIO) visibility and machine-readable content structure.",
    "- seoGeo must connect findings to both search ranking potential and AI-driven discovery (such as AI Overviews, assistants, and LLM-based results).",
    "- When structured data is present, frame it as a positive signal for search engines and AI systems.",
    "- When structured data is missing or weak, frame it as a limitation for both ranking visibility and AI visibility.",
    "- Do not claim full schema validation beyond presence unless the facts explicitly support it.",
    "- accessibility: reference alt text, ARIA, contrast, and keyboard navigation; connect findings to usability, inclusivity, and compliance.",
    "- performance: reference fetch time, HTML size, and render-blocking or inline-script signals; connect findings to speed, rendering efficiency, and user retention.",
    "- security: reference missing security headers and WordPress-related exposure when relevant; connect findings to trust, exploit resistance, and platform resilience.",
    "- content: reference title, description quality, word count, and internal links; connect findings to clarity, engagement, authority, and conversion.",

    "DATA USAGE RULES:",
    "- When PageSpeed scores are present, cite them explicitly.",
    "- When WordPress markers are present, mention update and security implications.",
    "- Use only facts provided; do not hallucinate.",
    "- Do not invent metrics, scores, vulnerabilities, or compliance failures that are not supported by the facts.",

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
