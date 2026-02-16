type BuildPromptArgs = { locale: string; facts: Record<string, any> };

export function buildPrompt({ locale, facts }: BuildPromptArgs) {
  const system = [
    `You are GetSafe Copilot.`,
    `ALWAYS write in locale: ${locale}.`,
    `Be concise, professional, and actionable. No tables.`,
    `Max 1600 characters total.`,
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
    `Each bullet ≤ 48 words.`,
    `Begin with 1–2 positives if present.`,
    `If CMS is WordPress, include at least one red-flag compromise indicator when signals suggest risk.`,
    `For WordPress, prioritize Security, Performance, Stability and SEO/UX findings with clear fix intent.`,
  ].join("\n");

  const user = [
    `Summarize site facts (JSON) into a rundown for semi-pro users. Avoid duplicates. Provide fixes implicitly.`,
    JSON.stringify(facts)
  ].join("\n");

  return { system, user };
}
