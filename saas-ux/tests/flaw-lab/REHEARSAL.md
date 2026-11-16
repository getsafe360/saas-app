# Flaw lab rehearsal (johnlaw.com)

The flaw lab seeds known, harmless flaws into a **test** WordPress site so GetSafe 360's
scan → fix → verify → undo routine can be rehearsed before it runs on customer sites.

| File | What it is |
|------|------------|
| `gs360-flaw-lab.php` | Must-use plugin that seeds and resets the flaws (WP-CLI or Tools → GetSafe 360 Flaw Lab) |
| `expected.json` | Each flaw, the findings it must cause, its fixer, and what must hold after the fix and after undo |
| `integration-test.php` | Seeds and resets every flaw in a local WordPress (run by `tests/wp-plugin/integration/run.sh`) |

`lib/engine/flaw-lab.test.ts` fails when a rule or fixer named in `expected.json` changes, so the
manifest cannot drift from the engine.

---

## 1. Before the first rehearsal

- [ ] johnlaw.com runs the connector **1.13.1** and shows **Connected** (if it shows "Not recognised": Disconnect, then connect again from the dashboard).
- [ ] WP Toolkit → johnlaw.com → **Back up / Restore** → create a backup named `before-flaw-lab`. This is the way back if anything goes wrong.
- [ ] Settings → Reading → "Discourage search engines" is **off**.
- [ ] No `robots.txt` file in `httpdocs` (WordPress must write it; the AI crawler fix needs that).
- [ ] WordPress runs at the domain root, not in a subfolder.
- [ ] Page caching is off or purged after every step (Plesk: nginx caching for the domain; any cache plugin).
- [ ] WP-CLI available: SSH with `wp`, or WP Toolkit's WP-CLI. Without it use **Tools → GetSafe 360 Flaw Lab**.

## 2. Install the lab

1. Plesk File Manager → `httpdocs/wp-content/mu-plugins/` (create the folder if missing) → upload `gs360-flaw-lab.php`.
2. Edit `httpdocs/wp-config.php`, above `/* That's all, stop editing! */`:
   ```php
   define('GS360_FLAW_LAB', true);
   ```
3. Check: `wp gs360-lab status` lists 16 flaws, none seeded; wp-admin shows a yellow "Flaw Lab is active" notice.

Optional, Plesk Git (keeps the lab current without uploads): add the `getsafe360/saas-app` repository
in Plesk → Git with a deployment path **outside** `httpdocs` (e.g. `saas-app-repo`), and this additional
deployment action, so only the lab file reaches WordPress:
`mkdir -p httpdocs/wp-content/mu-plugins && cp saas-app-repo/saas-ux/tests/flaw-lab/gs360-flaw-lab.php httpdocs/wp-content/mu-plugins/`

## 3. Baseline scan (nothing seeded)

- [ ] Dashboard → johnlaw.com → run a full analysis and open **AI search & visibility** (SEO crawl).
- [ ] Compare with `expected.json` → `baseline.findings`. Write down every finding that is **not** in that list, and every baseline finding that is missing (the site may already have fixed it). These are the noise you subtract in each round.

## 4. One round per category

Run the categories in this order: **geo, seo, accessibility, performance, security, stability**, then the opt-in **core** and **plugins**.

```
wp gs360-lab reset
wp gs360-lab seed <category>      # e.g. wp gs360-lab seed geo
```

For every flaw of the category, follow its entry in `expected.json`:

| Step | Check |
|------|-------|
| **Scan** | Re-run the analysis (page scan for `home`, AI search & visibility for `crawl`, connector refresh for `connector`). Every rule in `findings` shows as failing or warning. |
| **Expected only** | No new finding beyond `findings` + your baseline notes. Anything extra is a bug in a rule or in the lab: note it. |
| **Fix** | `auto`: apply it from the fix list (Copilot / Applied changes). `click`: confirm the connector action. `manual`: no fix; skip to Reset. |
| **Verify** | The app's own verify step passes, a fresh scan shows the finding passing, and the site matches `afterFix` (view source / response headers / robots.txt). |
| **Undo** | Applied changes → Undo. A permanent fixer must show **no** Undo button. |
| **Verify undo** | A fresh scan shows the finding again and the site matches `afterUndo`. |
| **Reset** | `wp gs360-lab reset`; a fresh scan no longer shows the finding (this proves `manual` findings clear when the cause is gone). |

Notes per category:

- **geo**: `ai-search-blocked` replaces robots.txt with "block everyone except Google and Bing". After the fix, `/robots.txt` keeps that block and ends with a "GetSafe 360 AI" section naming the AI search crawlers. `thin-content` only fires when thin pages are more than half of the crawled inner pages; on a site with many long pages it may pass. Note it if so.
- **seo**: the lab home page becomes the static front page while seeded (the old front page comes back on reset). For `multiple-h1`, compare the demoted headings visually before and after the fix: same size and weight. `sitemap-off` is seeded only by name (`wp gs360-lab seed sitemap-off`), on its own round, because it switches off the `noindex-in-sitemap` check.
- **stability**: `expired-transients` is fixed permanently. Applied changes shows it without Undo.
- **core** (opt-in): writes `wp-includes/gs360-flaw-lab-unexpected.php` and appends a comment to `wp-admin/includes/continents-cities.php`. Both fixers keep a restore point; reset puts the original file back byte for byte.
- **plugins** (opt-in): installs and activates Hello Dolly 1.6 from wordpress.org. Reset deletes it. It refuses if Hello Dolly is already installed.

## 5. Log

Copy this table per round into the rehearsal notes:

| Flaw | Findings seen | Unexpected findings | Fix applied | Verify | Undo | Verify undo | Reset clean | Notes |
|------|---------------|--------------------|-------------|--------|------|-------------|-------------|-------|
| | | | | | | | | |

A round is **passed** when every column is ✅ for every flaw of the category.

## 6. Finish

- [ ] `wp gs360-lab reset` (or **Reset everything** on the Tools page).
- [ ] Remove `define('GS360_FLAW_LAB', true);` from wp-config.php and delete `wp-content/mu-plugins/gs360-flaw-lab.php`. Without the constant the file does nothing, but leaving it on a public site is untidy.
- [ ] If anything looks off, restore the `before-flaw-lab` backup in WP Toolkit.

## Not seeded on purpose

See `expected.json` → `notSeeded`: vulnerable plugins, open administrator registration, WP_DEBUG,
compression, object cache and mass revisions are either unsafe on a public site or set outside
WordPress.
