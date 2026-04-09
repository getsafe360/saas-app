# GetSafe360 — Claude Code Handoff
> Generated from a prior Claude chat session. This document gives you full context
> so you can dive straight into the repo without the developer repeating anything.

---

## Project Overview

**Product:** GetSafe360 (`getsafe360.ai`) — enterprise-level website optimisation SaaS for SMEs.  
**Stack:** Next.js (frontend, deployed on Vercel) + Flask (backend, `crew_backend/app.py`) + CrewAI.  
**Active task:** Replace the homepage `InstantTestCard` with the more advanced `DirectAgentStreamCard`
that streams a categorised site-snapshot result in real time, acting as a teaser/funnel for new users
with a CTA to create an account.

---

## Repository Layout (inferred — verify on first read)

```
/
├── app/                          # Next.js app router
│   └── page.tsx                  # Homepage — mounts InstantTestCard / DirectAgentStreamCard
├── components/
│   └── homepage/
│       ├── InstantTestCard.tsx   # Current card (to be replaced)
│       └── DirectAgentStreamCard.tsx  # Target card (currently returns no signal)
├── lib/
│   ├── cockpit/
│   │   └── sse-events.ts         # CockpitEvent types + mapBackendEvent()
│   └── homepage/
│       ├── homepage-test-core.ts # State reducer, terminal event logic, phase constants
│       ├── useHomepageTest.ts    # Main SSE hook
│       └── test-service-config.ts
├── api/
│   └── test/
│       ├── start/route.ts        # POST — starts a job, returns test_id
│       ├── events/[testId]/route.ts  # GET — Next.js SSE bridge to Flask
│       └── results/[testId]/route.ts # GET — fetches final result from Flask
└── crew_backend/
    ├── app.py                    # Flask app (full file reviewed in chat)
    ├── crew.py                   # CrewService — run_sparky_pipeline(), sparky_summary(), etc.
    └── Sparky-Quick-Snapshot/    # Gemini test routine with data-driven category loop (NOT YET READ)
```

---

## Confirmed Bugs Fixed in Prior Chat Session

These were fully diagnosed and the fixes agreed. **Verify they are applied in the repo.**

### Bug 1 — `summary` event closes EventSource too early
**File:** `lib/homepage/homepage-test-core.ts`  
**Function:** `isTerminalEvent()`

```ts
// BEFORE (wrong — closes stream before status:completed arrives):
function isTerminalEvent(event: CockpitEvent): boolean {
  return (
    event.type === 'summary'
    || (event.type === 'status' && Boolean(event.state && TERMINAL_STATES.has(event.state)))
  );
}

// AFTER (correct — only close on status:completed):
function isTerminalEvent(event: CockpitEvent): boolean {
  return (
    event.type === 'status' && Boolean(event.state && TERMINAL_STATES.has(event.state))
  );
}
```

**Why:** Flask emits `summary` then `status:completed` sequentially. Treating `summary` as terminal
closes the EventSource before `status:completed` arrives, causing a race on the results fetch.

---

### Bug 2 — `debug/stream ended` triggers premature results fallback
**File:** `lib/homepage/useHomepageTest.ts`

```ts
// REMOVE this block entirely:
if (!sawTerminalEvent && parsed.type === 'debug' && parsed.message?.toLowerCase().includes('stream ended')) {
  void runResultsFallback(testId);
}
```

**Why:** The Next.js SSE bridge emits `{ type: 'debug', message: 'Backend stream ended' }` the
moment the upstream Flask stream closes. On a slow filesystem (confirmed: localhost on network drive),
this arrives before `summary` is processed, fires `runResultsFallback` while `job.status` is still
`in_progress`, gets a 404, sets `FALLBACK_PENDING_SUMMARY`, and stalls there.

---

### Bug 3 — No direct results fetch after confirmed SSE completion
**File:** `lib/homepage/useHomepageTest.ts`  
**Function:** `maybeFinishAndClose()`

