"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { Finding, Severity } from "../types";
import type { CockpitCategory } from "@/lib/cockpit/sse-events";
import { Wrench } from "lucide-react";

type Props = {
  items?: Finding[];
  categories?: CockpitCategory[];
  initialShow?: Severity[];
  title?: string;
  className?: string;
  onFixNow?: (categoryId: string) => void;
};

export default function FindingsFeed({ items = [], categories = [], initialShow, title, className, onFixNow }: Props) {
  const [show, setShow] = useState<Severity[]>(initialShow ?? ["medium", "critical"]);

  const filtered = useMemo(() => items.filter((i) => show.includes(i.severity)), [items, show]);

  if (categories.length > 0) {
    return (
      <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-3", className)}>
        {title && <div className="mb-2 text-sm font-semibold">{title}</div>}
        <div className="grid gap-2 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category.id} className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold capitalize">{category.id}</h4>
                <span className="text-xs text-amber-300">{category.severity ?? 'medium'}</span>
              </div>
              <div className="mt-2 text-xs text-neutral-400">Issues: {category.issues?.length ?? 0}</div>
              <div className="text-xs text-neutral-400">Token cost: {category.tokenCost ?? 0}</div>
              <button
                onClick={() => onFixNow?.(category.id)}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-sky-500/40 text-sky-300 px-2 py-1 text-xs"
              >
                <Wrench className="h-3.5 w-3.5" /> Fix Now
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - categories.length) }).map((_, index) => (
            <div key={`skeleton-${index}`} className="rounded-xl border border-white/10 p-3 animate-pulse bg-white/[0.02] h-24" />
          ))}
        </div>
      </div>
    );
  }

  function toggle(s: Severity) {
    setShow(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const chip = (s: Severity, label: string, cls: string) => (
    <button key={s} onClick={() => toggle(s)} className={cn("rounded-full px-2.5 py-1 text-xs border", show.includes(s) ? "opacity-100" : "opacity-40", cls)}>{label}</button>
  );

  return <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-3", className)}>
    {title && <div className="mb-2 text-sm font-semibold">{title}</div>}
    <div className="mb-2 flex items-center gap-1">
      {chip("minor", "✅ Positive", "border-emerald-500/40 text-emerald-300")}
      {chip("medium", "⚠️ Warning", "border-amber-500/40 text-amber-300")}
      {chip("critical", "🔴 Critical", "border-red-500/40 text-red-300")}
    </div>
    <ul className="space-y-2">
      {filtered.map((finding, index) => <li key={`${finding.pillar}-${finding.title}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">{finding.title}</li>)}
    </ul>
  </div>;
}
