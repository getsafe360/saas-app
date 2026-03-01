// saas-ux/app/[locale]/page.tsx
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import CTA from "@/components/marketing/CTA";
import InstantTestCard from "@/components/marketing/InstantTestCard";
import AudienceInfoBoxes from "@/components/marketing/AudienceInfoBoxes";
import { TestResultProvider } from "@/contexts/TestResultContext";

export default function HomePage() {
  const th = useTranslations("home");

  return (
    <TestResultProvider>
      <main className="relative overflow-x-clip">
        <section className="relative py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(17,111,255,0.25),transparent)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
                <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
                  {th.rich("title", {
                    span: (chunks: React.ReactNode) => (
                      <span className="font-extrabold tracking-tighter">{chunks}</span>
                    ),
                  })}
                </span>
              </h1>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-10 text-slate-300">
                {th.rich("optimize", {
                  span: (chunks) => <span className="font-semibold text-white">{chunks}</span>,
                })}
              </h2>

              <div className="mx-auto max-w-3xl space-y-6">
                <InstantTestCard />
              </div>
            </div>
          </div>
        </section>

        <AudienceInfoBoxes />

        <section className="mb-8">
          <CTA />
        </section>
      </main>
    </TestResultProvider>
  );
}
