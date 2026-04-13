# Strategy: Premium AI Model Integration
**Branch:** `claude/add-thinking-level-gemini-2kKMs`
**Created:** 2026-04-13
**Status:** Ready to implement on next session

---

## Context

Two parallel tracks to implement:

1. **Gemini 3 Flash — `thinking_level` migration** (nearly done, branch name reflects this)
2. **Claude Opus 4.6 — BSB premium tier** (new, planned below)

---

## Track 1 — Gemini 3 Flash: Replace `thinking_budget` → `thinking_level`

### What changed (Google release notes)

> Gemini 3 models replace the `thinking_budget` integer with a `thinking_level`
> enum: `"minimal" | "low" | "medium" | "high"`.
> The parameter controls internal CoT depth, balancing quality / latency / cost.

### Where to update

| File | Line | Current | Target |
|------|------|---------|--------|
| `saas-ux/app/api/agent/stream/route.ts` | ~860 | `thinkingConfig: { thinkingBudget: 4096 }` | `thinkingConfig: { thinkingLevel: "medium" }` |
| `Sparky-Quick-Snapshot/server.ts` | ~113 | any `thinking_budget` usage | `thinkingLevel: "low"` (fast snapshot) |

### Recommended `thinking_level` per use case

| Use case | Level | Rationale |
|----------|-------|-----------|
| Quick snapshot (`/api/agent/stream`) | `"medium"` | Balance depth vs. 16 k token budget |
| Sparky quick scan | `"low"` | Speed matters, simple extraction |
| Deep audit (future) | `"high"` | Full reasoning for BSB tier |

### Implementation steps

```ts
// saas-ux/app/api/agent/stream/route.ts  (~line 860)
// BEFORE:
generationConfig: {
  temperature: 0.15,
  maxOutputTokens: 16000,
  thinkingConfig: { thinkingBudget: 4096 },
}

// AFTER:
generationConfig: {
  temperature: 0.15,
  maxOutputTokens: 16000,
  thinkingConfig: { thinkingLevel: "medium" },
}
```

---

## Track 2 — Claude Opus 4.6: BSB Premium AI Tier

### Model selection rationale

**Chosen model: `claude-opus-4-6`**

For sophisticated BSB (Business/Scale/Brand) customers the platform must deliver
enterprise-grade results, not cost-optimised shortcuts. Claude Opus 4.6 is the
most capable model in the Anthropic family and excels at every required task:

| Required capability | Why Opus 4.6 |
|--------------------|--------------|
| Thorough diagnosis per category (SEO, perf, security, a11y) | Extended reasoning, large context window, structured JSON output |
| Applying fixes directly to website code | Best-in-class code generation, diff-aware edits |
| WordPress expertise | Deep PHP/Gutenberg/WooCommerce reasoning from training |
| SEO/GEO text rewriting + schema creation | Superior prose quality + JSON-LD schema generation |
| Visual redesign — template creation | Strong HTML/CSS/Tailwind template synthesis |

### Architecture: model-tier routing

```
Request → Plan tier check
           ├── Free / Pro  →  Gemini 3 Flash (thinking_level: low/medium)
           └── BSB         →  Claude Opus 4.6 (extended thinking ON)
```

The Vercel AI SDK (`ai` v5 beta) already used in the project supports Anthropic
natively via `@ai-sdk/anthropic`. No new streaming infrastructure needed.

### Package to add

```bash
pnpm --filter saas-ux add @ai-sdk/anthropic
```

### New environment variable

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Add to: `.env.local`, Vercel project env (production + preview), and document
in `CLAUDE-tech.md`.

### Implementation plan (file-by-file)

#### Step 1 — Model registry (`saas-ux/lib/ai/models.ts`) — NEW FILE

Create a single source-of-truth for model selection so no endpoint hard-codes a
provider:

```ts
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";

export type AITier = "free" | "pro" | "agent" | "business";

export function getSnapshotModel(tier: AITier): LanguageModelV1 {
  if (tier === "business") {
    return anthropic("claude-opus-4-6");
  }
  return google(process.env.GEMINI_SNAPSHOT_MODEL ?? "gemini-3-flash-preview");
}

export function getAnalysisModel(tier: AITier): LanguageModelV1 {
  if (tier === "business") {
    return anthropic("claude-opus-4-6");
  }
  return openai("gpt-4o-mini");
}
```

#### Step 2 — Update `/api/agent/stream/route.ts`

Replace hardcoded Gemini direct-fetch with AI SDK's `streamText` so both
providers share the same streaming path:

