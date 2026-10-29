// components/site-cockpit/SiteCockpitLoader.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SiteCockpit } from "./SiteCockpit";
import { OverallScoreHero } from "./OverallScoreHero";
import { NextStepBanner } from "./NextStepBanner";
import { useSiteScan } from "@/lib/cockpit/useSiteScan";
import type { StoredSiteState } from "@/lib/cockpit/stored";
import { getScoreGrade } from "@/lib/cockpit/transform-api-data";
import { transformToSiteCockpitResponse } from "@/lib/cockpit/transform-api-data";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type { ConnectionStatus } from "./cards/wordpress/types";
import type { PlanName } from "@/lib/plans/config";

interface SiteCockpitLoaderProps {
  siteId: string;
  siteUrl: string;
  siteSummary?: string;
  wordpressConnectionStatus?: ConnectionStatus;
  wordpressLastConnected?: string;
  wordpressOnly?: boolean;
  wpVersion?: string;
  pluginVersion?: string;
  planName?: PlanName;
  /** What earlier visits and scans saved; lets the page show numbers before the live check ends. */
  stored?: StoredSiteState;
  /** CMS saved on the site, if one was detected before. */
  storedCms?: string | null;
}

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className ?? ""}`}
      style={{ background: "var(--border-default)" }}
    />
  );
}

function CockpitSkeleton({ domain }: { domain: string }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background-default)" }}>
      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* h1 placeholder */}
        <SkeletonBox className="h-4 w-52" />

        {/* Row 1: site info + score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Site info panel */}
          <div
            className="lg:col-span-2 rounded-2xl border p-4"
            style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
          >
            <div className="grid grid-cols-3 gap-4 items-center">
              <SkeletonBox className="col-span-1 aspect-[4/3]" />
              <div className="col-span-2 space-y-3">
                <SkeletonBox className="h-7 w-44" />
                <SkeletonBox className="h-4 w-28" />
                <SkeletonBox className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>

          {/* Score arc panel — shows "Running first diagnosis…" */}
          <div
            className="rounded-2xl border p-4 flex flex-col items-center justify-center gap-4"
            style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
          >
            {/* Mimics the full-circle gauge while loading */}
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="var(--border-default)"
                  strokeWidth="10"
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2
                  className="h-7 w-7 animate-spin"
                  style={{ color: "var(--color-primary-500)" }}
                />
              </div>
            </div>
            <p
              className="text-sm font-medium text-center"
              style={{ color: "var(--text-subtle)" }}
            >
              Running first diagnosis…
            </p>
          </div>
        </div>

        {/* Row 2: category arcs row */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
        >
          <SkeletonBox className="h-3 w-28 mb-5" />
          <div className="flex items-center justify-around gap-4 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <SkeletonBox className="h-14 w-14 rounded-full" />
                <SkeletonBox className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ago(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return rtf.format(-Math.max(minutes, 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/** Saved numbers shown right away while the live analysis runs. */
function StoredPreview({
  stored,
  storedCms,
  siteUrl,
  locale,
  siteId,
  connectionStatus,
  scanState,
  onScan,
}: {
  stored: StoredSiteState;
  storedCms?: string | null;
  siteUrl: string;
  locale: string;
  siteId: string;
  connectionStatus: ConnectionStatus;
  scanState: ReturnType<typeof useSiteScan>["state"];
  onScan: () => void;
}) {
  const scores = stored.scores!;
  let domain = siteUrl;
  try { domain = new URL(siteUrl).hostname; } catch {}
  const checked = ago(stored.checkedAt, locale);
  const summary = {
    overallScore: scores.overall,
    grade: getScoreGrade(scores.overall),
    categoryScores: {
      performance: scores.performance ?? 0,
      security: scores.security ?? 0,
      seo: scores.seo ?? 0,
      accessibility: scores.accessibility ?? 0,
      content: scores.content as number,
    },
    strengths: [],
    passed: stored.counts?.passed ?? 0,
    warnings: stored.counts?.warnings ?? 0,
    criticalIssues: stored.counts?.critical ?? 0,
  } as any;

  return (
    <div className="min-h-screen" style={{ background: "var(--background-default)" }}>
      <OverallScoreHero
        summary={summary}
        domain={domain}
        finalUrl={siteUrl}
        metaTitle={stored.pageTitle ?? undefined}
        cms={storedCms && storedCms !== "unknown" ? { type: storedCms } : undefined}
        showCounts={!!stored.counts}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
        <NextStepBanner
          siteId={siteId}
          locale={locale}
          connectionStatus={connectionStatus}
          cmsType={storedCms ?? "unknown"}
          scan={stored.scan}
          scanState={scanState}
          onScan={onScan}
        />
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-subtle)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {checked ? `Showing saved results from ${checked} · refreshing…` : "Showing saved results · refreshing…"}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteCockpitLoader({
  siteId,
  siteUrl,
  siteSummary,
  wordpressConnectionStatus = "disconnected",
  wordpressLastConnected,
  wordpressOnly = false,
  wpVersion,
  pluginVersion,
  planName,
  stored,
  storedCms,
}: SiteCockpitLoaderProps) {
  const router = useRouter();
  const locale = (useParams().locale as string) || "en";
  // A finished scan changes what the server knows (finding count, summary), so reload it.
  const { state: scanState, start: startScan } = useSiteScan(siteId, locale, () => router.refresh());
  const [data, setData] = useState<SiteCockpitResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/analyze-facts?url=${encodeURIComponent(siteUrl)}&forceWordPress=1&siteId=${encodeURIComponent(siteId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const raw = await res.json();
        if (cancelled) return;
        const cockpitData = transformToSiteCockpitResponse(raw);
        setData(cockpitData);

        // Persist screenshot, favicon, page title, and scores back to the site record
        // so the dashboard card reflects the latest cockpit analysis.
        const screenshotUrl = `/api/screenshot?w=360&q=55&url=${encodeURIComponent(cockpitData.finalUrl)}`;
        const { overallScore, categoryScores } = cockpitData.summary;
        void fetch(`/api/sites/${siteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshotUrl,
            faviconUrl: cockpitData.faviconUrl || undefined,
            pageTitle: cockpitData.meta?.title || "",
            cms: cockpitData.cms?.type || undefined,
            counts: {
              passed: cockpitData.summary.passed,
              warnings: cockpitData.summary.warnings,
              critical: cockpitData.summary.criticalIssues,
            },
            scores: {
              overall: overallScore,
              content: categoryScores.content,
              seo: categoryScores.seo,
              performance: categoryScores.performance,
              security: categoryScores.security,
              accessibility: categoryScores.accessibility,
            },
          }),
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [siteId, siteUrl]);

  if (failed) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-6 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
          <h2 className="text-lg font-semibold mb-2">Analysis unavailable</h2>
          <p className="text-sm">
            The diagnosis could not complete right now. Try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (!data && stored?.scores) {
    return (
      <StoredPreview
        stored={stored}
        storedCms={storedCms}
        siteUrl={siteUrl}
        locale={locale}
        siteId={siteId}
        connectionStatus={wordpressConnectionStatus}
        scanState={scanState}
        onScan={startScan}
      />
    );
  }

  if (!data) {
    let domain = siteUrl;
    try { domain = new URL(siteUrl).hostname; } catch {}
    return <CockpitSkeleton domain={domain} />;
  }

  return (
    <SiteCockpit
      data={data}
      siteId={siteId}
      editable={false}
      siteSummary={siteSummary}
      wordpressConnectionStatus={wordpressConnectionStatus}
      wordpressLastConnected={wordpressLastConnected}
      wordpressOnly={wordpressOnly}
      wpVersion={wpVersion}
      pluginVersion={pluginVersion}
      planName={planName}
      scan={stored?.scan ?? null}
      scanState={scanState}
      onScan={startScan}
    />
  );
}
