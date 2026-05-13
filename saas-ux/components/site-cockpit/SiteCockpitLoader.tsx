// components/site-cockpit/SiteCockpitLoader.tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SiteCockpit } from "./SiteCockpit";
import { transformToSiteCockpitResponse } from "@/lib/cockpit/transform-api-data";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type { ConnectionStatus } from "./cards/wordpress/types";

interface SiteCockpitLoaderProps {
  siteId: string;
  siteUrl: string;
  siteSummary?: string;
  wordpressConnectionStatus?: ConnectionStatus;
  wordpressLastConnected?: string;
  wpVersion?: string;
  pluginVersion?: string;
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

        {/* Row 3: AI toolkit strip */}
        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
        >
          <SkeletonBox className="h-3 w-40 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonBox key={i} className="h-9" />
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

export function SiteCockpitLoader({
  siteId,
  siteUrl,
  siteSummary,
  wordpressConnectionStatus = "disconnected",
  wordpressLastConnected,
  wpVersion,
  pluginVersion,
}: SiteCockpitLoaderProps) {
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

        // Persist screenshot, favicon, and page title back to the site record
        // so the dashboard card reflects the latest cockpit analysis.
        const screenshotUrl = `/api/screenshot?w=360&q=55&url=${encodeURIComponent(cockpitData.finalUrl)}`;
        void fetch(`/api/sites/${siteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshotUrl,
            faviconUrl: cockpitData.faviconUrl || undefined,
            pageTitle: cockpitData.meta?.title || "",
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
      wpVersion={wpVersion}
      pluginVersion={pluginVersion}
    />
  );
}
