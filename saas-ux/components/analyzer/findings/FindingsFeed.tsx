// components/analyzer/findings/FindingsFeed.tsx
"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { Finding, Severity, Pillar } from "../types";
import { Tooltip } from "@/components/ui/Tooltip";
import { Wrench, Link as LinkIcon, Copy } from "lucide-react";

type Props = {
  items: Finding[];
  initialShow?: Severity[];      // defaults to ['medium','critical']
  title?: string;
  className?: string;
};

const ALL: Severity[] = ["minor", "medium", "critical"];

export default function FindingsFeed({ items, initialShow, title, className }: Props) {
  const [show, setShow] = useState<Severity[]>(initialShow ?? ["medium", "critical"]);

  const filtered = useMemo(
    () => items.filter(i => show.includes(i.severity)),
    [items, show]
  );

  function toggle(s: Severity) {
    setShow(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const chip = (s: Severity, label: string, cls: string) => (
    <button
      key={s}
      onClick={() => toggle(s)}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs border transition-opacity",
        show.includes(s) ? "opacity-100" : "opacity-40",
        cls
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-3", className)}>
      {title && <div className="mb-2 text-sm font-semibold">{title}</div>}
      <div className="mb-2 flex items-center gap-1">
        {chip("minor", "✅ Positive", "border-emerald-500/40 text-emerald-300")}
        {chip("medium", "⚠️ Warning", "border-amber-500/40 text-amber-300")}
        {chip("critical", "🔴 Critical", "border-red-500/40 text-red-300")}
      </div>
      <ul className="space-y-2">
        {filtered.map((finding, index) => (
          <li 
            key={`${finding.pillar}-${finding.severity}-${index}`} 
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {finding.severity === 'critical' ? '🔴' : finding.severity === 'medium' ? '⚠️' : '✅'}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {finding.title}
                </div>
                {finding.description && (
                  <div className="mt-1 text-xs text-neutral-400">
                    {finding.description}
                  </div>
                )}
                {finding.recommendation && (
                  <div className="mt-2 text-xs text-sky-300">
                    💡 {finding.recommendation}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Tooltip content="Fix with Copilot">
                <button className="rounded-full border border-sky-500/40 text-sky-300 px-2 py-1 text-xs hover:bg-sky-500/10 inline-flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Fix
                </button>
              </Tooltip>
              {finding.code && (
                <Tooltip content="Show code">
                  <button className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] inline-flex items-center gap-1">
                    <LinkIcon className="h-3.5 w-3.5" /> Code
                  </button>
                </Tooltip>
              )}
              <Tooltip content="Copy to clipboard">
                <button
                  className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] inline-flex items-center gap-1"
                  onClick={() => {
                    const text = `${finding.title}\n${finding.description || ''}\n${finding.recommendation || ''}`;
                    navigator.clipboard?.writeText(text.trim());
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </Tooltip>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-xs text-neutral-400">No items for current filters.</li>
        )}
      </ul>
    </div>
  );
}