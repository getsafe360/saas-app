// components/analyzer/ReportHero.tsx
"use client";

import { useState } from "react";
import { Shield, Gauge, Search, Accessibility } from "lucide-react";

type PillarCounts = { pass: number; warn: number; crit: number };

export default function ReportHero({
  url,
  // Desktop
  screenshotUrl,
  lowResUrl,
  // Mobile
  mobileUrl,
  mobileLowResUrl,
  lastChecked,
  lang,
  status,
  cmsLabel,
  children,
  onFixAll,
  pillars
}: {
  url: string;
  screenshotUrl: string;
  lowResUrl?: string;
  mobileUrl: string;
  mobileLowResUrl?: string;
  lastChecked: string;
  lang?: string;
  status?: string;   // e.g., "HTTPS • 200"
  cmsLabel?: string; // e.g., "WordPress 6.7"
  children?: React.ReactNode;
  onFixAll?: () => void;
  pillars: {
    seo: PillarCounts;
    a11y: PillarCounts;
    perf: PillarCounts;
    sec: PillarCounts;
  };
}) {
  const [deskLoaded, setDeskLoaded] = useState(false);
  const [mobLoaded, setMobLoaded] = useState(false);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="cta-effect cta-sky rounded-2xl">
        <div className="gb-card gb-sky rounded-2xl p-5 sm:p-6 lg:p-8 bg-white/70 dark:bg-white/[0.04] backdrop-blur ring-1 ring-slate-900/10 dark:ring-white/10">
          
          {/* Screenshots row */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch">
            {/* Desktop shot (defines row height via aspect) */}
            <figure className="relative rounded-xl overflow-hidden ring-1 ring-slate-900/10 dark:ring-white/10 shadow">
              <div className="relative aspect-[12/7] w-full">
                {/* Low-res progressive layer */}
                {lowResUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lowResUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover blur-md scale-105 opacity-70 transition-opacity duration-300"
                    style={{ opacity: deskLoaded ? 0 : 1 }}
                  />
                )}
                {/* Hi-res (no Next proxy; we control the exact size) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt={`Screenshot of ${url}`}
                  width={650}
                  height={Math.round((650 * 7) / 12)}
                  loading="eager"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${deskLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setDeskLoaded(true)}
                />
                {!deskLoaded && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="h-6 w-6 rounded-full border-2 border-sky-400/40 border-t-sky-500 animate-spin" />
                  </div>
                )}
              </div>
              <figcaption className="sr-only">Desktop preview</figcaption>
            </figure>

            {/* Mobile shot: matches the row height via h-full */}
            <figure className="relative rounded-xl overflow-hidden ring-1 ring-slate-900/10 dark:ring-white/10 shadow hidden lg:block">
              <div className="relative h-full w-full">
                {/* Low-res */}
                {mobileLowResUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mobileLowResUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover blur-md scale-105 opacity-70 transition-opacity duration-300"
                    style={{ opacity: mobLoaded ? 0 : 1 }}
                  />
                )}
                {/* Hi-res phone */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mobileUrl}
                  alt={`Mobile screenshot of ${url}`}
                  width={390}
                  height={800}
                  loading="eager"
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mobLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setMobLoaded(true)}
                />
                {!mobLoaded && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="h-6 w-6 rounded-full border-2 border-sky-400/40 border-t-sky-500 animate-spin" />
                  </div>
                )}
              </div>
              <figcaption className="sr-only">Mobile preview</figcaption>
            </figure>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="px-2 py-1 rounded-full ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/60 dark:bg-white/[0.05]">
              {new URL(url).hostname}
            </span>
            {status && (
              <span className="px-2 py-1 rounded-full ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-300 bg-emerald-500/5">
                {status}
              </span>
            )}
            {cmsLabel && <span className="px-2 py-1 rounded-full ring-1 ring-slate-900/10 dark:ring-white/10">{cmsLabel}</span>}
            {lang && <span className="px-2 py-1 rounded-full ring-1 ring-slate-900/10 dark:ring-white/10">{lang}</span>}
            <span className="px-2 py-1 rounded-full ring-1 ring-slate-900/10 dark:ring-white/10">Last checked: {new Date(lastChecked).toLocaleString()}</span>
          </div>

          {/* Pillar chips */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PillarChip icon={Search} title="SEO" {...pillars.seo} accent="sky" />
            <PillarChip icon={Accessibility} title="Accessibility" {...pillars.a11y} accent="teal" />
            <PillarChip icon={Gauge} title="Performance" {...pillars.perf} accent="violet" />
            <PillarChip icon={Shield} title="Security" {...pillars.sec} accent="amber" />
          </div>
            {children ? (
            <div className="mt-6 pt-6 border-t border-slate-200/70 dark:border-white/10">
            {children}
            </div>
          ) : null}
          {/* CTA */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              We’ll highlight issues and <span className="font-semibold">auto-generate safe fixes</span> you can apply with one click.
            </p>
            <button
              onClick={onFixAll}
              className="button-shine inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-600 dark:focus-visible:ring-offset-0 transition"
            >
              Fix with Copilot
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PillarChip({
  icon: Icon,
  title,
  pass, warn, crit,
  accent = "sky"
}: {
  icon: any; title: string; pass: number; warn: number; crit: number; accent?: "sky"|"teal"|"violet"|"amber";
}) {
  const ring =
    accent === "teal"   ? "ring-teal-500/20 bg-teal-500/5 text-teal-600 dark:text-teal-300" :
    accent === "violet" ? "ring-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-300" :
    accent === "amber"  ? "ring-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-300" :
                          "ring-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-300";
  return (
    <div className={`rounded-xl p-3 ring-1 ${ring} flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">{pass}</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300">{warn}</span>
        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300">{crit}</span>
      </div>
    </div>
  );
}
