# Crew Service Vercel API Gateway Deployment Guide

## 1) Architecture and gateway behavior

- Entrypoint: `POST /api/analyze`
- Health check: `GET /api/health`
- Routing strategy:
  - Requests targeting the configured `WORDPRESS_SITE_URL` domain route to the WordPress crew (`audit_wordpress`).
  - All other requests route to the generic crew (`analyze_seo`).
  - Optional request override via `platform: "wordpress" | "generic"`.

### Request schema

```json
{
  "url": "https://example.com",
  "platform": "wordpress"
}
```

### Response schema

```json
{
  "status": "success",
  "platform": "wordpress",
  "task": "audit_wordpress",
  "data": {
    "task": "audit_wordpress",
    "url": "https://example.com",
    "model": "openai/gpt-4o-mini",
    "result": "...",
    "usage_metrics": {}
  }
}
```

## 2) Required environment variables

Set these in Vercel Project Settings → Environment Variables:

- `OPENAI_API_KEY`
- `CREWAI_API_KEY`
- `WORDPRESS_SITE_URL`
- `NEXT_PUBLIC_API_URL`
- Optional: `CREW_DEFAULT_MODEL`, `APP_ENV`

The gateway validates required values and URL formats at startup.

## 3) Outbound network allow-list

If your environment enforces egress controls, allow:

- `https://api.openai.com`
- `https://api.crewai.com`
- Your WordPress domain(s) (e.g. `https://your-wordpress-site.com`)

## 4) Step-by-step Vercel deployment

1. From repository root, ensure the service is ready:
   - `cd latest_ai_development/crew_service`
2. Verify dependencies are pinned in `requirements.txt`.
3. Confirm `vercel.json` routes `/api/*` to `api/main.py`.
4. In Vercel, create a new project that points to this folder as the Root Directory (`latest_ai_development/crew_service`).
5. Set runtime env vars listed above for Preview and Production.
6. Deploy.
7. Validate health endpoint:
   - `GET https://<deployment-url>/api/health`
8. Validate analyze endpoint:
   - `POST https://<deployment-url>/api/analyze` with sample payload.

## 5) Logging best practices for serverless Python

- Use structured logs with stable event names (e.g., `analysis_completed`).
- Log request metadata (`platform`, `task`, sanitized URL host), not secrets.
- Keep error logs concise and include coarse category (`config`, `provider`, `validation`).
- Avoid large payload logging to reduce costs and improve readability.

## 6) Cold-start mitigation strategies

- Keep import graph lean and avoid heavy work during module import.
- Use Vercel function memory sized for CrewAI execution (`1024 MB` baseline).
- Validate config in lifespan startup to fail fast.
- Optionally schedule periodic health pings to reduce idle cold starts.

## 7) Deployment checklist

- [ ] `vercel.json` uses Python 3.11 and `/api/*` route mapping.
- [ ] `api/main.py` exposes `/api/health` and `/api/analyze`.
- [ ] Required env vars set in Vercel.
- [ ] WordPress domain configured in `WORDPRESS_SITE_URL`.
- [ ] Outbound allow-list configured for OpenAI, CrewAI, and WordPress.
- [ ] Health endpoint returns `status: ok`.
- [ ] Analyze endpoint succeeds for WordPress and non-WordPress URLs.

## 8) Migration note

This gateway leaves the unified CrewAI logic in `src/latest_ai_development` untouched and wraps it with a Vercel-native API surface. Existing frontend/API clients can call `/api/analyze`, while routing to WordPress or generic crews is handled at the gateway layer rather than in client code.
