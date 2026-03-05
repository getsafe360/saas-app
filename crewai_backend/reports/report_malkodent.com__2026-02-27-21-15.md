# Malkodent.com — WordPress Security & Operability Deployment Report

Date: 2026-02-27  
Source: wordpress_security_operability_audit_v1 (remote-passive)  
Overall site score: 58 / 100

This report synthesizes the module outputs into a prioritized remediation plan, explicit blockers, validation checklist and a short verdict on production deployment readiness. Many findings are low-confidence because the audit was agentless and unauthenticated; all items marked "manual verification required" must be validated from staging/host access before production changes.

---

## Executive summary (one-line)
Not safe to perform bulk production updates or major configuration changes until P1 repairs (backups, inventory, staged updates, admin hardening, sensitive file check, logging) are completed and the validation checks pass. Address immediate P1 tasks in the order below, then re-run validation checks V-01..V-08.

---

## Highest-priority risks (top items from findings)
- F-10 (Critical): Possible public exposure of wp-config/.env or webroot backups — worst impact if true. Priority: P1.
- F-01 / F-02 (High): Unknown WP core, plugins, and versions — could be vulnerable. Priority: P1.
- F-04 (High): Backups & restore process unknown — must be verified before updates. Priority: P1.
- F-07 / F-12 (High): Login protection (MFA, rate-limiting) unknown and monitoring/logging absent — increases compromise dwell time and risk from brute-force. Priority: P1.
- F-05 (High): TLS / HTTP->HTTPS redirect verification required. Priority: P1.
Other P2/P3 items (CSP, XML-RPC, REST user enumeration, CDN/caching) follow after P1s.

---

## Prioritized repairs (ordered execution plan with owners, effort, and acceptance criteria)

Priority ordering is driven by minimizing blast radius for updates and closing immediate attack vectors.

1) R-01 — Create immediate full backup and test restore (Owner: Site Admin / Hosting Ops)
   - Priority: P1 — Estimated effort: 1–3 hours
   - Steps (abbreviated): maintenance mode → DB dump → archive wp-content + themes/plugins → store encrypted offsite with retention → restore to staging and validate (login, key flows).
   - Acceptance criteria:
     - Full DB and filesystem backup stored offsite and verified (checksum).
     - Successful restore to staging validated by functional tests within documented restore-time SLA.
   - Why first: restore point required before any changes.

2) R-02 — Inventory plugins, themes and core versions in staging (Owner: Platform Engineer / Dev)
   - Priority: P1 — Effort: 2–6 hours
   - Steps: use WP-CLI to export plugin/theme/core versions; map to CVEs using WPScan/NVD.
   - Acceptance criteria:
     - Complete CSV/JSON inventory of core + all plugins + themes.
     - Critical CVEs flagged and assigned remediation tasks.

3) R-03 — Update WP core, plugins and active theme in staging; test then deploy to production (Owner: DevOps / Dev)
   - Priority: P1 — Effort: 2–8 hours (depends)
   - Steps: incremental updates in staging with regression tests; schedule production maintenance window for the same order.
   - Acceptance criteria:
     - Staging updates applied with no critical regressions; automated and manual regressions passed.
     - Production updates applied in maintenance window with monitoring for 24–72 hours.

4) R-07 — Ensure no sensitive files are web-accessible (Owner: Platform Engineer)
   - Priority: P1 — Effort: 1–2 hours
   - Steps: scan webroot for .sql/.zip/.env; remove public backups; add webserver deny rules for wp-config.php/.env.
   - Acceptance criteria:
     - HTTP access attempts to /wp-config.php and /.env return 403/404.
     - No backup artifacts remain in webroot.

5) R-04 — Enable MFA and rate-limiting for admin users (Owner: Security / Site Admin)
   - Priority: P1 — Effort: 1–3 hours
   - Steps: configure MFA plugin or host IAM; implement WAF throttling/blocklist for login endpoints.
   - Acceptance criteria:
     - MFA enforced for all admin users.
     - Login attempts are rate-limited or blocked; automated brute-force attempt shows progressive delays or blocks.