```ts
// BEFORE:
const maybeFinishAndClose = (event: CockpitEvent) => {
  if (!isHomepageTerminalEvent(event)) return;
  sawTerminalEvent = true;
  closeWithCleanup();
};

// AFTER — add the results fetch on the happy path:
const maybeFinishAndClose = (event: CockpitEvent) => {
  if (!isHomepageTerminalEvent(event)) return;
  sawTerminalEvent = true;
  closeWithCleanup();
  void runResultsFallback(testId); // job is guaranteed done at this point → 200 on first attempt
};
```

**Why:** Previously there was no "SSE succeeded → fetch results" path. Everything went through the
fallback machinery. Now that `status:completed` is the only terminal trigger (Bug 1 fix), the fetch
fires at exactly the right moment.

---

### Supporting fix — `mapBackendEvent` `result` branch missing `state: 'completed'`
**File:** `lib/cockpit/sse-events.ts`

```ts
// Add state: 'completed' so result events also carry the terminal signal:
if (normalizedType === 'result') {
  return {
    type: 'summary',
    state: 'completed',   // ← add this
    message: String(payload.summary ?? payload.short_summary ?? 'Analysis complete'),
    greeting: typeof payload.greeting === 'string' ? payload.greeting : undefined,
  };
}
```

---

## Active Task — DirectAgentStreamCard

### Goal
Replace `InstantTestCard` on the homepage with `DirectAgentStreamCard`. The card must:
- Accept a URL input and stream results in real time
- Render **category cards** progressively as they arrive (accessibility, SEO, security, etc.)
- Render a **conditional WordPress card** when `platform === 'wordpress'`
- End with a **CTA** to create an account (funnel for new users)
- Feel impressively fast — categories should animate in one by one

### Current Problem
`DirectAgentStreamCard` connects to the backend but returns **no signal** — no categories appear.

### Root Cause (diagnosed, not yet fixed)
The Flask `/agent/stream` route calls `stream_sparky_analysis()` which emits only:
```python
yield to_sse("message", {"text": "Fetching HTML..."})
yield to_sse("message", {"text": "Analyzing accessibility..."})
# ... more message events
yield to_sse("summary", {"summary": summary_text, "greeting": greeting})
```

**It emits no `category` events and no `platform` detection.** The frontend event system
(`sse-events.ts`, `homepage-test-core.ts`) is fully wired to handle `category` and `platform`
events — there is just nothing emitting them from the agent stream.

### What Needs to Be Built

#### 1. Flask — enrich `stream_sparky_analysis()` in `crew_backend/app.py`
Add `category` and `platform` SSE events to the stream:

```python
def stream_sparky_analysis(url: str) -> Iterator[str]:
    yield to_sse("message", {"text": "Fetching HTML..."})
    snapshot_raw = CREW.site_snapshot_task(url)

    # Detect platform early so the frontend can render the WordPress card
    snapshot_json = CREW._extract_best_json(snapshot_raw)
    platform = snapshot_json.get("platform", "generic")  # "wordpress" | "generic"
    yield to_sse("platform", {"platform": platform})

    # Stream categories one by one so cards animate in progressively
    categories = snapshot_json.get("categories", [])
    for category in categories:
        yield to_sse("category", {
            "category": category.get("id"),
            "issues": category.get("issues", []),
            "severity": category.get("severity", "medium"),
        })

    summary_raw = CREW.sparky_summary(snapshot_raw)
    summary_json = CREW._extract_best_json(summary_raw)
    # ... rest of existing summary logic
    yield to_sse("summary", {"summary": summary_text, "greeting": greeting})
```

> **Important:** Read `Sparky-Quick-Snapshot/` first — the Gemini test routine there uses a
> data-driven loop to emit categories. Use that pattern as the reference implementation.
> It likely defines the category schema that `run_sparky_pipeline()` already returns.

#### 2. Next.js — add a `/api/agent/stream` bridge route (if it doesn't exist)
`DirectAgentStreamCard` likely connects to `/agent/stream` directly on Flask, which won't work
on Vercel (CORS, serverless). There should be a Next.js proxy route mirroring the pattern in
`api/test/events/[testId]/route.ts` but for the direct agent stream (no job ID).

