// app/[locale]/page.tsx
'use client';

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import StreamingReportShell, { AnalysisPayload } from "@/components/analyzer/StreamingReportShell";
import CTA from "@/components/ui/cta";
import { useState } from "react";

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);

  return (
    <main className="relative overflow-x-clip">
      {/* HERO */}
      <section className="relative py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(17,111,255,0.25),transparent)]"></div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
                {t.rich("title", {
                  span: (chunks: React.ReactNode) => (
                    <span className="font-extrabold tracking-tighter">{chunks}</span>
                  ),
                })}
              </span>
            </h1>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-10 text-slate-300">
              {t.rich("optimize", { span: (chunks) => <span className="font-semibold text-white">{chunks}</span> })}
            </h2>

            {/* Analyzer shell (includes its own URL form + streaming output) */}
            <div className="mx-auto max-w-3xl">
              <StreamingReportShell locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* Two quick audience cards */}
      <section className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-6 px-4 sm:px-6 lg:px-8 mb-10">
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-xl leading-relaxed text-slate-200">
            <span className="font-extrabold text-sky-300">Website owners</span> get a powerful AI assistant that
            optimizes any website in minutes.
          </p>
        </div>
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-xl leading-relaxed text-slate-200">
            <span className="font-extrabold text-sky-300">Developers</span> boost productivity and focus on what matters.
          </p>
        </div>
      </section>

      <section className="mt-12 flex justify-center">
        <CTA />
      </section>

      {/* One-liner feature detail */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-20 pt-12">
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-slate-200 text-lg leading-relaxed">
            {t.rich("details", { b: (chunks) => <span className="font-semibold text-sky-300">{chunks}</span> })}
          </p>
          <p className="mt-3 text-slate-300">{t("description")}</p>
        </div>
      </section>
    </main>
  );
}
