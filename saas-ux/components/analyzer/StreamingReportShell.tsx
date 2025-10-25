// saas-ux/components/analyzer/StreamingReportShell.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { SignedOut, SignedIn, SignUpButton } from "@clerk/nextjs";
import { cn } from "@/lib/cn";
import { Globe } from "lucide-react";
import SiteIdentityCard from "./SiteIdentityCard";
import { parseFindings, type Finding } from "./parseFindings";
import { ScoreBar } from "@/components/ui/ScoreBar";
import UrlAnalyzeForm from "./UrlAnalyzeForm";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

type Props = {
  className?: string;
  autofillUrl?: string;
  locale: string;
  onComplete?: (payload: AnalysisPayload) => void;
  hideForm?: boolean;          // NEW: do not render the form inside the shell
  startOnUrl?: string;         // NEW: when provided/changed, auto-start analysis
};

type Facts = Awaited<ReturnType<typeof import("@/lib/analyzer/preScan")["preScan"]>>;

export type AnalysisPayload = {
  url: string;
  markdown: string;
  findings: Finding[];
  facts?: Facts | null;
  locale: string;
};

export default function StreamingReportShell({
  className,
  autofillUrl = "",
  locale,
  onComplete,
  hideForm = false,
  startOnUrl,
}: Props) {
  const t = useTranslations("Nav");
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

  const scores = useMemo(() => {
    const init = {
      seo: { ok: 0, warn: 0, crit: 0 },
      a11y: { ok: 0, warn: 0, crit: 0 },
      perf: { ok: 0, warn: 0, crit: 0 },
      sec: { ok: 0, warn: 0, crit: 0 },
    };
    for (const f of findings) {
      const slot = (init as any)[f.pillar];
      if (f.severity === "minor") slot.ok++;
      else if (f.severity === "medium") slot.warn++;
      else slot.crit++;
    }
    return init;
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

  // Allow hero form to trigger this shell (keep gradient fixed)
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

  return (
    <div className={cn("space-y-4", className)}>
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

      {/* Identity + screenshot */}
      {status !== "idle" && (
        <SiteIdentityCard
          domain={facts?.domain || (url ? new URL(url).hostname : "example.com")}
          finalUrl={facts?.finalUrl || url}
          status={facts?.status || 0}
          isHttps={!!facts?.isHttps}
          faviconUrl={facts?.faviconUrl || null}
          siteLang={facts?.siteLang || null}
          uiLocale={locale}
          cms={facts?.cms || { type: "unknown" }}
        />
      )}

      {/* Streaming markdown */}
      {output && (
        <div className="rounded-2xl border p-4 shadow-sm prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{output}</ReactMarkdown>
          <div className="mt-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  {t("createFreeAccount") ?? "Create free account"}
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      )}

      {/* ScoreBars */}
      {findings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScoreBar label="SEO" ok={scores.seo.ok} warn={scores.seo.warn} crit={scores.seo.crit} />
          <ScoreBar label="Accessibility" ok={scores.a11y.ok} warn={scores.a11y.warn} crit={scores.a11y.crit} />
          <ScoreBar label="Performance" ok={scores.perf.ok} warn={scores.perf.warn} crit={scores.perf.crit} />
          <ScoreBar label="Security" ok={scores.sec.ok} warn={scores.sec.warn} crit={scores.sec.crit} />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {ta("audit_result")}: {errorMsg}
        </div>
      )}

      {(status === "loading" || status === "streaming") && (
        <div className="rounded-2xl border p-4 shadow-sm bg-white/70 dark:bg-neutral-900/70">
          <div className="text-lg font-semibold">{ta("headline1")}</div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{ta("fixing_in_progress")}</p>
        </div>
      )}
    </div>
  );
}
