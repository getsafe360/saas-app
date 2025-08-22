"use client";

import React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { mindMapI18n } from "@/components/ui/MindMapI18n";

import UrlAnalyzeForm from "@/components/analyzer/UrlAnalyzeForm";
import StreamingReportShell from "@/components/analyzer/StreamingReportShell";

export default function HomePage() {
  const t = useTranslations("home");
  const [mode] = useState<"system" | "light" | "dark">("system");
  const activeLocale: "en" | "de" | "es" | "fr" | "it" | "pt" = "en";

  // When the user submits a URL, we show the streaming shell
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  return (
    <main className="relative overflow-x-clip">
      {/* HERO */}
      <section className="relative py-20">
        {/* backdrop glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(17,111,255,0.25),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="bg-gradient-to-r from-white via-sky-300/80 to-sky-400/70 bg-clip-text text-transparent">
                {t.rich("title", {
                  span: (chunks: React.ReactNode) => (
                    <span className="font-extrabold tracking-tighter">
                      {chunks}
                    </span>
                  ),
                })}
              </span>
            </h1>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-10 text-slate-300">
              {t.rich("optimize", {
                span: (chunks) => (
                  <span className="font-semibold text-white">{chunks}</span>
                ),
              })}
            </h2>

            {/* Analyze URL – glass bar */}
            <div className="mx-auto max-w-3xl">
              <UrlAnalyzeForm
                placeholder="https://your-website.com"
                icon={<Globe className="w-5 h-5" />}
                onSubmit={(url) => setPendingUrl(url)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Two quick audience cards */}
      <section className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-6 px-4 sm:px-6 lg:px-8 mb-10">
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-xl leading-relaxed text-slate-200">
            <span className="font-extrabold text-sky-300">Website owners</span>{" "}
            get a powerful AI assistant that optimizes any website in minutes.
          </p>
        </div>
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-xl leading-relaxed text-slate-200">
            <span className="font-extrabold text-sky-300">Developers</span>{" "}
            boost productivity and focus on what matters.
          </p>
        </div>
      </section>

      {/* Live streaming shell (hidden until user submits) */}
      {pendingUrl && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-14">
          <StreamingReportShell url={pendingUrl} />
        </section>
      )}

      {/* One-liner feature detail */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-20 border-t border-white/10 pt-12">
        <div className="rounded-2xl p-6 shadow-xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <p className="text-slate-200 text-lg leading-relaxed">
            {t.rich("details", {
              b: (chunks) => (
                <span className="font-semibold text-sky-300">{chunks}</span>
              ),
            })}
          </p>
          <p className="mt-3 text-slate-300">{t("description")}</p>
        </div>
      </section>
    </main>
  );
}