6) R-08 — Implement centralized logging, file integrity monitoring and alerting (Owner: Platform/SEC Ops)
   - Priority: P1 — Effort: 4–16 hours
   - Steps: ship logs to ELK/CloudWatch/Datadog; enable FIM on wp-content/uploads; create alerts for anomalous events.
   - Acceptance criteria:
     - Webserver/PHP logs visible in logging UI within last 24 hours.
     - Alerts configured for failed-logins spike, file-changes, and high error rates.

7) R-05 — Harden server and application security headers (Owner: Platform Engineer)
   - Priority: P2 — Effort: 1–2 hours
   - Steps: add X-Frame-Options, X-Content-Type-Options, Referrer-Policy, deploy CSP in report-only then enforce.
   - Acceptance criteria:
     - Headers present in HTTP responses (initially CSP report-only); CSP tuned to avoid breaking site.

8) R-06 — Disable or restrict XML-RPC if unused (Owner: Platform Engineer)
   - Priority: P2 — Effort: 0.5–1 hour
   - Acceptance criteria:
     - /xmlrpc.php returns 403 if not required; if required, restricted and monitored.

9) R-10 — Implement regular vulnerability scanning and scheduled maintenance (Owner: Platform/DevOps)
   - Priority: P2 — Effort: 2–4 hours to configure; ongoing
   - Acceptance criteria:
     - Monthly authenticated scans scheduled; scan results feed into ticketing.

10) R-09 — Add CDN and caching with purge strategy (Owner: Platform Engineer)
    - Priority: P3 — Effort: 2–6 hours
    - Acceptance criteria:
      - CDN configured with SSL; dynamic endpoints not cached; purge working.

Notes:
- Do NOT perform any bulk production updates before R-01 (backups) and R-02 (inventory) are complete.
- Apply changes first in staging only.

---

## Blockers (what must be resolved before production deployment/major updates)
1. No validated backups and no tested restore process (R-01) — major blocker.
2. No authenticated inventory of core/plugins/themes (R-02) — prevents safe patch planning.
3. Unknown presence of sensitive files/backups in webroot (F-10) — critical blocker until confirmed/removed.
4. Absence of enforced admin protections (MFA/rate-limiting) and lack of logging/alerting (R-04/R-08) — increases risk during and after change.
5. TLS, security headers, and REST/XML-RPC exposures not verified remotely (F-05, F-06, F-08, F-09) — must be checked and fixed.
6. Lack of staging environment mirroring production — needed to safely test updates.

Until blockers 1–4 are closed and their validations pass, production deployment of updates or configuration changes is not recommended.

---

## Validation checklist (run after repairs in staging; map to validation checks V-01..V-08)
These must be executed from an environment with network access and staging/host authenticated access where required.

- V-01: TLS & redirect & security headers
  - Commands: curl -I -L https://malkodent.com ; openssl s_client -connect malkodent.com:443 -servername malkodent.com
  - Pass criteria: HTTPS returns 200; port 80 redirects 301 to HTTPS; cert valid; HSTS present (includeSubDomains recommended); security headers present (X-Frame-Options, X-Content-Type-Options, Referrer-Policy). CSP at least report-only.

- V-02: Confirm WP core, plugin and theme versions in staging
  - Commands: wp core version; wp plugin list; wp theme list
  - Pass criteria: Inventory documented; no critical CVEs active; critical items scheduled/updated.

- V-03: Test backup and restore
  - Commands: mysqldump; tar backup; restore to staging
  - Pass criteria: Staging restored and operational; documented restore time/SLA.

- V-04: Validate admin auth protections
  - Commands: repeated failed login attempts; confirm MFA
  - Pass criteria: Rate-limiting triggered; MFA prompts for admin; emergency recovery documented.

- V-05: Check xmlrpc.php
  - Commands: curl -I https://malkodent.com/xmlrpc.php ; targeted xmlrpc method calls
  - Pass criteria: xmlrpc disabled (403/404) if unused; otherwise restricted to necessary methods and authenticated.

- V-06: Check REST API user enumeration
  - Commands: curl https://malkodent.com/wp-json/wp/v2/users ; curl -I https://malkodent.com/?author=1
  - Pass criteria: REST users not publicly exposed; author pages don't reveal raw usernames.

- V-07: Search for public backups/sensitive files
  - Commands: curl -I https://malkodent.com/wp-config.php ; find /var/www/html -type f -iname '*.sql' -o -iname '*.zip'
  - Pass criteria: wp-config.php and .env are not retrievable via HTTP; no .sql/.zip backups in webroot.

