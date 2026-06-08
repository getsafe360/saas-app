// saas-ux/app/[locale]/docs/layout.tsx
// Docs section layout — i18n content added as sections are completed at MVP launch.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Link } from "@/navigation";

export const metadata: Metadata = {
  title: {
    template: "%s – GetSafe 360 AI Docs",
    default: "Documentation – GetSafe 360 AI",
  },
  description:
    "Guides, references, and tutorials for the GetSafe 360 AI platform.",
};

const navItems = [
  { label: "Overview", href: "/docs" },
  { label: "WordPress Connector", href: "/docs/wordpress-connector" },
  { label: "Getting Started", href: "/docs/getting-started", soon: true },
  { label: "REST API", href: "/docs/api", soon: true },
  { label: "Security", href: "/docs/security", soon: true },
  { label: "Performance", href: "/docs/performance", soon: true },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar */}
        <aside className="lg:w-56 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
            Documentation
          </p>
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <span key={item.href} className="flex items-center gap-2">
                {item.soon ? (
                  <span className="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500 select-none">
                    {item.label}
                    <span className="ml-2 text-xs bg-slate-100 dark:bg-white/10 text-slate-400 rounded px-1.5 py-0.5">
                      soon
                    </span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="px-2 py-1.5 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors w-full"
                  >
                    {item.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
