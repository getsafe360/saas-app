# Malkodent — Deployment Decision & Remediation Report
Prepared from: seo + wordpress_seo_security_operability_audit module outputs and a recommended practical SEO/WordPress checklist (no live crawl available).

---

## Executive summary
- Overall audit score (template-based, pre-crawl): **52 / 100**
- Score confidence: **0.35** (many items require live verification)
- Short verdict: **Not ready for production deployment for public indexing & launch improvements.**
  - Immediate blocking issues (HTTPS, robots.txt, sitemap & indexing, critical redirects/broken links) must be validated and resolved.
  - After blockers are resolved, performance (Core Web Vitals) and structured data must be completed before final go-live promotion for SEO-sensitive launch.

This report is prescriptive and actionable: it converts the module findings into prioritized repairs, explicit blockers, a deployment gating checklist (validation checks + commands), timeline estimates, owners, and rollback guidance.

---

## Top-level deployment readiness verdict (clear)
- Readiness state: NOT READY
- Reasoning (must-fix blockers before production promotion):
  1. HTTPS redirect / certificate / mixed-content unknown (security & UX risk; must be validated).
  2. robots.txt not verified — could be accidentally blocking crawlers or assets.
  3. XML sitemap and Search Console not validated/submitted — prevents reliable indexing.
  4. Site crawl not executed — unknown 4xx/5xx, redirect chains, duplicate meta, canonical issues.
  5. Core Web Vitals unknown; could cause poor user experience and ranking penalties.
- Conditions to mark as "Ready":
  - Pass validation checks V001–V005 and V010 (see checklist below).
  - No critical redirect chains or 5xx errors.
  - HTTPS grade A and no mixed content.
  - Sitemap submitted and GSC property verified (https).
  - LocalBusiness schema (Dentist) present & validated.
  - Basic CWV improvements in staging (LCP/CLS/INP acceptable on sampled pages).

---

## Prioritized Repairs (Actionable, ordered — include task IDs, owner, hours)

High priority — fix immediately (blockers)
- T100 — Ensure HTTPS redirect & validate certificate
  - What: Single-hop HTTP -> HTTPS 301, valid TLS cert, fix mixed content, enable HSTS after testing.
  - Acceptance: curl -I http://malkodent.com -> 301 to https://...; SSL Labs Grade A; no mixed-content warnings.
  - Estimate: 2 hours. Owner: Platform/DevOps. Blocker: YES.

- T110 — Fetch & correct robots.txt and add sitemap directive
  - What: Confirm robots.txt exists, does not block /wp-content/ or assets; add Sitemap: directive.
  - Acceptance: /robots.txt present and contains "Sitemap: https://malkodent.com/sitemap.xml".
  - Estimate: 0.5 hours. Owner: SEO/Dev. Blocker: YES until verified.

