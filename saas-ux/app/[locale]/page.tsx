// saas-ux/app/[locale]/page.tsx
'use client';

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Globe } from "lucide-react";
import UrlAnalyzeForm from "@/components/analyzer/UrlAnalyzeForm";
import StreamingReportShell, { AnalysisPayload } from "@/components/analyzer/StreamingReportShell";
import CTA from "@/components/marketing/CTA";
import AudienceInfoBoxes from "@/components/marketing/AudienceInfoBoxes";

export default function HomePage() {
  const th = useTranslations("home");
  const ta = useTranslations("analysis");
  const taction = useTranslations("actions");
  const locale = useLocale();

  const [pendingUrl, setPendingUrl] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);

  return (
    <main className="relative overflow-x-clip">
      {/* HERO (fixed-height visual; gradient stays constant) */}
      <section className="relative py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(17,111,255,0.25),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
                {th.rich("title", { span: (chunks: React.ReactNode) => <span className="font-extrabold tracking-tighter">{chunks}</span> })}
              </span>
            </h1>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-10 text-slate-300">
              {th.rich("optimize", { span: (chunks) => <span className="font-semibold text-white">{chunks}</span> })}
            </h2>

            <div className="mx-auto max-w-3xl">
              <UrlAnalyzeForm
                placeholder={ta("placeholder_url")}
                icon={<Globe className="w-5 h-5 text-sky-400" />}   // blue globe
                onSubmit={(normalizedUrl) => {
                  setAnalysis(null);
                  setPendingUrl(normalizedUrl); // triggers the shell below
                }}
                isBusy={false}
                labels={{
                  analyze: ta("analyze_btn"),
                  analyzing: ta("analyzing"),
                  cancel: taction("cancel"),
                  invalidUrl: ta.has("invalid_url") ? ta("invalid_url") : undefined,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* RESULTS (lives below hero; gradient unaffected) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-14">
        <StreamingReportShell
          hideForm
          startOnUrl={pendingUrl}
          locale={locale}
          onComplete={setAnalysis}
        />
      </section>

      <AudienceInfoBoxes />

        <section className="mt-12 flex justify-center">
          <CTA />
        </section>

    </main>
  );
}
