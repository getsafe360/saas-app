// components/analyzer/StreamingReportShell.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Globe } from "lucide-react";

import UrlAnalyzeForm from "./UrlAnalyzeForm";
import WPSpotlight from "./WPSpotlight";
import ReportHero from "@/components/analyzer/ReportHero";
import { FindingsGrid } from "@/components/analyzer/FindingsGrid";
import PillarColumn from "@/components/analyzer/PillarColumn";
import { parseFindings } from "@/components/analyzer/parseFindings";
import type { Finding } from "@/components/analyzer/parseFindings";
import { bucketVariant } from "@/lib/ab";
import SiteIdentityCard from "./SiteIdentityCard"; // optional, still shown below hero

type Props = {
  className?: string;
  autofillUrl?: string;
  locale: string;
  onComplete?: (payload: AnalysisPayload) => void;
  hideForm?: boolean;
  startOnUrl?: string;
};

type Facts = Awaited<ReturnType<typeof import("@/lib/analyzer/preScan")["preScan"]>>;

export type AnalysisPayload = {
  url: string;
  markdown: string;
  findings: Finding[];
  facts?: Facts | null;
  locale: string;
};

const SCREENSHOT_W = 650;
const MAX_BYTES = 30 * 1024;

export default function StreamingReportShell({
  className,
  autofillUrl = "",
  locale,
  onComplete,
  hideForm = false,
  startOnUrl,
}: Props) {
  const ta = useTranslations("analysis");
  const taction = useTranslations("actions");

  const [url, setUrl] = useState(autofillUrl);
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);
  const lastStartedRef = useRef<string | null>(null);

  const pillars = useMemo(() => ({
    seo: findings.filter(f => f.pillar === "seo"),
    a11y: findings.filter(f => f.pillar === "a11y"),
    perf: findings.filter(f => f.pillar === "perf"),
    sec: findings.filter(f => f.pillar === "sec"),
  }), [findings]);

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
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
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
    const payload: AnalysisPayload = {
      url,
      markdown: output,
      findings: parseFindings(output),
      facts,
      locale,
    };
    onComplete?.(payload);
    completedRef.current = true;
  }, [status, output, facts, url, locale, onComplete]);

  const busy = status === "loading" || status === "streaming";

  // Build canonical screenshot URLs (single desktop variant, 650px wide)
  const finalUrl = facts?.finalUrl || url;
  const screenshotUrl = finalUrl
    ? `/api/screenshot?fmt=avif&w=${SCREENSHOT_W}&max=${MAX_BYTES}&url=${encodeURIComponent(finalUrl)}`
    : "";
  const lowResUrl = finalUrl
    ? `/api/screenshot?fmt=webp&w=24&q=30&url=${encodeURIComponent(finalUrl)}`
    : "";

  const showWpSpotlight =
    facts?.cms?.type === "wordpress" &&
    bucketVariant((facts?.domain || "") + (facts?.cms?.wp?.version || ""));

  return (
    <div className={cn("space-y-6", className)}>
      {!hideForm && (
        <UrlAnalyzeForm
          placeholder={ta("placeholder_url")}
          icon={<Globe className="w-5 h-5 text-sky-400" />}
          onSubmit={startAnalysis}
          isBusy={busy}
          onCancel={busy ? cancel : undefined}
          defaultValue={autofillUrl}
          labels={{
            analyze: ta("analyze_btn"),
            analyzing: ta("analyzing"),
            cancel: taction("cancel"),
            invalidUrl: ta.has("invalid_url") ? ta("invalid_url") : undefined,
          }}
        />
      )}

      {/* Report hero (single screenshot + summary chips) */}
      {(status !== "idle") && finalUrl && (
        <ReportHero
          url={finalUrl}
          screenshotUrl={screenshotUrl}
          lowResUrl={lowResUrl}
          lastChecked={new Date().toISOString()}
          lang={facts?.siteLang || undefined}
          status={facts?.isHttps ? "HTTPS • " + (facts?.status || 0) : String(facts?.status || "")}
          pillars={{
            seo: countTriplet(pillars.seo),
            a11y: countTriplet(pillars.a11y),
            perf: countTriplet(pillars.perf),
            sec: countTriplet(pillars.sec),
          }}
          onFixAll={() => {
            // TODO: open Copilot prefilled with critical issues
          }}
        />
      )}

      {/* Optional identity + WP spotlight under the hero */}
      {facts && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-2">
          <SiteIdentityCard
            domain={facts.domain || (url ? new URL(url).hostname : "example.com")}
            finalUrl={finalUrl}
            status={facts.status || 0}
            isHttps={!!facts.isHttps}
            faviconUrl={facts.faviconUrl || null}
            siteLang={facts.siteLang || null}
            uiLocale={locale}
            cms={facts.cms || { type: "unknown" }}
          />
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

      {/* Findings */}
      {findings.length > 0 && (
        <FindingsGrid
          columns={[
            <PillarColumn key="seo"          label="SEO"          score={scores.seo}  items={pillars.seo}  />,
            <PillarColumn key="a11y"         label="Accessibility" score={scores.a11y} items={pillars.a11y} />,
            <PillarColumn key="perf"         label="Performance"   score={scores.perf} items={pillars.perf} />,
            <PillarColumn key="sec"          label="Security"      score={scores.sec}  items={pillars.sec}  />
          ]}
        />
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {ta("audit_result")}: {errorMsg}
        </div>
      )}

      {(status === "loading" || status === "streaming") && (
        <div className="rounded-2xl border p-4 shadow-sm bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10">
          <div className="text-lg font-semibold">{ta("headline1")}</div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{ta("fixing_in_progress")}</p>
        </div>
      )}
    </div>
  );
}

function countTriplet(items: Finding[]) {
  let pass = 0, warn = 0, crit = 0;
  for (const it of items) {
    if (it.severity === "minor") pass++;
    else if (it.severity === "medium") warn++;
    else crit++;
  }
  return { pass, warn, crit };
}
