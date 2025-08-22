"use client";

import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, Gauge, Search, Accessibility, ImageIcon } from "lucide-react";

// Minimal types for chunks we’ll stream later
type FindingChunk = {
  event: "finding" | "score" | "done" | "error";
  category?: "SEO" | "Accessibility" | "Performance" | "Security";
  severity?: "info" | "warn" | "error";
  message?: string;
  score?: number; // 0..100
  screenshotUrl?: string; // if backend emits a URL when ready
};

const CATS: FindingChunk["category"][] = [
  "SEO",
  "Accessibility",
  "Performance",
  "Security",
];

const CAT_ICON: Record<string, React.ReactNode> = {
  SEO: <Search className="w-4 h-4" />,
  Accessibility: <Accessibility className="w-4 h-4" />,
  Performance: <Gauge className="w-4 h-4" />,
  Security: <ShieldCheck className="w-4 h-4" />,
};

export default function StreamingReportShell({ url }: { url: string }) {
  // state buckets
  const [scores, setScores] = useState<Record<string, number>>({
    SEO: 0,
    Accessibility: 0,
    Performance: 0,
    Security: 0,
  });
  const [findings, setFindings] = useState<
    { category: string; severity: FindingChunk["severity"]; message: string }[]
  >([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">(
    "streaming"
  );

  // TODO: hook this to your real streaming endpoint in Step 2.
useEffect(() => {
  let cancelled = false;

  async function run() {
    setStatus("streaming");
    setFindings([]);
    setScreenshot(null);
    setScores({ SEO: 0, Accessibility: 0, Performance: 0, Security: 0 });

    const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`, {
      method: "GET",
      headers: { Accept: "application/x-ndjson" },
    });

    if (!res.ok || !res.body) {
      setStatus("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (cancelled) return;

      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;

        try {
          const chunk = JSON.parse(line);
          if (chunk.event === "score" && chunk.category && typeof chunk.score === "number") {
            setScores((s) => ({ ...s, [chunk.category]: Math.round(chunk.score) }));
          } else if (chunk.event === "finding" && chunk.category && chunk.message) {
            setFindings((f) => [
              { category: chunk.category, severity: chunk.severity || "info", message: chunk.message },
              ...f,
            ]);
          } else if (chunk.event === "screenshot" && chunk.screenshotUrl) {
            setScreenshot(chunk.screenshotUrl);
          } else if (chunk.event === "done") {
            setStatus("done");
          } else if (chunk.event === "error") {
            setStatus("error");
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
  }

  run();
  return () => { cancelled = true; };
}, [url]);

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Left: Screenshot */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] shadow-xl backdrop-blur h-full min-h-[320px] flex items-center justify-center">
          {screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screenshot} alt="Website screenshot" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center text-slate-400">
              <ImageIcon className="w-7 h-7 mb-2" />
              <span className="text-sm">Capturing screenshot…</span>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-slate-400 break-all">
          Analyzing: <span className="text-slate-200">{url}</span>
        </div>
      </div>

      {/* Right: Scores + Findings */}
      <div className="lg:col-span-3 space-y-6">
        {/* Category scores */}
        <div className="grid sm:grid-cols-2 gap-4">
          {CATS.map((c) => (
            <CategoryScore key={c} label={c} score={scores[c]} icon={CAT_ICON[c as string]} />
          ))}
        </div>

        {/* Live findings feed */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl backdrop-blur p-4 h-[320px] overflow-auto">
          <h4 className="text-slate-200 font-semibold mb-2">Live findings</h4>
          <ul className="space-y-2">
            {findings.length === 0 ? (
              <li className="text-slate-400 text-sm">Waiting for results…</li>
            ) : (
              findings.map((f, i) => (
                <li
                  key={i}
                  className="text-sm grid grid-cols-[auto,1fr] items-start gap-2"
                >
                  <span
                    className={
                      f.severity === "error"
                        ? "text-rose-400"
                        : f.severity === "warn"
                        ? "text-amber-300"
                        : "text-slate-400"
                    }
                  >
                    ●
                  </span>
                  <span className="text-slate-200">
                    <b className="text-slate-300">{f.category}:</b> {f.message}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CategoryScore({
  label,
  score,
  icon,
}: {
  label: string;
  score: number;
  icon: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score || 0)));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur p-4 shadow">
      <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
        <span className="text-slate-300">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <Ring value={pct} />
        <div className="text-sm text-slate-400">
          <div><span className="text-slate-200 font-semibold">{pct}</span>/100</div>
          <div className="text-xs">higher is better</div>
        </div>
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 28, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" fill="none" />
      <circle
        cx="36"
        cy="36"
        r={r}
        stroke="url(#grad)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}