Check whether this route exists. If not, create `api/agent/stream/route.ts`:

```ts
// Proxies GET /api/agent/stream?url=... → Flask /agent/stream?url=...
// Pattern is identical to api/test/events/[testId]/route.ts SSE bridge
// but simpler: no job ID, no subscriber queue, pure stream passthrough
```

#### 3. `sse-events.ts` — add `platform` event handling
```ts
// Add 'platform' to CockpitEventType if not already present
export type CockpitEventType =
  | 'status' | 'progress' | 'category' | 'repair' | 'savings'
  | 'summary' | 'greeting' | 'error' | 'debug'
  | 'platform';   // ← add if missing

// Add handler in mapBackendEvent():
if (normalizedType === 'platform') {
  return {
    type: 'platform' as CockpitEventType,
    platform: payload.platform === 'wordpress' ? 'wordpress' : 'generic',
  };
}
```

#### 4. `DirectAgentStreamCard` — verify category rendering logic
Once the backend emits categories, check:
- Is the card listening on the correct event names (`category`, `platform`)?
- Is the WordPress card conditioned on `state.platform === 'wordpress'`?
- Are category cards keyed and animated in (CSS transition on mount)?

---

## Files Still Unread — Read These First

| File | Why it matters |
|---|---|
| `Sparky-Quick-Snapshot/` (whole folder) | Contains the Gemini data-driven category loop — the reference pattern for streaming categories |
| `DirectAgentStreamCard.tsx` | The component with no signal — need to see its SSE listener and category render logic |
| `InstantTestCard.tsx` | Understand props/interface to preserve during the swap |
| `page.tsx` (homepage) | How cards are mounted; where the swap needs to happen |
| `crew.py` | Does `run_sparky_pipeline()` already return `categories` array? What is the schema? |

---

## Flask Backend — Key Facts Already Known

- **`/api/test/start`** → spawns `_run_sparky_worker()` thread, returns `test_id`
- **`/api/test/events/<test_id>`** → SSE stream with replay, heartbeat, subscriber queue
- **`/api/test/results/<test_id>`** → returns result only when `job.status == 'completed'`
- **`/agent/stream`** → direct SSE, no job ID, calls `stream_sparky_analysis()` — **this is what DirectAgentStreamCard uses**
- **`/agent/start`** → returns `{ stream: "/agent/stream?url=..." }` — may be unused
- `CREW_MODEL` env var defaults to `"openai/gpt-5-mini"`
- Slow filesystem confirmed (localhost on network drive) — keep this in mind for timing assumptions

---

## Suggested Order of Work

1. **Read** `Sparky-Quick-Snapshot/`, `crew.py`, `DirectAgentStreamCard.tsx`, `page.tsx`
2. **Confirm** whether `run_sparky_pipeline()` already returns a `categories` array and what the schema looks like
3. **Enrich** `stream_sparky_analysis()` in `app.py` to emit `platform` + `category` events using the Gemini loop pattern
4. **Create or verify** the Next.js `/api/agent/stream` proxy route
5. **Fix** `DirectAgentStreamCard` SSE listener if needed
6. **Swap** `InstantTestCard` → `DirectAgentStreamCard` in `page.tsx`
7. **Apply** the three confirmed SSE bug fixes if not already in the repo
8. **Test** end-to-end: submit URL → categories stream in → WordPress card appears conditionally → CTA renders

---

## Notes & Constraints

- Vercel hobby/pro serverless timeout is 10s — keep individual fetch retries well under that
- The slow network drive filesystem means SSE event ordering can be non-deterministic at low latency; always gate on event content, not stream close
- `fallbackFetched` guard in `useHomepageTest.ts` is intentional — do not remove it
- Do not train on user data — already correctly handled by Flask (`no model training` flag)
- The `FALLBACK_PENDING_SUMMARY` string is the known stuck state that the Bug 1-3 fixes resolve

---

*Handoff generated April 2026. Ask the developer if any repo paths above don't match reality.*
