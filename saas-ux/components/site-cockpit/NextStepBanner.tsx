// components/site-cockpit/NextStepBanner.tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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

const SEVERITY_DOT: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#94a3b8",
};


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
  const t = useTranslations("SiteCockpit.nextStep");
  const tFindings = useTranslations("Findings");
  // Stored scan issues carry English titles; show them in the user's language by check id.
  const issueTitle = (issue: { id: string; title: string }) =>
    tFindings.has(`${issue.id}.title`) ? tFindings(`${issue.id}.title`) : issue.title;
  const connected = connectionStatus === "connected";
  const reportHref = scan
    ? `/${locale}/dashboard/sites/${siteId}/analyze?job=${encodeURIComponent(scan.jobId)}`
    : `/${locale}/dashboard/sites/${siteId}/analyze`;
  const connectCta: Cta = { label: t("cta.connect"), onClick: scrollToConnection };

  let step: Step;
  if (scanState.phase === "running") {
    step = {
      tone: "busy",
      icon: Loader2,
      title: t("scanning.title"),
      detail: t("scanning.detail"),
    };
  } else if (scanState.phase === "error") {
    step = {
      tone: "warn",
      icon: AlertTriangle,
      title: t("failed.title"),
      detail: scanState.message,
      cta: { label: t("cta.tryAgain"), onClick: onScan },
    };
  } else if (!scan) {
    step = {
      tone: "action",
      icon: ScanSearch,
      title: t("firstScan.title"),
      detail: t("firstScan.detail"),
      cta: { label: t("cta.runScan"), onClick: onScan },
    };
  } else if (scan.issueCount > 0 && !connected) {
    const wp = cmsType === "wordpress";
    step = {
      tone: "action",
      icon: Link2,
      title: t("found.title", { count: scan.issueCount }),
      detail:
        scan.fixableCount > 0
          ? t("found.fixable", { count: scan.fixableCount, target: wp ? "wordpress" : "site" })
          : t("found.advice"),
      cta: connectCta,
    };
  } else if (scan.issueCount > 0) {
    step = {
      tone: "action",
      icon: ListChecks,
      title: t("review.title", { count: scan.issueCount }),
      detail: t("review.detail"),
      cta: { label: t("cta.review"), href: reportHref },
    };
  } else if (!connected) {
    step = {
      tone: "ok",
      icon: CheckCircle,
      title: t("noIssues.title"),
      detail: t("noIssues.detail"),
      cta: connectCta,
    };
  } else {
    step = {
      tone: "ok",
      icon: CheckCircle,
      title: t("allGood.title"),
      detail: t("allGood.detail"),
    };
  }

  const Icon = step.icon;
  const top = scan && scanState.phase === "idle" && scan.issueCount > 0 ? (scan.top ?? []) : [];
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
          {t("eyebrow")}
        </div>
        <div className="mt-0.5 text-base font-semibold" style={{ color: "var(--text-default)" }}>
          {step.title}
        </div>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-subtle)" }}>
          {step.detail}
        </p>
        {top.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold" style={{ color: "var(--text-subtle)" }}>
              {t("topThings", { count: top.length })}
            </div>
            <ol className="mt-1.5 space-y-1">
              {top.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={reportHref}
                    className="flex cursor-pointer items-center gap-2 text-sm hover:underline"
                    style={{ color: "var(--text-default)" }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SEVERITY_DOT[issue.severity] }}
                      title={t(`severity.${issue.severity}`)}
                    />
                    <span className="min-w-0 truncate">{issueTitle(issue)}</span>
                    {issue.fixAvailable && (
                      <span
                        className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ borderColor: accent, color: accent }}
                      >
                        {t("autoFix")}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
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
