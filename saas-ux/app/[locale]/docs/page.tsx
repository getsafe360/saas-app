// saas-ux/app/[locale]/docs/page.tsx
// Docs landing — English only until full i18n at MVP launch.
import type { Metadata } from "next";
import { Link } from "@/navigation";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Learn how to connect your site to GetSafe 360 AI, use the WordPress plugin, access the REST API, and configure automated optimizations.",
};

const sections = [
  {
    title: "WordPress Connector",
    href: "/docs/wordpress-connector",
    description:
      "Install the GetSafe 360 AI Connector plugin, pair your WordPress site using a 6-digit code, and enable AI-powered repairs from your dashboard.",
    badge: "Popular",
  },
  {
    title: "Getting Started",
    href: null,
    description:
      "Set up your first site, run an initial analysis, and understand the four optimization pillars: SEO, Performance, Security, and Accessibility.",
    badge: "Soon",
  },
  {
    title: "REST API Reference",
    href: null,
    description:
      "Connect non-WordPress sites via REST API keys. Push findings, pull diagnostics, and integrate GetSafe 360 AI into your own workflows.",
    badge: "Soon",
  },
  {
    title: "Security Features",
    href: null,
    description:
      "Learn about security header scanning, XSS protection checks, HTTPS enforcement, and how automated repair actions work.",
    badge: "Soon",
  },
  {
    title: "Performance Optimization",
    href: null,
    description:
      "Core Web Vitals monitoring, image optimization suggestions, caching strategies, and load time analysis explained.",
    badge: "Soon",
  },
  {
    title: "Accessibility (WCAG)",
    href: null,
    description:
      "WCAG 2.1/2.2 compliance audits, automated fixes for common a11y issues, and how to review findings with your team.",
    badge: "Soon",
  },
];

export default function DocsPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          GetSafe 360 AI Documentation
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400 max-w-2xl">
          Everything you need to connect your site, run AI-powered optimizations,
          and maintain top-tier SEO, performance, security, and accessibility.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {s.title}
              </h2>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  s.badge === "Popular"
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                    : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                }`}
              >
                {s.badge}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 flex-1">
              {s.description}
            </p>
            {s.href ? (
              <Link
                href={s.href}
                className="mt-1 text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline"
              >
                Read guide →
              </Link>
            ) : (
              <span className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
