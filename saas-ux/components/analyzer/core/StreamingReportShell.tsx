// components/analyzer/core/StreamingReportShell.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import WPSpotlight from "../cms/WPSpotlight";
import ReportHeroView from "@/components/analyzer/display/ReportHero";
import { FindingsGrid } from "@/components/analyzer/display/FindingsGrid";
import PillarColumn from "@/components/analyzer/findings/PillarColumn";
import {
  buildScreenshotUrls,
  prefetchScreenshots,
} from "@/components/analyzer/utils/screenshotPrefetch";
import { bucketVariant } from "@/lib/ab";
import SiteIdentityCard from "../display/SiteIdentityCard";
import { parseFindings } from "@/components/analyzer/utils/parseFindings";
import type { Finding, Facts, AnalysisPayload, ScreenshotUrls } from "../types";
import { useTestResultSafe } from "@/contexts/TestResultContext";
import type { EnhancedAnalysisPayload } from "@/lib/stash/types";
import { saveTestResults } from "@/lib/stash/saveTestResults";

type Props = {
  className?: string;
  autofillUrl?: string;
  locale: string;
  onComplete?: (payload: AnalysisPayload) => void;
  hideForm?: boolean;
  startOnUrl?: string;
};

export default function StreamingReportShell({
  className,
  autofillUrl = "",
  locale,
  onComplete,
  hideForm = false,
  startOnUrl,
}: Props) {
  const ta = useTranslations("analysis");
  const testResultContext = useTestResultSafe();

  const [url, setUrl] = useState(autofillUrl);
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "done" | "error"
  >("idle");
  const [output, setOutput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [screenshotUrls, setScreenshotUrls] = useState<ScreenshotUrls | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);
  const lastStartedRef = useRef<string | null>(null);

  const pillars = useMemo(
    () => ({
      seo: findings.filter((f) => f.pillar === "seo"),
      a11y: findings.filter((f) => f.pillar === "a11y"),
      perf: findings.filter((f) => f.pillar === "perf"),
      sec: findings.filter((f) => f.pillar === "sec"),
    }),
    [findings]
  );

  const scores = useMemo(() => {
    const s = {
      seo: { ok: 0, warn: 0, crit: 0 },
      a11y: { ok: 0, warn: 0, crit: 0 },
      perf: { ok: 0, warn: 0, crit: 0 },
      sec: { ok: 0, warn: 0, crit: 0 },
    };
    for (const f of findings) {
      const slot = (s as any)[f.pillar];
      if (f.severity === "minor") slot.ok++;
      else if (f.severity === "medium") slot.warn++;
      else slot.crit++;
    }
    return s;
  }, [findings]);

  async function startAnalysis(u: string) {
    setUrl(u);
    setOutput("");
    setFindings([]);
    setErrorMsg(null);
    setFacts(null);
    setScreenshotUrls(null);
    completedRef.current = false;

    setStatus("loading");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, locale }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body)
        throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      setStatus("streaming");

      fetch("/api/analyze-facts?url=" + encodeURIComponent(u))
        .then((r) => (r.ok ? r.json() : null))
        .then(setFacts)
        .catch(() => {});

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setOutput((prev) => prev + chunk);
      }
      setStatus("done");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setStatus("error");
      setErrorMsg(err?.message || ta("processing"));
    } finally {
      abortRef.current = null;
    }
  }

  // Handle screenshot URL building and prefetching
  useEffect(() => {
    if (!facts?.finalUrl) return;

    const urls = buildScreenshotUrls(facts.finalUrl, locale);
    setScreenshotUrls(urls);

    // Prefetch all screenshots in parallel (fire and forget)
    prefetchScreenshots(urls);
  }, [facts?.finalUrl, locale]);

  useEffect(() => {
    if (!hideForm && !startOnUrl) return;
    if (startOnUrl && startOnUrl !== lastStartedRef.current) {
      lastStartedRef.current = startOnUrl;
      startAnalysis(startOnUrl);
    }
  }, [hideForm, startOnUrl]);

  function cancel() {
    abortRef.current?.abort();
    setStatus("idle");
    lastStartedRef.current = null;
  }

  useEffect(() => {
    if (status === "done" && output) setFindings(parseFindings(output));
  }, [status, output]);

  useEffect(() => {
    if (status !== "done" || completedRef.current) return;

    const enhancedPayload: EnhancedAnalysisPayload = {
      url,
      markdown: output,
      findings: parseFindings(output),
      facts,
      locale,
      timestamp: new Date().toISOString(),
      screenshotUrls: screenshotUrls ?? undefined,
    };

    // Auto-stash test results for signup flow
    async function stashAndUpdateContext() {
      try {
        const stashResult = await saveTestResults(enhancedPayload);
        if (stashResult?.stashUrl && testResultContext) {
          testResultContext.setStashUrl(stashResult.stashUrl);
        }
      } catch (error) {
        console.error("Failed to auto-stash test results:", error);
        // Continue even if stashing fails
      }

      // Update context with test result
      if (testResultContext) {
        testResultContext.setTestResult(enhancedPayload);
      }

      // Call original callback
      onComplete?.(enhancedPayload);
    }

    stashAndUpdateContext();
    completedRef.current = true;
  }, [status, output, facts, url, locale, screenshotUrls, onComplete, testResultContext]);

  const busy = status === "loading" || status === "streaming";
  const finalUrl = facts?.finalUrl || url;

  const showWpSpotlight =
    facts?.cms?.type === "wordpress" &&
    bucketVariant((facts?.domain || "") + (facts?.cms?.wp?.version || ""));

  return (
    <div className={cn("space-y-6", className)}>
      {/* Report hero */}
      {status !== "idle" && finalUrl && screenshotUrls && facts && (
        <ReportHeroView
          url={finalUrl}
          domain={facts.domain || new URL(url).hostname}
          faviconUrl={facts.faviconUrl ?? undefined}
          status={facts.status || 0}
          isHttps={!!facts.isHttps}
          hostIP={facts.hostIP}
          screenshotUrl={screenshotUrls.desktopHi}
          mobileUrl={screenshotUrls.mobileHi}
          lastChecked={new Date().toISOString()}
          locale={locale}
          cmsLabel={
            facts.cms?.type === "wordpress" && facts.cms?.wp?.version
              ? `WordPress ${facts.cms.wp.version}`
              : undefined
          }
          siteLang={facts.siteLang || undefined}
          pillars={{
            seo: countTriplet(pillars.seo),
            a11y: countTriplet(pillars.a11y),
            perf: countTriplet(pillars.perf),
            sec: countTriplet(pillars.sec),
          }}
          isAnalyzing={busy}
        >
          {findings.length > 0 && (
            <FindingsGrid
              columns={[
                <PillarColumn key="seo" label="SEO" items={pillars.seo} />,
                <PillarColumn
                  key="a11y"
                  label="Accessibility"
                  items={pillars.a11y}
                />,
                <PillarColumn
                  key="perf"
                  label="Performance"
                  items={pillars.perf}
                />,
                <PillarColumn key="sec" label="Security" items={pillars.sec} />,
              ]}
            />
          )}
        </ReportHeroView>
      )}

      {/* Optional WP spotlight under the hero */}
      {facts && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-2">
          {showWpSpotlight && facts.cms?.type === "wordpress" && (
            <div className="mt-4">
              <WPSpotlight
                version={facts.cms.wp?.version}
                jsonApi={facts.cms.wp?.jsonApi ?? null}
                xmlrpc={facts.cms.wp?.xmlrpc ?? null}
              />
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {ta("audit_result")}: {errorMsg}
        </div>
      )}

      {(status === "loading" || status === "streaming") && (
        <div className="rounded-2xl border p-4 shadow-sm bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10">
          <div className="text-lg font-semibold">{ta("headline1")}</div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {ta("analyzing")}
          </p>
        </div>
      )}
    </div>
  );
}

function countTriplet(items: Finding[]) {
  let pass = 0,
    warn = 0,
    crit = 0;
  for (const it of items) {
    if (it.severity === "minor") pass++;
    else if (it.severity === "medium") warn++;
    else crit++;
  }
  return { pass, warn, crit };
}
