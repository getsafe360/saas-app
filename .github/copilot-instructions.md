# Copilot Instructions for getsafe360/saas-app

## Repository Summary

GetSafe360 is an AI-driven SaaS platform for real-time website optimization, performance testing, and compliance (SEO, accessibility, security). It combines Next.js frontend with Python/Flask backend AI agents powered by CrewAI.

**Project type:** Hybrid monorepo (Next.js + Python Flask + AI agents)  
**Main languages:** TypeScript, Python  
**Frameworks:** Next.js 15 (App Router), Flask, CrewAI  
**Target runtimes:** Node.js 20, Python >=3.10 <3.14  
**Package managers:** pnpm 9.12.3 (Node), uv (Python)

**Structure:**
- `saas-ux/` – Next.js 15 SaaS application (main frontend)
- `flask_app/` – Flask API bridge to AI agents
- `latest_ai_development/` – CrewAI multi-agent system for website analysis

---

## Toolchain & Runtimes

**Node.js & Package Manager:**
- Node: v20.x (no .nvmrc; check with `node -v`)
- pnpm: 9.12.3 (enforced via `packageManager` in root package.json)
- Install pnpm: `npm install -g pnpm@9.12.3`

**Python:**
- Python: >=3.10 <3.14
- Dependency manager: [uv](https://docs.astral.sh/uv/) (install: `pip install uv`)
- CrewAI framework for AI agents

**Key CLIs & Tools:**
- `drizzle-kit` – Database migrations/schema management
- `stripe` – Stripe CLI for webhook testing (optional)
- `npx tsx` – TypeScript execution for db scripts
- Puppeteer (requires Chromium; may fail in restricted networks)

**Environment Variables:**
Check `saas-ux/.env` (not committed). Required keys:
- `DATABASE_URL` or `POSTGRES_URL` – PostgreSQL connection
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` – Clerk auth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` – Stripe payments
- `BLOB_READ_WRITE_TOKEN` – Vercel Blob storage
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` – Rate limiting
- `AUTH_SECRET` – Session signing (generate: `openssl rand -base64 32`)
- `OPENAI_API_KEY` – For AI features (Flask app & CrewAI)
- `BASE_URL` – Application URL (e.g., `http://localhost:3000`)

No `.env.example` exists; refer to `saas-ux/lib/db/setup.ts` and Flask `app.py` for hints.

---

## Bootstrap / Build / Test / Run / Lint

### 1. Bootstrap (Install Dependencies)

**Next.js workspace:**
```bash
# From repository root:
pnpm install
```
**Preconditions:** pnpm 9.12.3 installed globally.  
**Postconditions:** `node_modules/` populated; `saas-ux/node_modules/` symlinked via pnpm workspace.  
**Duration:** ~60s (first run).  
**Common failure:** Puppeteer download may fail in restricted networks. Not critical for build; set `PUPPETEER_SKIP_DOWNLOAD=true` if needed.

**Python/CrewAI (optional, for Flask AI agents):**
```bash
cd latest_ai_development
pip install uv
crewai install
# OR: uv pip install -r requirements.txt
```
**Preconditions:** Python 3.10–3.13 installed.  
**Postconditions:** CrewAI and dependencies installed.

### 2. Database Setup

**Always run before first `dev` or `build`:**
```bash
cd saas-ux
pnpm db:setup    # Interactive: creates .env, prompts for Stripe/Postgres
pnpm db:migrate  # Applies Drizzle migrations
pnpm db:seed     # Seeds test user (test@test.com / admin123)
```
**Preconditions:** `.env` with valid `DATABASE_URL`.  
**Postconditions:** Database schema initialized; test user created.  
**Common failure:** If `DATABASE_URL` is missing or invalid, `db:setup` will fail. Ensure Postgres is running (local or Neon/Vercel Postgres).

**Database commands (reference):**
- `pnpm db:push` – Push schema changes without migrations (dev only)
- `pnpm db:generate` – Generate new migration files
- `pnpm db:studio` – Open Drizzle Studio (DB GUI)

### 3. Build

**From root:**
```bash
pnpm build
```
**Equivalent to:**
```bash
cd saas-ux && next build
```
**Preconditions:** `pnpm install` completed; `.env` with all required keys; database migrated.  
**Postconditions:** `.next/` build directory; static/SSR pages compiled.  
**Duration:** ~60–120s.  
**Common failures:**
- Missing env vars → Build may fail or emit warnings. Check `next.config.js` and API routes for required vars.
- Import errors in `server-only` code → Ensure no server-side imports in client components.
- Database connection errors → Build succeeds, but runtime will fail. Always migrate first.

**No lint/typecheck in build by default.** Run separately (see below).

### 4. Lint & Typecheck

**No dedicated lint script exists.** Next.js runs ESLint during `next build` if configured.  
**Manual typecheck:**
```bash
cd saas-ux
npx tsc --noEmit
```
**Duration:** ~10–20s.  
**No dedicated formatting tool (Prettier) configured.** Follow existing code style.

### 5. Test

**No test infrastructure exists** (no jest/vitest/playwright configs). Testing is currently manual.

### 6. Run Development Server

**Next.js (saas-ux):**
```bash
pnpm dev
# OR from saas-ux: pnpm dev
```
**Preconditions:** `pnpm install`, `db:migrate`, `db:seed` completed; `.env` configured.  
**Postconditions:** Dev server at [http://localhost:3000](http://localhost:3000). Supports hot reload (Turbopack).  
**Duration:** ~5–10s startup.  
**Common failures:**
- Port 3000 conflict → Kill existing process or change port: `PORT=3001 pnpm dev`
- Missing `.env` → Server starts but pages fail. Check browser console and terminal.

**Flask API (optional, for AI analysis):**
```bash
cd flask_app
python app.py
# OR: python runserver.py
```
**Preconditions:** Python deps installed; `OPENAI_API_KEY` in `flask_app/.env`.  
**Postconditions:** Flask API at `http://localhost:5000` (or configured port).

**Stripe webhooks (optional):**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
**Preconditions:** Stripe CLI authenticated (`stripe login`).

### 7. Production Start

```bash
pnpm start
# OR from saas-ux: pnpm start
```
**Preconditions:** `pnpm build` completed.  
**Postconditions:** Production server at [http://localhost:3000](http://localhost:3000).

---

## Project Layout & Key Files

### Architecture Map

```
saas-app/
├── saas-ux/                      # Next.js 15 App Router SaaS (main app)
│   ├── app/
│   │   ├── [locale]/             # Internationalized routes (en, de, es, fr, it, pt)
│   │   │   ├── (dashboard)/      # Protected routes: /dashboard, /pricing, /terms
│   │   │   ├── (login)/          # Auth routes: /sign-in, /sign-up (Clerk)
│   │   │   ├── faq/
│   │   │   └── page.tsx          # Landing page (hero + analyzer form)
│   │   ├── api/                  # API routes (Next.js Route Handlers)
│   │   │   ├── analyze/          # Website analysis endpoints
│   │   │   ├── scan/             # Scanning APIs
│   │   │   ├── stripe/           # Stripe checkout + webhooks
│   │   │   └── user/             # User management
│   │   ├── layout.tsx            # Root layout (ClerkProvider, GTM)
│   │   └── globals.css           # Tailwind CSS
│   ├── components/               # React components
│   │   ├── analyzer/             # URL analysis UI
│   │   ├── header/               # Navigation
│   │   ├── marketing/            # Landing page sections
│   │   ├── report/               # Analysis reports
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/
│   │   ├── db/                   # Drizzle ORM
│   │   │   ├── schema.ts         # Database schema
│   │   │   ├── migrations/       # SQL migration files
│   │   │   ├── setup.ts          # Interactive .env setup script
│   │   │   └── seed.ts           # Seed test data
│   │   ├── auth/                 # Clerk auth helpers
│   │   ├── payments/             # Stripe integration
│   │   └── services/             # Business logic (analyzers, etc.)
│   ├── messages/                 # i18n JSON files (de, en, es, fr, it, pt)
│   ├── next.config.js            # Next.js config (next-intl, PPR, images)
│   ├── drizzle.config.ts         # Drizzle Kit config
│   ├── tsconfig.json             # TypeScript config (baseUrl: ".", paths: "@/*")
│   └── middleware.ts             # Next.js middleware (i18n + auth)
├── flask_app/                    # Flask API bridge to AI agents
│   ├── app.py                    # Main Flask app (CORS, endpoints)
│   ├── requirements.txt          # Python deps (Flask, crewai)
│   └── static/, templates/       # Flask static/templates (if any)
├── latest_ai_development/        # CrewAI multi-agent system
│   ├── src/latest_ai_development/
│   │   ├── crew.py               # WebsiteAnalyzerCrew definition
│   │   ├── config/
│   │   │   ├── agents.yaml       # AI agent configs
│   │   │   └── tasks.yaml        # Task definitions
│   │   └── main.py               # Entry point for `crewai run`
│   ├── pyproject.toml            # Python project config
│   └── knowledge/                # RAG knowledge base (if used)
├── pnpm-workspace.yaml           # pnpm workspace (includes saas-ux)
└── package.json                  # Root package.json (delegates to saas-ux)
```

### Key Entry Points

**Frontend:**
- `saas-ux/app/[locale]/page.tsx` – Landing page with URL analyzer form
- `saas-ux/app/[locale]/(dashboard)/dashboard/page.tsx` – Main dashboard
- `saas-ux/app/layout.tsx` – Root layout (ClerkProvider wraps all pages)

**Backend:**
- `saas-ux/app/api/analyze/route.ts` – Website analysis API
- `saas-ux/app/api/stripe/webhook/route.ts` – Stripe webhook handler
- `flask_app/app.py` – Flask bridge to CrewAI agents (port 5000)

**Database:**
- `saas-ux/lib/db/schema.ts` – Single source of truth for DB schema (Drizzle ORM)
- `saas-ux/lib/db/migrations/` – Generated SQL migrations (commit these)

**Config Locations:**
- TypeScript: `saas-ux/tsconfig.json` (paths alias `@/*` to `saas-ux/`)
- Next.js: `saas-ux/next.config.js` (next-intl, PPR, image remotePatterns)
- Drizzle: `saas-ux/drizzle.config.ts` (schema path, migrations folder)
- Tailwind: `saas-ux/postcss.config.mjs`, inline config in `tailwind.config.ts`
- i18n: `saas-ux/i18n/request.ts`, `saas-ux/navigation.ts` (next-intl setup)
- No ESLint/Prettier configs present (follow Next.js defaults)

**Deployment:**
- Vercel-ready (no `vercel.json`; standard Next.js deployment)
- Clerk for auth (configured via env vars)
- Stripe for payments (webhooks must be configured in Stripe Dashboard)

---

## CI/CD & Validation

**No GitHub Actions workflows exist** (`.github/workflows/` is empty).  

**To replicate local validation:**
```bash
# Full validation sequence:
pnpm install
cd saas-ux
pnpm db:migrate
npx tsc --noEmit      # Typecheck
pnpm build            # Build (includes Next.js ESLint if configured)
# No tests to run
```

**Manual validation steps:**
1. Ensure all env vars are set (check `saas-ux/lib/db/setup.ts` for required keys).
2. Database migrations applied (`pnpm db:migrate`).
3. TypeScript compiles (`npx tsc --noEmit`).
4. Build succeeds (`pnpm build`).
5. Dev server starts without errors (`pnpm dev`).

**Future CI:** Expected checks would include: typecheck, build, lint (if configured), security scans (e.g., Snyk, Dependabot).

---

## Common Pitfalls & Workarounds

### 1. Puppeteer Install Fails (Network Restricted)
**Symptom:** `pnpm install` fails downloading Chromium.  
**Workaround:** Set `PUPPETEER_SKIP_DOWNLOAD=true` before install. Puppeteer is only used for screenshots in `saas-ux/app/api/screenshot/route.ts`. If not needed, skip. For production, use `@sparticuz/chromium` (already in deps).

### 2. Module Resolution Errors (`server-only` imports in client components)
**Symptom:** Build fails with "server-only module imported in client component".  
**Fix:** Ensure `'use client'` directive is present in client components. Move server-side imports (Drizzle queries, Clerk `currentUser()`) to Server Components or API routes.

### 3. Missing `.env` Variables
**Symptom:** Runtime errors (e.g., "DATABASE_URL is not defined").  
**Fix:** Run `pnpm db:setup` from `saas-ux/` to interactively create `.env`. For manual setup, copy required keys from this doc (see **Environment Variables** section).

### 4. Database Migration Failures
**Symptom:** `pnpm db:migrate` fails with "relation already exists" or "migrations out of sync".  
**Fix:** 
- For dev: `pnpm db:push` (bypasses migrations; use cautiously).
- For production: Ensure `lib/db/migrations/` is committed and up-to-date. Never delete migration files.
- If stuck: Drop database and re-run `db:migrate` + `db:seed` (dev only).

### 5. Port 3000 Already in Use
**Symptom:** `pnpm dev` fails with "EADDRINUSE".  
**Workaround:** Kill existing process (`lsof -ti:3000 | xargs kill`) or change port: `PORT=3001 pnpm dev`.

### 6. Clerk Auth Issues
**Symptom:** Redirect loops or "Invalid JWT" errors.  
**Fix:**
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are correct.
- Check Clerk Dashboard → Settings → Domains (ensure `BASE_URL` matches).
- Clear cookies and test in incognito mode.

### 7. Stripe Webhooks Not Triggering Locally
**Symptom:** Subscription updates not reflected in app.  
**Fix:** Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Copy webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`.

### 8. i18n Route Errors (404 on `/`)
**Symptom:** `/` redirects to `/en` or 404.  
**Fix:** `saas-ux/middleware.ts` handles locale routing. Supported locales: `en, de, es, fr, it, pt`. Default is `en`. Ensure `messages/<locale>.json` exists for new locales.

### 9. Cold Start Delays (Docker/Flask)
**Symptom:** Flask API slow to respond (5–10s first request).  
**Fix:** Keep Flask server running during dev. No Docker setup exists; run Flask natively.

### 10. Drizzle Schema Changes Not Reflected
**Symptom:** Database queries fail after schema edits.  
**Fix:**
- Always run `pnpm db:generate` after editing `lib/db/schema.ts`.
- Then `pnpm db:migrate` to apply migrations.
- For dev-only quick changes: `pnpm db:push` (skips migration generation).

---

## Quick Index

### Root Files
- `package.json` – Root scripts (delegates to `saas-ux`)
- `pnpm-workspace.yaml` – Workspace config (includes `saas-ux`)
- `pnpm-lock.yaml` – Lockfile (commit this)
- `.gitignore` – Excludes `node_modules`, `.env`, `.next`, `.vercel`
- `README.md` – High-level project overview
- `CONTRIBUTING.md` – Contribution guidelines

### `saas-ux/` (Next.js App)
**Top-level:**
- `package.json` – Scripts: `dev`, `build`, `start`, `db:*`
- `next.config.js`, `drizzle.config.ts`, `tsconfig.json`, `middleware.ts`

**Key Directories:**
- `app/` – App Router pages and API routes
- `components/` – React components (shadcn/ui, custom)
- `lib/` – Utilities, database, auth, services
- `messages/` – i18n translations (JSON)
- `public/` – Static assets

**Key Files:**
- `app/layout.tsx` – Root layout (ClerkProvider, fonts, GTM)
- `app/[locale]/page.tsx` – Landing page entry
- `lib/db/schema.ts` – Database schema (Drizzle)
- `lib/db/drizzle.ts` – Drizzle client initialization
- `lib/auth/session.ts` – Clerk session helpers
- `middleware.ts` – i18n + auth middleware

### `flask_app/`
- `app.py` – Flask API entry (port 5000)
- `requirements.txt` – Python dependencies

### `latest_ai_development/` (CrewAI)
- `src/latest_ai_development/crew.py` – AI agent orchestration
- `src/latest_ai_development/config/agents.yaml` – Agent definitions
- `pyproject.toml` – Python project config

**Entry point snippet (`saas-ux/app/[locale]/page.tsx`):**
```tsx
export default function HomePage() {
  const [pendingUrl, setPendingUrl] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  // Renders hero section + UrlAnalyzeForm + StreamingReportShell
  return <main>...</main>;
}
```

---

**Trust this document.** Only search if this is incomplete or incorrect.
