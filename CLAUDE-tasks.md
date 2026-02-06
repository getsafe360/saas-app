# CLAUDE-tasks.md - GetSafe360 Common Tasks & AI Guidelines

> Referenced from [CLAUDE.md](./CLAUDE.md). Patterns for common development tasks and assistant behavior.

---

## AI Assistant Guidelines

### DO

1. **Read before editing** - Always read files before modifying
2. **Use TodoWrite** - Track multi-step tasks with todo list
3. **Follow existing patterns** - Match component structure, naming
4. **Use design tokens** - All colors, spacing, radii, shadows via `var(--...)` from `tokens.css`
5. **Test dark mode** - All components must work in light + dark
6. **Use semantic HTML** - `<button>`, `<nav>`, `<main>`, ARIA labels
7. **Type everything** - No `any` types, use Zod for validation
8. **Commit with conventional messages** - `feat:`, `fix:`, `refactor:`

### DON'T

1. **Hardcode colors** - Use token variables, not raw hex/rgb
2. **Add emojis to code** - Only in marketing copy if contextually appropriate
3. **Create files unnecessarily** - Prefer editing existing files
4. **Break accessibility** - Maintain WCAG AA minimum
5. **Use pill shapes** - Rectangular with 6-8px radius (Clerk-style) unless explicitly needed
6. **Add heavy shadows/glows** - Only `--shadow-sm` and `--shadow-md`
7. **Hardcode secrets** - Use environment variables
8. **Skip error handling** - All API routes need try/catch
9. **Use `any` types** - Define proper TypeScript interfaces

### Code Quality Standards

**TypeScript:** Strict mode, path aliases `@/` -> root of `saas-ux/`, `import "server-only"` for DB queries.

**React:** Server Components by default. `"use client"` only when needed (hooks, event handlers). Extract logic to custom hooks.

**Styling:** TailwindCSS utilities mapped to design tokens. Dark mode via `dark:` prefix. Responsive: `sm:`, `md:`, `lg:`, `xl:`.

**Database:** Transactions for multi-step operations. Drizzle prepared statements. Indexes for frequent queries.

---

## Common Tasks

### Adding a New UI Component

1. Create in `components/ui/<name>.tsx`
2. Use `class-variance-authority` for variants
3. Reference design tokens (not hardcoded values)
4. Add dark mode support
5. Document props with JSDoc

**Template:**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const myComponentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "bg-[var(--background-default)] text-[var(--text-default)]",
        primary: "bg-[var(--color-primary-500)] text-[var(--text-inverted)]",
      },
      size: {
        sm: "text-sm p-[var(--space-sm)]",
        default: "text-base p-[var(--space-md)]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

export function MyComponent({ className, variant, size, ...props }: MyComponentProps) {
  return <div className={cn(myComponentVariants({ variant, size }), className)} {...props} />;
}
```

### Adding a New API Route

1. Create `app/api/<resource>/<action>/route.ts`
2. Add auth check (`getDbUserFromClerk`)
3. Add Zod validation
4. Add rate limiting
5. Implement business logic
6. Return `{ ok: true/false }` format

See [CLAUDE-tech.md](./CLAUDE-tech.md) for full template.

### Adding a Database Table

1. Define schema in `lib/db/schema/<group>/<table>.ts`
2. Export from `lib/db/schema.ts`
3. `pnpm db:generate` -> review SQL -> `pnpm db:migrate`
4. Add TypeScript types

### Adding Internationalization

1. Add translations in `messages/<locale>.json`
2. Use `useTranslations()` hook in components
3. All 6 locales: `en`, `de`, `es`, `fr`, `it`, `pt`

```tsx
import { useTranslations } from 'next-intl';

export function Dashboard({ userName }: { userName: string }) {
  const t = useTranslations('Dashboard');
  return <h1>{t('welcome', { name: userName })}</h1>;
}
```

---

## Component Patterns

### Button Component

**File:** `components/ui/button.tsx`

```tsx
import { Button } from "@/components/ui/button";

<Button variant="agent">Start Analysis</Button>   // AI-branded gradient (primary CTA)
<Button variant="default">Learn More</Button>      // Secondary CTA
<Button variant="free">Start Free</Button>         // Free tier
<Button variant="destructive">Delete Site</Button> // Semantic
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Skip</Button>

<Button size="sm" />  <Button size="default" />  <Button size="lg" />  <Button size="icon" />
```

- Use `variant="agent"` for AI-related CTAs (scan, fix, analyze)
- Always include accessible labels (no icon-only without `aria-label`)

### Card Component

**File:** `components/ui/card.tsx`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Site Overview</CardTitle>
    <CardDescription>Recent scans and activity</CardDescription>
    <CardAction><Button variant="ghost" size="icon">...</Button></CardAction>
  </CardHeader>
  <CardContent>{/* Main content */}</CardContent>
  <CardFooter><Button>View Details</Button></CardFooter>
</Card>
```

### Badge / StatusBadge

```tsx
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/StatusBadge";

<Badge variant="default">Queued</Badge>
<StatusBadge status="queued" />   // Gray
<StatusBadge status="running" />  // Blue with pulse
<StatusBadge status="done" />     // Green
<StatusBadge status="error" />    // Red
```

### Analyzer Components

**Directory:** `components/analyzer/`

Key components: `UrlAnalyzeForm`, `FindingsFeed`, `PillarColumn`, `SiteIdentityCard`, `ReportHero`, `WPSpotlight`

```tsx
import UrlAnalyzeForm from "@/components/analyzer/forms/UrlAnalyzeForm";
import FindingsFeed from "@/components/analyzer/findings/FindingsFeed";

<UrlAnalyzeForm onSubmit={handleAnalyze} />
<FindingsFeed findings={streamedFindings} />
```

---

## Debugging

**Type errors in schema:**
```bash
pnpm db:generate   # Regenerate types
# Restart TypeScript server in IDE
```

**Clerk auth not working:**
```bash
echo $CLERK_SECRET_KEY
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Verify middleware.ts log in dev console
```

**Styles not applying:**
```bash
rm -rf .next && pnpm dev   # Clear cache
# Verify PostCSS output in terminal
```

**Database connection fails:**
```bash
pnpm db:studio   # Test connection
echo $POSTGRES_URL
```

---

## Testing Requirements

For new features:
1. Add Playwright E2E test in `tests/`
2. Test happy path + error cases
3. Verify dark mode appearance
4. Check mobile responsiveness

```typescript
import { test, expect } from '@playwright/test';

test('should analyze website and display results', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="url"]', 'https://example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.findings-feed')).toBeVisible();
  await expect(page.locator('.score-bar')).toHaveCount(4);
});
```

### File Creation Guidelines

**Only create new files when:** adding a feature that doesn't fit existing structure, new page route, new reusable component.

**Prefer editing:** extending existing components with props, adding variants to UI components, updating schemas.
