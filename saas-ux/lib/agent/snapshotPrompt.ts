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
    "Return strict JSON with fields:",
    "greeting (string)",
    "summaryText (string)",
    "sections object with keys: seoGeo, accessibility, performance, security, content, ctaLine",
    "terminalLogs array of objects with: level(INFO|SUCCESS|WARNING|METRIC|ERROR), stage, text",
    "Rules:",
    "- terminalLogs must be concise developer terminal messages.",
    "- Include at least 1 METRIC log with concrete value.",
    "- SEO/GEO section must never be empty.",
    "- When PageSpeed scores are present, cite them explicitly in performance/accessibility/SEO sections.",
    "- Highlight missing security headers or weak transport defaults when detected.",
    "- Mention WordPress risk/automation if WP markers are present.",
    "- Keep summary under 180 words.",
    `Facts JSON: ${facts}`,
  ].join("\n");
}
