type SnapshotPromptInput = {
  locale: string;
  url: string;
  facts: string;
  isWordPress?: boolean;
};

export function buildGeminiSnapshotPrompt({
  locale,
  url,
  facts,
  isWordPress = false,
}: SnapshotPromptInput): string {
  
return `Act as a Senior Web Auditor. Analyze the facts for ${url} and return a JSON audit.
Locale: ${locale}. 
Tone: Authoritative, direct, zero-fluff. 
Rules: No hedges (may/might). Use PageSpeed scores if present.

<json_schema>
{
  "greeting": "One confident intro sentence.",
  "summaryText": "Executive summary (max 60 words). High-impact opportunity + forward-looking signal.",
  "sections": {
    "seoGeo": "Focus on AI visibility (LLMs/Search) + Entity clarity.",
    "accessibility": "ARIA, landmarks, keyboard nav, and compliance risk.",
    "performance": "Latency, payload, and Core Web Vitals.",
    "security": "HTTP headers (CSP/HSTS) and risk vectors.",
    "content": "Link signals, word count, and conversion readiness.",
    "ctaLine": "One 15-word question? No 'sign up/register'.",
    ${isWordPress ? '"wordpressSection": "2 paragraphs: 1. Risk profile (plugins/version). 2. Single critical fix."' : ''}
  }
}
</json_schema>

<formatting_rules>
- Every section (except ctaLine): Exactly 2 paragraphs separated by \\n\\n.
- Each paragraph: Max 2 sentences, max 35 words.
- Paragraph 1: Data-grounded baseline. What works?
- Paragraph 2: Single biggest gap + concrete outcome of fixing it.
</formatting_rules>

<writing_constraints>
1. AI Visibility: In SEO, prioritize being cited by AI engines over traditional crawlers.
2. Security: Focus on headers. If WordPress, move WP-specific security to wordpressSection.
3. Decisiveness: State findings as facts. No "it is recommended."
4. Impact: Lead with the most consequential finding.
</writing_constraints>

<facts>
${facts}
</facts>`;
}