- T120 — Generate/verify XML sitemap & submit to Search Console
  - What: Ensure sitemap at /sitemap_index.xml or /sitemap.xml, valid, canonical URLs, submit to GSC/Bing.
  - Acceptance: Sitemap returns 200; visible in GSC; sitemap referenced in robots.txt.
  - Estimate: 1 hour. Owner: SEO. Blocker: YES (indexing won't be reliable without this).

- T150 — Run full-site crawl and fix 4xx/5xx + redirect chains
  - What: Screaming Frog crawl; fix all internal 4xx/5xx, remove chains, validate redirects.
  - Acceptance: No internal 4xx/5xx (or documented 410s), all internal redirects are single-hop.
  - Estimate: 6 hours. Owner: Dev/SEO. Blocker: YES until redirect/404 landscape known and remediated.

- T130 — Add LocalBusiness / Dentist JSON-LD and validate
  - What: Implement accurate Dentist schema (name, NAP, geo, hours, url).
  - Acceptance: Rich Results Test shows LocalBusiness/Dentist schema with no errors; NAP matches GBP/footer.
  - Estimate: 2 hours. Owner: SEO/Dev. Blocker: YES for local search readiness.

- T140 — Claim/verify Google Business Profile & unify NAP
  - What: Claim GBP and ensure site NAP, schema, and GBP are identical.
  - Acceptance: GBP verified; NAP consistency across site and major citations.
  - Estimate: 6 hours (set-up + citation cleanup). Owner: Local SEO/Practice Manager. Blocker: Not blocking deployment technically, but blocking local SEO go-live.

- T200 — Core Web Vitals remediation (LCP/CLS/INP)
  - What: Address LCP sources, defer JS, inline critical CSS, convert images to WebP/AVIF, preloading LCP resource.
  - Acceptance: PSI targets: LCP < 2.5s, CLS < 0.1, INP/FID improved on homepage & top 2 service pages.
  - Estimate: 24 hours. Owner: Frontend/Platform. Blocker: Soft blocker — recommend resolving or mitigating in staging before marketing push.

Medium priority — important, schedule soon
- T210 — Titles/meta optimization for homepage & top services
  - Estimate: 6 hours. Owner: SEO/Content.

- T220 — Service page content expansion & FAQ schema
  - Estimate: 40 hours. Owner: Content/SEO.

- T230 — Image optimization program and responsive images
  - Estimate: 12 hours. Owner: Frontend/Content.

- T240 — Implement analytics & conversion tracking (GA4 + GSC linking)
  - Estimate: 6 hours. Owner: Analytics/Marketing.

- T300 — Accessibility and ARIA improvements
  - Estimate: 8 hours. Owner: Frontend/QA.

Low priority — ongoing or long-term
- OG/Twitter tags, backlink strategy, hreflang (if applicable), advanced accessibility, ongoing content, reviews acquisition.

Total rough immediate high-priority estimate: ~41.5 hours (sum of High tasks as listed). Add medium efforts for launch preparation.

---

## Blockers (explicit)
These must be validated/resolved BEFORE production promotion:
1. HTTPS configuration & no mixed content (T100).
2. robots.txt must be validated and corrected if blocking assets/pages (T110).
3. XML sitemap present and submitted to Google Search Console (T120).
4. Crawl to identify and fix 4xx/5xx and redirect chains (T150).
5. LocalBusiness/Dentist JSON-LD present and validated; GBP claimed and NAP consistent (T130 & T140).

If any of the above are failing, do not push final public launch or marketing campaigns relying on organic visibility. You may still deploy code to production for staging or internal testing provided HTTPS is correct and robots.txt temporarily blocks crawlers (if you intend to withhold indexing), but document that SEO-critical items remain unverified.

---

## Deployment gating checklist (validation checks to run and pass)
Run these immediately in staging and production (commands shown where possible). Paste outputs for targeted remediation.

- V001 — HTTP -> HTTPS redirect check
  - Command: curl -I -L http://malkodent.com
  - Expected: Single 301 to https://malkodent.com, final 200 on homepage.

- V002 — TLS certificate & grade (SSL Labs)
  - Action: Run SSL Labs test: https://www.ssllabs.com/ssltest/analyze.html?d=malkodent.com
  - Expected: Grade A; TLS 1.2/1.3, no major vulnerabilities.

- V003 — robots.txt retrieval
  - Command: curl -s https://malkodent.com/robots.txt
  - Expected: Not blocking /wp-content/, /wp-includes/, CSS/JS; contains Sitemap directive.

- V004 — Sitemap availability
  - Command: curl -I https://malkodent.com/sitemap_index.xml OR /sitemap.xml
  - Expected: 200, valid XML.

- V005 — Canonical tag verification (sample pages)
  - Command: curl -s https://malkodent.com/ | grep -i '<link rel="canonical"' -A1
  - Expected: Canonical present with absolute URL matching page.

- V006 — Mobile-Friendly Test
  - Action: Run Google Mobile-Friendly Test on homepage and one service page.
  - Expected: Mobile-friendly.

- V007 — PageSpeed Insights
  - Action: Run PSI for homepage + 2–3 service pages.
  - Expected: Collect LCP/CLS/INP and identify remediation items. Target LCP < 2.5s; CLS < 0.1.

- V008 — Rich Results (schema) test
  - Action: Use Rich Results Test for homepage and a service page.
  - Expected: LocalBusiness/Dentist schema valid and no critical errors.

- V009 — Indexing status quick check
  - Action: site:malkodent.com on Google and check GSC Coverage.
  - Expected: Expected pages indexed, no critical "Blocked by robots" or mass 404s.

- V010 — Screaming Frog full crawl
  - Action: Crawl and export 4xx, 5xx, redirect chains, duplicate titles, missing metas.
  - Expected: Provide CSV exports for remediation mapping.

- V011 — GBP presence & NAP check
  - Action: Search Google for "Malkodent" and capture knowledge panel/GBP screenshot.
  - Expected: GBP verified and NAP matches site.

- V012 — Open Graph preview check
  - Action: Facebook Sharing Debugger for homepage URL.
  - Expected: OG title/description/image present and correct.

- V013 — Analytics presence
  - Command: curl -s https://malkodent.com/ | grep -E 'G-|UA-|gtag' -A2
  - Expected: GA4 or GTM snippet present and firing.

Provide outputs (paste terminal results / screenshots / CSVs) for each check and I will convert them into an exact remediation plan per-URL.

---

## Recommended staging & production deployment plan (safe path)
1. Staging environment: deploy all code changes (theme, schema snippets, SEO plugin settings).
   - Ensure staging has HTTPS with similar cert (or use staging cert), and optionally block indexing (robots meta noindex) on staging.
2. Run validation checks V001–V013 on staging.
3. Fix issues iteratively in staging (resolve mixed content & CWV regressions).
4. Run Screaming Frog & PSI on staging; export reports and resolve top issues.
5. When staging passes all blocker checks, schedule production deploy during low-traffic hours.
6. After production deploy:
   - Run V001–V010 on production immediately.
   - Submit sitemap in GSC; monitor coverage for 24–72 hours.
7. Monitor GA4: event triggers (bookings/phone clicks) and performance metrics for 7–30 days.

Rollback plan:
- For each change (TLS, robots, redirects, plugin/theme changes), maintain configuration backups.
- If a change causes critical regression, revert to previous server config/theme/plugin version and reapply incremental fixes in staging.

---

## Timeline / Implementation cadence (recommended)
- Day 0–7 (Immediate): T100, T110, T120, T150, T130. Validation V001–V005, V010.
- Week 2–4: T200 (Core Web Vitals fixes), T210 (meta), T230 (images), T240 (analytics).
- Month 2–3: T220 (content expansion), citation building, reviews acquisition, backlink outreach.
- Ongoing: Monitoring, monthly SEO & performance audits.

---

## Owners & responsibilities
- Platform/DevOps: T100, T200 (infrastructure parts), server configuration, CDN, caching.
- Dev/Frontend: T150, T200 (JS/CSS), T230, T300.
- SEO: T110, T120, T130, T210, T220, internal linking, structured data guidance.
- Local SEO/Practice Manager: T140, citations, GBP verification, review management.
- Analytics/Marketing: T240, reporting, event tracking.

---

## Immediate next steps I need from you (to produce a deterministic per-URL remediation plan)
Please paste or attach the output of the following (I will convert into exact file-level fixes, code snippets, and PR-ready patches):

1. curl -I -L http://malkodent.com (V001 output)
2. curl -s https://malkodent.com/robots.txt (V003 content)
3. curl -I https://malkodent.com/sitemap_index.xml OR /sitemap.xml (V004)
4. Screaming Frog export CSVs: Internal, Response Codes, Redirect Chains, Page Titles, Meta Descriptions, H1
5. PageSpeed Insights JSON reports for:
   - Homepage (https://malkodent.com/)
   - 2 top service pages
6. HTML source of homepage and one service page (or paste page head for canonical/meta/schema)
7. Screenshot or link to Google Business Profile knowledge panel
8. SSL Labs test link or screenshot

If you paste those, I will:
- Produce per-URL prioritized fix list (files/lines to edit or plugin settings to change).
- Provide exact code snippets (canonical fixes, JSON-LD with exact NAP, robots text, server redirect config).
- Re-run virtual validation on pasted outputs and give final production deployment readiness verdict.

---

## Appendix — Copy/paste snippets & test commands (ready)
Helpful quick snippets included in the audit outputs — use/adjust and paste results after applying:

- robots.txt (sample)
User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /cgi-bin/
Sitemap: https://malkodent.com/sitemap.xml

- Canonical tag example
<link rel="canonical" href="https://malkodent.com/dental-implants/">

- JSON-LD Dentist (edit NAP & geo)
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "name": "Malkodent",
  "image": "https://malkodent.com/path/to/clinic-photo.jpg",
  "@id": "https://malkodent.com/",
  "url": "https://malkodent.com/",
  "telephone": "+XX-XXXXXXXX",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Street 123",
    "addressLocality": "City",
    "addressRegion": "Region",
    "postalCode": "PostalCode",
    "addressCountry": "CountryCode"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "12.345678",
    "longitude": "-12.345678"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "09:00",
      "closes": "18:00"
    }
  ],
  "priceRange": "$$"
}
</script>

- Nginx HTTP -> HTTPS 301 snippet
server {
  listen 80;
  server_name malkodent.com www.malkodent.com;
  return 301 https://$host$request_uri;
}

- Test commands (repeatable)
curl -I -L http://malkodent.com
curl -s https://malkodent.com/robots.txt
curl -I https://malkodent.com/sitemap_index.xml
curl -s https://malkodent.com/ | grep -i 'application/ld+json' -A5

---

If you want, I can immediately convert this into a single sprint backlog (Jira-style tickets with descriptions, acceptance criteria, test commands, and estimated sprint capacity). Provide the requested validation outputs and I will produce the deterministic, per-URL patch list and a final "Production Ready" verdict.