```ts
// Import model registry
import { getSnapshotModel } from "@/lib/ai/models";

// Derive tier from Clerk session / subscription record
const tier = await getUserTier(userId); // existing helper

const result = streamText({
  model: getSnapshotModel(tier),
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }],
  // For Gemini tiers — pass thinkingLevel via providerOptions
  providerOptions: tier !== "business" ? {
    google: { thinkingConfig: { thinkingLevel: "medium" } },
  } : {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 10000 },
    },
  },
  temperature: 0.15,
  maxTokens: 16000,
});
```

#### Step 3 — CrewAI backend (`crewai_backend/config/models.yaml`)

Add Claude Opus entry so the Python agents can also use it for deep audit jobs:

```yaml
models:
  gpt_5_mini:
    provider_model: openai/gpt-5-mini
    temperature: 0
    max_iter: 1
    timeout_seconds: 60
    retry_limit: 2

  claude_opus:                          # NEW
    provider_model: anthropic/claude-opus-4-6
    temperature: 0
    max_iter: 2
    timeout_seconds: 120               # longer for extended thinking
    retry_limit: 2

default_model: gpt_5_mini
premium_model: claude_opus             # referenced by BSB job dispatcher
```

Add `ANTHROPIC_API_KEY` to `crewai_backend/.env`.

#### Step 4 — BSB agent prompts

Each existing agent in `crewai_backend/config/agents.yaml` gets a `bsb_goal`
field (string) used when `premium_model` is active. This lets the agents behave
more like senior consultants:

- **seo_agent** — full schema rewrite (Article, Product, FAQ, HowTo, LocalBusiness),
  GEO paragraph restructuring, canonical & hreflang audit
- **wordpress_auditor** — plugin conflict detection, theme template override
  suggestions, WooCommerce structured data fix, child theme patch generation
- **content_agent** — full page copy rewrite with keyword density + readability
  score targets
- **performance_agent** — generates optimised `.htaccess` / Nginx snippets,
  critical CSS extraction, image conversion scripts
- **accessibility_repair_specialist** — generates patched HTML templates, not
  just issue lists

#### Step 5 — Token / cost accounting

Update `saas-ux/lib/plans/config.ts`:

```ts
// BSB tier consumes more tokens per fix due to Opus pricing
business: {
  tokensPerFix: 8000,    // was 2000
  provider: "anthropic",
  model: "claude-opus-4-6",
}
```

Update the `aiRepairActions` schema to store `provider` + `model_id` columns for
billing transparency.

### UI changes (minimal, deferred)

- Add a "Powered by Claude Opus" badge on BSB analysis results
- Show `thinking_level` selector for Gemini tiers (low / medium / high) in
  Settings → Analysis preferences (free users locked to low)

---

## Task checklist for next session

- [ ] **T1** Update `thinkingBudget` → `thinkingLevel: "medium"` in `stream/route.ts`
- [ ] **T2** Update same in `Sparky-Quick-Snapshot/server.ts` (`"low"`)
- [ ] **T3** `pnpm --filter saas-ux add @ai-sdk/anthropic`
- [ ] **T4** Create `saas-ux/lib/ai/models.ts` model registry
- [ ] **T5** Refactor `stream/route.ts` to use AI SDK + model registry
- [ ] **T6** Add `claude_opus` entry to `crewai_backend/config/models.yaml`
- [ ] **T7** Add `ANTHROPIC_API_KEY` to all env targets
- [ ] **T8** Extend `agents.yaml` with `bsb_goal` prompts per agent
- [ ] **T9** Update `plans/config.ts` token costs for BSB tier
- [ ] **T10** Add `provider` + `model_id` columns to `aiRepairActions` schema

### Order of operations

T1 → T2 (quick wins, unblock branch) → T3 → T4 → T5 (core SDK work) →
T6 → T7 → T8 (backend) → T9 → T10 (accounting)

---

## Open questions to resolve

1. **Extended thinking for Anthropic**: enable `thinking: { type: "enabled", budgetTokens: 10000 }` for all BSB requests or only for deep-audit jobs? Start with deep-audit only to control costs.
2. **Fallback**: if Opus is unavailable (rate limit), fall back to `claude-sonnet-4-6` or Gemini `"high"`?
3. **BSB tier definition**: confirm whether "BSB" maps to the existing `"business"` plan key in `plans/config.ts` or needs a new tier.
4. **WordPress fix application**: direct SSH/SFTP or via plugin API? This determines how deep agent code output can be applied.
