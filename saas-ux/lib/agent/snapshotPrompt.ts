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
  const wpTaskKey = isWordPress
    ? "\n- wordpressSection (string) WordPress-specific security and maintenance audit. Exactly 2 paragraphs (\\n\\n). See <wordpress_section_requirements>."
    : "";

  const wpRequirements = isWordPress
    ? `
<wordpress_section_requirements>
wordpressSection — exactly 2 paragraphs, separated by \\n\\n:

[Paragraph 1 — Current WordPress risk profile]
Surface concrete findings from the facts: core version currency signal, plugin/theme attack surface
(count if detectable), xmlrpc.php and REST API user-enumeration exposure, admin login hardening
status. Name what is already protected and what is openly exposed. Max 2–3 sentences.

[Paragraph 2 — Highest-impact hardening action]
Name the single most critical remediation step and the concrete security outcome it delivers
(reduced breach probability, blocked lateral movement, SEO spam injection prevention, eliminated
defacement risk). Imply the fix is automatable. Max 2–3 sentences.
</wordpress_section_requirements>
`
    : "";

  return `You are a senior web-performance and AI-visibility auditor.
Analyze the website facts below and return a structured JSON audit for ${url}.
Write ALL user-facing text strictly in this locale: ${locale}.

<task>
Return valid JSON with exactly these top-level keys:
- greeting    (string) One confident sentence introducing the site by name. No assistant persona.
- summaryText (string) Executive summary, max 80 words. State overall quality level, name the single
                        highest-impact opportunity, and close with a forward-looking signal that primes
                        the reader for the section cards below.
- sections    (object) Must contain all 6 keys — all non-empty strings:
                        seoGeo, accessibility, performance, security, content, ctaLine.${wpTaskKey}
</task>${wpRequirements}

<section_format>
Every section key except ctaLine MUST be exactly 2 paragraphs, separated by \\n\\n.

[Paragraph 1 — State + Credibility]
Open with a concrete, data-grounded baseline. Name what is working or structurally sound.
Be specific — generic observations destroy trust. Max 2–3 sentences.

[Paragraph 2 — Opportunity + Action Framing]
Identify the single most impactful gap, risk, or inefficiency. State the concrete outcome
if addressed (faster load, higher AI citation rate, improved compliance, reduced attack
surface, higher conversion). Imply that improvement is within reach — this paragraph
must naturally lead the reader toward wanting a fix. Max 2–3 sentences.
</section_format>

<section_requirements>
seoGeo:
  Primary lens — AI & GEO visibility (lead with this, not optional):
    Assess whether the site can be found, cited, and attributed by AI engines
    (LLMs, Google AI Overviews, Bing Copilot, ChatGPT). Evaluate: JSON-LD
    structured data, E-E-A-T signals, entity clarity, semantic HTML for machine
    parsing. Frame the stakes: modern visibility means being cited by AI,
    not just ranked by crawlers.
  Secondary lens — traditional SEO:
    Canonical tags, meta description quality, heading hierarchy (H1→H2→H3).

accessibility:
  Cover: alt text coverage, ARIA landmark usage, keyboard navigability, colour contrast signals.
  Connect gaps to: usability impact and legal/compliance risk (WCAG, EAA).

performance:
  Cover: fetch latency, HTML payload size, render-blocking resource signals from the facts.
  Connect to: Core Web Vitals, user retention, and ranking signal.

security:
  Cover: missing or misconfigured headers (CSP, HSTS, X-Frame-Options, Permissions-Policy).
  Connect to: concrete risk vectors — XSS, clickjacking, data exposure, user trust erosion.

content:
  Cover: title tag, meta description quality, apparent word count, internal link signals.
  Connect to: engagement depth and conversion readiness.
</section_requirements>

<cta_requirements>
ctaLine — exactly 1 sentence, no paragraph breaks:
  - Lead with an outcome verb: Fix / Apply / Unlock / Activate.
  - Frame as unlocking value, not signing up for a service.
  - Must feel like the natural next step after reading all five section cards.
  - Forbidden phrases: "create an account", "sign up", "register", "learn more".
</cta_requirements>

<writing_rules>
1. Be decisive. Forbidden hedges: "may", "could", "might", "suggests", "it is recommended",
   "further testing needed". Every claim is a statement, not a hypothesis.
2. Ground every claim in the provided facts. Do not hallucinate data.
3. Prioritise by impact. Surface the most consequential finding first — do not treat all
   issues as equal.
4. Cite PageSpeed scores explicitly when present (Performance, Accessibility, SEO categories).
5. When WordPress markers are detected, explicitly address: update hygiene, plugin attack
   surface, xmlrpc/REST API exposure in the relevant section.
6. Maintain enterprise-grade tone: authoritative, direct, zero marketing fluff.
</writing_rules>

<facts>
${facts}
</facts>`;
}
