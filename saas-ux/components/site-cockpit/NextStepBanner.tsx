// components/site-cockpit/NextStepBanner.tsx
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Link2,
  ListChecks,
  Loader2,
  ScanSearch,
} from "lucide-react";
import type { ConnectionStatus } from "./cards/wordpress/types";
import type { StoredScan } from "@/lib/cockpit/stored";
import type { SiteScanState } from "@/lib/cockpit/useSiteScan";

interface NextStepBannerProps {
  siteId: string;
  locale: string;
  connectionStatus: ConnectionStatus;
  cmsType: string;
  /** Latest finished scan, or null if the site was never scanned. */
  scan: StoredScan | null;
  scanState: SiteScanState;
  onScan: () => void;
}

type Cta = { label: string } & ({ href: string } | { onClick: () => void });

type Step = {
  tone: "action" | "ok" | "warn" | "busy";
  icon: typeof Link2;
  title: string;
  detail: string;
  cta?: Cta;
};

function scrollToConnection() {
  document
    .getElementById("connection-card")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * One sentence, one button: the most useful thing to do next on this site.
 * Never scanned → scan. Scan found things → connect (to fix) or review (if connected).
 * Scan clean → say so.
 */
export function NextStepBanner({
  siteId,
  locale,
  connectionStatus,
  cmsType,
  scan,
  scanState,
  onScan,
}: NextStepBannerProps) {
  const connected = connectionStatus === "connected";
  const reportHref = scan
    ? `/${locale}/dashboard/sites/${siteId}/analyze?job=${encodeURIComponent(scan.jobId)}`
    : `/${locale}/dashboard/sites/${siteId}/analyze`;
  const connectCta: Cta = { label: "Connect now", onClick: scrollToConnection };

  let step: Step;
  if (scanState.phase === "running") {
    step = {
      tone: "busy",
      icon: Loader2,
      title: "Scanning your site…",
      detail: "Checking SEO, performance, accessibility and security. This takes about 30 seconds.",
    };
  } else if (scanState.phase === "error") {
    step = {
      tone: "warn",
      icon: AlertTriangle,
      title: "The scan didn't finish",
      detail: scanState.message,
      cta: { label: "Try again", onClick: onScan },
    };
  } else if (!scan) {
    step = {
      tone: "action",
      icon: ScanSearch,
      title: "Run your first scan",
      detail:
        "A full check of SEO, performance, accessibility and security, with a list of what to fix. It works without connecting your site.",
      cta: { label: "Run scan", onClick: onScan },
    };
  } else if (scan.issueCount > 0 && !connected) {
    const wp = cmsType === "wordpress";
    step = {
      tone: "action",
      icon: Link2,
      title: `${scan.issueCount} ${plural(scan.issueCount, "issue", "issues")} found`,
      detail:
        scan.fixableCount > 0
          ? `${scan.fixableCount} can be fixed automatically once you connect ${wp ? "WordPress" : "your site"}. The rest come with step-by-step advice.`
          : "These come with step-by-step advice. Connecting also lets us keep watching your site.",
      cta: connectCta,
    };
  } else if (scan.issueCount > 0) {
    step = {
      tone: "action",
      icon: ListChecks,
      title: `${scan.issueCount} ${plural(scan.issueCount, "issue", "issues")} to review`,
      detail: "Review them and approve the fixes you want applied.",
      cta: { label: "Review issues", href: reportHref },
    };
  } else if (!connected) {
    step = {
      tone: "ok",
      icon: CheckCircle,
      title: "No issues found",
      detail: "Connect your site to keep watching it and to apply fixes later.",
      cta: connectCta,
    };
  } else {
    step = {
      tone: "ok",
      icon: CheckCircle,
      title: "Nothing needs your attention",
      detail: "Your site is connected and the last scan found no issues.",
    };
  }

  const Icon = step.icon;
  const accent =
    step.tone === "ok"
      ? "var(--category-performance)"
      : step.tone === "warn"
        ? "var(--status-warning, #f59e0b)"
        : "var(--color-primary-500)";

  const ctaClass =
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5";

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
      style={{
        borderColor: `oklch(from ${accent} l c h / 0.45)`,
        background: `oklch(from ${accent} l c h / 0.08)`,
      }}
      aria-live="polite"
    >
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `oklch(from ${accent} l c h / 0.15)`, color: accent }}
      >
        <Icon className={`h-5 w-5 ${step.tone === "busy" ? "animate-spin" : ""}`} />
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
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        {step.cta &&
          ("href" in step.cta ? (
            <Link href={step.cta.href} className={ctaClass} style={{ borderColor: accent, color: accent }}>
              {step.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={step.cta.onClick}
              className={ctaClass}
              style={{ borderColor: accent, color: accent }}
            >
              {step.cta.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ))}
        {scan && scanState.phase === "idle" && (
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
            {scan.issueCount > 0 && !connected && (
              <Link href={reportHref} className="underline underline-offset-2 hover:opacity-80">
                View report
              </Link>
            )}
            <button type="button" onClick={onScan} className="cursor-pointer underline underline-offset-2 hover:opacity-80">
              Scan again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
