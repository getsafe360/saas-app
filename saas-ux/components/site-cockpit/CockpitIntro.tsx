// components/site-cockpit/CockpitIntro.tsx
//
// The welcome text and the six benefit tiles that used to open the cockpit. They were
// removed from the page to cut clutter but are kept here, unused, so they can become
// an info popup or a first-visit hint later. Copy is English-only until the cockpit
// translations pass.

const COCKPIT_CATEGORIES = [
  { key: "performance", label: "Performance", benefit: "Speed and Core Web Vitals that lift rankings and reduce bounce rate" },
  { key: "security",    label: "Security",    benefit: "HTTP headers, HTTPS, and vulnerability fixes that protect users and build trust" },
  { key: "seo",        label: "SEO",         benefit: "On-page signals, structured data, and metadata that drive sustainable organic growth" },
  { key: "a11y",       label: "Accessibility", benefit: "WCAG compliance that opens your site to every visitor and mitigates legal risk" },
  { key: "content",    label: "Content",     benefit: "Readability, keyword alignment, and structure that keeps readers engaged" },
  { key: "cms",        label: "CMS",         benefit: "WordPress-specific diagnostics, plugin management, and deep performance tuning" },
] as const;

export function CockpitIntro() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-default)" }}
        >
          Welcome to your AI-powered website intelligence cockpit.
        </h2>
        <p
          className="text-sm leading-relaxed max-w-3xl"
          style={{ color: "var(--text-subtle)" }}
        >
          Monitor and improve the critical systems that influence rankings,
          conversions, trust, accessibility, and user experience. Each
          category can be analyzed in depth to surface hidden inefficiencies,
          technical risks, and missed growth opportunities.{" "}
          <span style={{ color: "var(--text-default)" }}>
            Press Optimize to let the AI fix issues automatically and keep
            your site running at peak performance.
          </span>
        </p>
      </div>

      {/* Category benefit cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {COCKPIT_CATEGORIES.map(({ key, label, benefit }) => (
          <div
            key={key}
            className="rounded-xl border px-3 py-2.5 space-y-0.5"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--header-bg)",
            }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--text-default)" }}
            >
              {label}
            </p>
            <p
              className="text-[11px] leading-snug"
              style={{ color: "var(--text-subtle)" }}
            >
              {benefit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
