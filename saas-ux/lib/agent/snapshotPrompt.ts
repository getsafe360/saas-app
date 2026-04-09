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
    "  greeting (string) — warm 1-sentence intro from Sparky mentioning the site name.",
    "  summaryText (string) — 2-4 sentence executive summary, max 120 words.",
    "  sections (object) — MUST contain all 6 keys with non-empty strings:",
    "    seoGeo, accessibility, performance, security, content, ctaLine.",
    "    Each value: 1-2 concise sentences. Never leave a key empty or null.",
    "Rules:",
    "- Write every user-facing string strictly in the target locale language.",
    "- Never switch to the tested site's language unless it matches the target locale.",
    "- seoGeo: cite canonical, structured data, meta description, heading structure.",
    "- accessibility: cite ARIA, alt text, contrast, keyboard navigation.",
    "- performance: cite fetch time, HTML size, render-blocking signals.",
    "- security: cite missing security headers detected in facts.",
    "- content: cite title, description quality, word count, internal links.",
    "- ctaLine: a short friendly call-to-action encouraging a free account sign-up.",
    "- When PageSpeed scores are present, cite them explicitly.",
    "- Mention WordPress risk if WP markers are present in facts.",
    `Facts JSON: ${facts}`,
  ].join("\n");
}
