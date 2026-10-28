// components/site-cockpit/NextStepBanner.tsx
"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Link2, ListChecks } from "lucide-react";
import type { ConnectionStatus } from "./cards/wordpress/types";

interface NextStepBannerProps {
  siteId: string;
  locale: string;
  connectionStatus: ConnectionStatus;
  cmsType: string;
  criticalIssues: number;
  warnings: number;
}

type Step = {
  tone: "action" | "ok";
  icon: typeof Link2;
  title: string;
  detail: string;
  cta?: { label: string } & ({ href: string } | { onClick: () => void });
};

function scrollToConnection() {
  document
    .getElementById("connection-card")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * One sentence, one button: the single most useful thing to do next on this site.
 * Not connected → connect. Connected with open issues → review and fix them.
 * Connected and clean → say so.
 */
export function NextStepBanner({
  siteId,
  locale,
  connectionStatus,
  cmsType,
  criticalIssues,
  warnings,
}: NextStepBannerProps) {
  const issues = criticalIssues + warnings;
  const analyzeHref = `/${locale}/dashboard/sites/${siteId}/analyze`;

  let step: Step;
  if (connectionStatus !== "connected") {
    const wp = cmsType === "wordpress";
    step = {
      tone: "action",
      icon: Link2,
      title: wp ? "Connect WordPress to unlock fixes" : "Connect your site to unlock fixes",
      detail:
        issues > 0
          ? `We found ${issues} thing${issues === 1 ? "" : "s"} to improve. Connecting takes about two minutes and lets us fix what can be fixed automatically.`
          : "Analysis works without a connection. Connecting lets us apply fixes and keep watching your site.",
      cta: { label: "Connect now", onClick: scrollToConnection },
    };
  } else if (issues > 0) {
    step = {
      tone: "action",
      icon: ListChecks,
      title: `${issues} issue${issues === 1 ? "" : "s"} to review`,
      detail:
        criticalIssues > 0
          ? `${criticalIssues} critical. Review them and approve the fixes you want applied.`
          : "Review them and approve the fixes you want applied.",
      cta: { label: "Review issues", href: analyzeHref },
    };
  } else {
    step = {
      tone: "ok",
      icon: CheckCircle,
      title: "Nothing needs your attention",
      detail: "Your site is connected and no open issues were found.",
    };
  }

  const Icon = step.icon;
  const accent = step.tone === "ok" ? "var(--category-performance)" : "var(--color-primary-500)";

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
      style={{
        borderColor: `oklch(from ${accent} l c h / 0.45)`,
        background: `oklch(from ${accent} l c h / 0.08)`,
      }}
    >
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `oklch(from ${accent} l c h / 0.15)`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>
          Next step
        </div>
        <div className="mt-0.5 text-base font-semibold" style={{ color: "var(--text-default)" }}>
          {step.title}
        </div>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-subtle)" }}>
          {step.detail}
        </p>
      </div>
      {step.cta &&
        ("href" in step.cta ? (
          <Link
            href={step.cta.href}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5"
            style={{ borderColor: accent, color: accent }}
          >
            {step.cta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={step.cta.onClick}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5"
            style={{ borderColor: accent, color: accent }}
          >
            {step.cta.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        ))}
    </div>
  );
}
