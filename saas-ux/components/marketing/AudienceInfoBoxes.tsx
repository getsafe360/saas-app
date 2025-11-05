// saas-ux/components/marketing/AudienceInfoBoxes.tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Code2,
  CheckCircle2,
  ArrowRight,
  Dot,
} from "lucide-react";

export default function AudienceInfoBoxes({
  ownerVariant = "spark",
  devVariant = "code",
}: {
  ownerVariant?: "check" | "dot" | "spark" | "code";
  devVariant?: "check" | "dot" | "spark" | "code";
}) {
  const tib = useTranslations("infobox");

  // Bullet items are individual keys to keep translation simple & explicit.
  const ownerItems = [
    tib("owners.items.1"),
    tib("owners.items.2"),
    tib("owners.items.3"),
    tib("owners.items.4"),
    tib("owners.items.5"),
    tib("owners.items.6"),
  ];

  const devItems = [
    tib("devs.items.1"),
    tib("devs.items.2"),
    tib("devs.items.3"),
    tib("devs.items.4"),
    tib("devs.items.5"),
    tib("devs.items.6"),
  ];

  return (
    <section
      aria-label={tib("sectionLabel")} 
      className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-6 px-4 sm:px-6 lg:px-8 mb-12"
    >
      {/* Owners/Webmasters Card */}
      <Card accent="sky" icon={
        <div
          className="size-12 rounded-xl bg-gradient-to-br from-sky-500/15 to-cyan-400/10 dark:from-sky-400/20 dark:to-cyan-400/10 flex items-center justify-center ring-1 ring-sky-500/20"
          aria-hidden
        >
          <Sparkles className="size-7 text-sky-600 dark:text-sky-400" />
        </div>
      }>
        <h3 id="owners-heading" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {tib("owners.title")}
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          {tib.rich("owners.lead", {
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            em: (chunks) => <em className="not-italic underline decoration-sky-400/60 decoration-2 underline-offset-4">{chunks}</em>,
          })}
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {tib("owners.sublead")}
        </p>

        <ul role="list" className="mt-4 space-y-2">
          {ownerItems.map((text, i) => (
            <ListItem key={i} text={text} accent="sky" variant={ownerVariant} />
          ))}
        </ul>

        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          {tib("owners.closing")}
        </p>

        <div className="mt-5">
          <a
            href="#enter-url"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20 transition"
          >
            {tib("owners.cta")} <ArrowRight className="size-4" />
          </a>
        </div>
      </Card>

      {/* Developers/Pros Card */}
      <Card accent="violet" icon={
        <div
          className="size-12 rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-400/10 dark:from-violet-400/20 dark:to-fuchsia-400/10 flex items-center justify-center ring-1 ring-violet-500/20"
          aria-hidden
        >
          <Code2 className="size-7 text-violet-600 dark:text-violet-400" />
        </div>
      }>
        <h3 id="devs-heading" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {tib("devs.title")}
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          {tib.rich("devs.lead", {
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            em: (chunks) => <em className="not-italic underline decoration-violet-400/60 decoration-2 underline-offset-4">{chunks}</em>,
          })}
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {tib("devs.sublead")}
        </p>

        <ul role="list" className="mt-4 space-y-2">
          {devItems.map((text, i) => (
            <ListItem key={i} text={text} accent="violet" variant={devVariant} />
          ))}
        </ul>

        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          {tib("devs.closing")}
        </p>

        <div className="mt-5">
          <a
            href="#enter-url"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-violet-600/30 dark:ring-violet-400/30 bg-violet-50 dark:bg-violet-400/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-400/20 transition"
          >
            {tib("devs.cta")} <ArrowRight className="size-4" />
          </a>
        </div>
      </Card>
    </section>
  );
}

/** Card shell with accent stripe and soft glass background */
function Card({
  children,
  icon,
  accent = "sky",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  accent?: "sky" | "violet";
}) {
  const accentTopBar =
    accent === "violet"
      ? "bg-gradient-to-r from-violet-500/70 via-fuchsia-400/70 to-pink-400/70"
      : "bg-gradient-to-r from-sky-500/70 via-cyan-400/70 to-teal-400/70";

  return (
    <div
      className="group relative overflow-hidden rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm hover:shadow-xl transition-shadow"
    >
      <div className={`h-1 ${accentTopBar}`} aria-hidden />

      <div className="p-6">
        <div className="flex items-center gap-3">
          {icon}
          {/* Gradient heading shimmer on hover */}
          <div className="i-hidden" />
        </div>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

/** List item with selectable icon variant and subtle accent ring */
function ListItem({
  text,
  accent = "sky",
  variant = "check",
}: {
  text: string;
  accent?: "sky" | "violet";
  variant?: "check" | "dot" | "spark" | "code";
}) {
  const iconClass = accent === "violet" ? "text-violet-600 dark:text-violet-400" : "text-sky-600 dark:text-sky-400";
  const ringClass = accent === "violet" ? "ring-violet-500/20" : "ring-sky-500/20";

  const Icon = variant === "spark" ? Sparkles : variant === "dot" ? Dot : variant === "code" ? Code2 : CheckCircle2;

  return (
    <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
      <span
        className={`mt-0.5 inline-flex items-center justify-center rounded-md ${ringClass} ring-1 bg-white/70 dark:bg-white/5 size-6 shrink-0`}
        aria-hidden
      >
        <Icon className={`size-4 ${iconClass}`} />
      </span>
      <span className="leading-relaxed">{text}</span>
    </li>
  );
}