- V-08: Confirm logging collection and alerting
  - Commands: check logging agent status; verify log ingestion/alerts in UI
  - Pass criteria: logs ingested in last 24 hours; alerts configured for critical events.

All validation checks must pass in staging and then be re-run after production rollout to confirm parity.

---

## Production deployment readiness verdict (explicit)
Not Ready (Conditional): Production deployment of bulk updates or configuration changes is NOT recommended at this time.

Conditions required to move to "Ready":
- R-01 (full backup and tested restore) completed and validated.
- R-02 (full inventory of core/plugins/themes) completed; any critical vulnerabilities identified and prioritized.
- R-03 (staged updates) completed with successful regression testing.
- R-07 (no sensitive public files) confirmed and remediated.
- R-04 (MFA + rate-limiting) enabled for admin accounts.
- R-08 (logging and file integrity monitoring) enabled and confirmed.
- V-01..V-08 validation checks executed and passed in staging; critical failures remediated.
Once the above are complete and validated, production maintenance window may be scheduled for incremental updates. After production changes, re-run V-01..V-08 and maintain heightened monitoring for 72 hours.

Estimated minimum time to reach "Ready" state: 1–3 business days (if resources are available and no complex plugin incompatibilities are found); could extend to multiple days if significant vulnerabilities or compatibility issues exist.

---

## Short remediation timeline & owners (recommended sequence)
Day 0 (within 0–6 hours)
- R-01 (backup) — Site Admin / Hosting Ops
- R-07 (remove public backups) — Platform Engineer

Day 0–1
- R-02 (inventory) — Platform Engineer / Dev
- V-07 validation of file exposures — Platform Engineer

Day 1–2
- R-03 (staged updates) — DevOps / Dev (incremental)
- R-04 (MFA/rate-limiting) — Security / Site Admin

Day 2–4
- R-08 (logging/alerting) — Platform/SEC Ops
- R-05 (security headers) — Platform Engineer
- V-01..V-06, V-08 validation runs across staging

Day 4+ (conditional)
- Maintenance window and production update rollout if all validations pass; monitoring and rollback readiness.

---

## Rollback & emergency plan (summary)
- Always create backups before change. Use R-01 backup set as rollback baseline.
- Rollback options:
  - Revert updated plugin(s)/theme via WP-CLI using the backup or previous plugin packages.
  - Restore full site from pre-change backup to staging first to validate, then restore production if required.
- Communication: Notify stakeholders of maintenance window start/stop, and have contact list for emergency rollback decision-makers.

---

## Quick wins (low-effort, high-value)
- Immediately enable MFA for admin users (R-04).
- Remove any obvious webroot backups (.zip/.sql/.env) if found (R-07).
- Put the site into a brief maintenance mode while R-01 backups are created.
- Add basic security headers at CDN/webserver (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) in non-breaking mode.

---

## Acceptance criteria for passing audit (minimum set)
- Valid backup and tested restore (R-01 + V-03).
- Inventory captured and no outstanding critical CVEs (R-02 + V-02).
- Admin MFA enabled and login rate-limiting effective (R-04 + V-04).
- No web-accessible sensitive files or backups (R-07 + V-07).
- Logging + FIM active and alerts configured (R-08 + V-08).
- TLS properly configured and security headers present (V-01).
When all above pass, site can be classified as "Operationally hardened" and eligible for scheduled production updates.

---

## Final recommendations (next immediate actions)
1. Stop here and execute R-01 and R-07 immediately (within next maintenance window). These are non-negotiable prerequisites.
2. Create a staging environment mirroring production if not present, and perform R-02 inventory there.
3. Triage plugin/theme updates: apply to staging (R-03), test, then schedule production rollouts.
4. Enable MFA and rate-limiting (R-04) before production updates.
5. Implement logging and alerts (R-08) so that post-change anomalies are visible.
6. After each remediation phase, run the matching validation checks V-01..V-08 and document results.

---

If you want, I will:
- Produce a one-page checklist for the operations team to use during the maintenance window (step-by-step runbook).
- Generate a timeline Gantt with estimated hours and owner assignments.
- Draft incident response escalation templates for post-deployment anomalies.

Which of those would you like next?