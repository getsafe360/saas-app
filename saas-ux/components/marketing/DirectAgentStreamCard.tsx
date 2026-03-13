"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAgentStream } from "@/lib/agent/useAgentStream";

export default function DirectAgentStreamCard() {
  const t = useTranslations("analysis");
  const [url, setUrl] = useState("");
  const stream = useAgentStream();

  const handleStart = () => {
    if (!url.trim()) return;
    stream.start(url);
  };

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-slate-900/70 p-5 shadow-2xl">
      <div className="gs-input-submit-combo flex-col sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="h-11 w-full border-white/10 bg-slate-950/80 text-base font-medium text-slate-100 placeholder:text-slate-500"
        />
        <Button
          onClick={handleStart}
          disabled={stream.phase === "streaming"}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20 sm:w-auto bg-sky-50 text-sky-700"
        >
          {stream.phase === "streaming" ? t("analyzing") : t("analyze_btn")}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {(stream.phase === "streaming" || stream.phase === "completed" || stream.phase === "error") && (
        <div className="mt-4">
          <div className="h-2 rounded-full border border-emerald-400/20 bg-slate-800/80">
            <div
              className="h-2 rounded-full border border-emerald-400/60 bg-emerald-500/40 transition-all duration-500 ease-out"
              style={{ width: `${stream.progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">{stream.progress}% complete</p>

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-base leading-relaxed text-slate-200">
            <p className="font-medium text-emerald-200">Sparky</p>
            <p className="mt-2 text-slate-200">{stream.greeting}</p>

            <div className="mt-3 space-y-2 text-sm text-slate-300">
              {stream.messages.map((message, index) => (
                <p key={`${message}-${index}`} className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                  {message}
                </p>
              ))}
            </div>

            {stream.summary && (
              <p className="mt-3 rounded-md border border-emerald-400/30 bg-emerald-950/20 px-3 py-2 text-emerald-100">
                {stream.summary}
              </p>
            )}
          </div>

          {stream.error && <p className="mt-3 text-sm text-amber-300">{stream.error}</p>}
        </div>
      )}
    </section>
  );
}
