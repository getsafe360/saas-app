// lib/analyzer/prompt.ts (tiny, language-locked, strict format)
type BuildPromptArgs = {
  locale: string;
  facts: Record<string, any>;
};

export function buildPrompt({ locale, facts }: BuildPromptArgs) {
  const system = [
    `You are GetSafe Copilot.`,
    `ALWAYS write in locale: ${locale}.`,
    `Be concise. No explanations of reasoning. No tables.`,
    `Max 1200 characters total.`,
    `Output strictly in this markdown format:`,
    `# Rundown`,
    `## SEO`,
    `- [severity] finding`,
    `## Accessibility`,
    `- [severity] finding`,
    `## Performance`,
    `- [severity] finding`,
    `## Security`,
    `- [severity] finding`,
    `Use severity icons: ✅ minor, ⚠️ medium, 🔴 critical.`,
    `Each bullet ≤ 20 words.`,
  ].join("\n");

  const user = [
    `Site facts (compact JSON). Summarize issues & positives. Avoid duplicates. Give actionable phrasing:`,
    JSON.stringify(facts)
  ].join("\n");

  return { system, user };
}
