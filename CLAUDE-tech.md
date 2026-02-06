# CLAUDE-tech.md - GetSafe360 Technical Reference

> Referenced from [CLAUDE.md](./CLAUDE.md). Database, API, dev workflows, and environment configuration.

---

## Development Workflows

### Setup & Installation

```bash
git clone <repo-url>
cd saas-app
pnpm install

cd saas-ux
pnpm db:setup     # Prompts for Postgres, Stripe, creates .env
pnpm dev          # Starts Next.js on localhost:3000
```

### Database Workflows

```bash
pnpm db:generate   # Generate migration from schema.ts
pnpm db:migrate    # Run pending migrations
pnpm db:push       # Push schema to DB (dev only)
pnpm db:studio     # Open Drizzle Studio UI
pnpm db:seed       # Populate demo data
pnpm db:drop       # DESTRUCTIVE: Drop all tables
```

### Environment Variables

**Required (`.env`):**

```bash
# Database
POSTGRES_URL=postgresql://user:pass@host/dbname

# Clerk Auth
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# AI/LLM
OPENAI_API_KEY=sk-...
MODEL=gpt-4o-mini

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage & Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
VERCEL_BLOB_TOKEN=...

# Config
BASE_URL=http://localhost:3000
```

---

## Database Schema & Conventions

### Schema Organization

```
lib/db/schema/
├── _shared/
│   └── enums.ts          # Shared enums (job_status, agent, etc.)
├── auth/
│   ├── users.ts          # User accounts
│   └── teams.ts          # Team management
├── sites/
│   └── sites.ts          # Connected websites
├── billing/
│   └── plans.ts          # Subscription plans
└── schema.ts             # Legacy tables (being migrated)
```

### Naming Conventions

| Context | Schema (TS) | Database (SQL) |
|---------|-------------|----------------|
| Tables | `scanJobs` (PascalCase) | `scan_jobs` (snake_case, plural) |
| Columns | `createdAt` (camelCase) | `created_at` (snake_case) |
| Enums | `job_status` | `job_status` (snake_case) |

### Key Tables

```typescript
// Users & Auth
users { id, clerkUserId, email, name, ... }
teams { id, name, ... }
teamMembers { teamId, userId, role }

// Sites & Jobs
sites { id, userId, teamId, host, status, ... }
scanJobs { id, siteId, status, categories, reportBlobKey, ... }
fixJobs { id, siteId, status, issues, resultBlobKey, ... }

// Subscriptions
teamSubscriptions { id, teamId, stripeSubscriptionId, status, ... }
plans { id, slug, name, prices[] }

// Activity
activityLogs { id, userId, teamId, siteId, event, data, ... }
```

### Status Enums

```typescript
type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';
type SiteStatus = 'pending' | 'connected' | 'disconnected';
type ChangeSetStatus = 'draft' | 'approved' | 'applied' | 'rolled_back' | 'failed';
```

### Foreign Keys & Cascades

```typescript
// Owned entities: cascade delete
siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' })

// Audit trail: set null
userId: integer('user_id').references(() => users.id, { onDelete: 'set null' })
```

### Index Naming

Pattern: `<table>_<column>_idx` / `<table>_<column>_uq`

```typescript
index('scan_jobs_site_idx').on(t.siteId),
uniqueIndex('sites_user_host_uq').on(t.userId, t.host),
```

---

## API Conventions

### Route Organization

```
app/api/
├── scan/
│   ├── start/route.ts       # POST - Start scan
│   ├── status/route.ts      # GET - Poll status
│   └── result/route.ts      # GET - Fetch report
├── fix/
│   ├── start/route.ts       # POST - Start fix job
│   ├── accept/route.ts      # POST - Accept changes
│   └── cancel/route.ts      # POST - Cancel job
├── sites/
│   └── add/route.ts         # POST - Add site
├── user/route.ts            # GET - User profile
├── team/route.ts            # GET - Team info
└── stripe/
    ├── checkout/route.ts    # POST - Create session
    └── webhook/route.ts     # POST - Stripe events
```

### Response Patterns

```typescript
// Success
return NextResponse.json({ ok: true, data: { id: '...', status: 'done' } });

// Error
return NextResponse.json(
  { ok: false, error: 'Invalid URL format' },
  { status: 400 }
);
```

### Authentication Pattern

```typescript
import { getDbUserFromClerk } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getDbUserFromClerk();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = MySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 });
  }

  const result = await doSomething(parsed.data);
  return NextResponse.json({ ok: true, data: result });
}
```

### Rate Limiting

```typescript
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ max: 30, windowMs: 60000 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await limiter.check(ip);
  if (!success) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
  }
  // ...
}
```

### Streaming Responses (AI)

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const result = await streamText({
    model: openai(process.env.MODEL || 'gpt-4o-mini'),
    prompt,
  });
  return result.toTextStreamResponse();
}
```

**Client-side consumption:**

```tsx
const response = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ url }) });
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setStreamedText(prev => prev + new TextDecoder().decode(value));
}
```
