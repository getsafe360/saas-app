# CLAUDE.md - GetSafe360 AI Assistant Guide

**Version:** 2.0.0
**Last Updated:** 2026-02-06
**Project:** GetSafe360 AI-Powered Website Optimization Platform

> This file is the root hub. Detailed guidance is split across topic files for performance.

| File | Contents |
|------|----------|
| [CLAUDE-design.md](./CLAUDE-design.md) | Design system, tokens, colors, typography, card aesthetic, component visual specs |
| [CLAUDE-tech.md](./CLAUDE-tech.md) | Database schema, API conventions, dev workflows, environment variables |
| [CLAUDE-tasks.md](./CLAUDE-tasks.md) | Common task patterns, AI assistant guidelines, debugging |

---

## Project Overview

GetSafe360 is an **AI-powered website optimization platform** that empowers website owners, developers, and agencies to analyze, optimize, and maintain websites through automated AI agents. Four core pillars:

- **SEO Optimization** - Structured data, metadata, sitemaps
- **Performance** - Load times, image optimization, caching
- **Security** - Headers, XSS/DDoS protection, vulnerability scanning
- **Accessibility** - WCAG compliance, a11y audits

### Mission

"Make enterprise-level AI optimization tools accessible to SMEs, freelancers, educators, and public organizations."

### Core Value Proposition

- **No-code optimization** - Paste a URL, get instant improvements
- **AI Co-Pilot** - Automated fixes with human oversight
- **Multi-tenant SaaS** - Teams, subscriptions, and activity tracking
- **WordPress-first** - Deep WooCommerce integration with tailored fixes

---

## Architecture & Technology Stack

### Monorepo Structure

```
/home/user/saas-app/
├── saas-ux/              # Next.js 15 frontend (primary app)
├── flask_app/            # Legacy Python Flask backend
├── latest_ai_development/# CrewAI agent system
├── package.json          # Root workspace (pnpm@10.23.0)
└── pnpm-workspace.yaml   # Workspace config
```

### Frontend Stack (saas-ux/)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.0.0-canary.47 | App Router, RSC, API routes |
| React | 19.1.0 | UI library |
| TypeScript | 5.8.3 | Type safety |
| TailwindCSS | 4.1.7 | Utility-first styling |
| Drizzle ORM | 0.44.5 | Type-safe PostgreSQL ORM |
| Clerk | 6.23.1 | Authentication (OAuth, SSO) |
| AI SDK | 5.0.0-beta.2 | OpenAI streaming integration |
| Vercel Blob | Latest | Screenshot & report storage |
| Upstash Redis | Latest | Rate limiting & caching |
| Stripe | 18.1.0 | Subscription payments |
| Puppeteer Core | 24.17.0 | Headless browser for screenshots |
| next-intl | 4.3.1 | i18n (6 languages: EN, DE, ES, FR, IT, PT) |

### Backend/AI Stack

| Technology | Purpose |
|------------|---------|
| CrewAI (Python) | Multi-agent orchestration (SEO, Performance, Security, A11y) |
| Flask | HTTP gateway for AI agents |
| OpenAI API | LLM inference (gpt-4o-mini default) |

### Database

- **PostgreSQL** (via Neon serverless)
- **Drizzle ORM** for schema management
- **Connection pool**: Max 5 connections, 10s idle timeout (serverless-optimized)

---

## Brand Voice & Copy Guidelines

### Tone

- **Confident but approachable** - "We fix what your agency forgot"
- **Technical without jargon** - Explain AI benefits, not AI mechanics
- **Action-oriented** - Use verbs: "Optimize", "Ship", "Fix", "Upgrade"
- **Inclusive** - "Your website", "Let's make it better", "You're in control"

**Avoid:** Marketing fluff, excessive emojis, passive voice.

### CTA Copy

| Context | Copy |
|---------|------|
| Guest homepage | "Create your free account" |
| After analysis | "Fix with Copilot" |
| Signed-in dashboard | "Start analysis" |
| Pricing page | "Start free" / "Upgrade now" |

### Error Messages

Format: `<Issue> → <Action>` (e.g. "Connection failed → Check your internet and try again")

### Locales

`'en', 'de', 'es', 'fr', 'it', 'pt'`

---

## Git Conventions

**Branch Naming:**
- `feature/<name>`, `fix/<name>`, `refactor/<name>`, `docs/<name>`, `claude/<session-id>`

**Commit Message Format:**
```
<type>: <description>
Types: feat, fix, refactor, docs, style, test, chore
```
