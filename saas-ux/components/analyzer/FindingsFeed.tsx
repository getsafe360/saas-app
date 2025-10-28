// saas-ux/components/analyzer/FindingsFeed.tsx
"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { type Finding, type Severity, type Pillar } from "./parseFindings";
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
        "rounded-full px-2.5 py-1 text-xs border",
        prevIncludes(show, s) ? "opacity-100" : "opacity-40",
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
        {filtered.map(i => (
          <li key={i.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-sm font-medium">
              {i.text}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Tooltip content="Fix with Copilot">
                <button className="rounded-full border border-sky-500/40 text-sky-300 px-2 py-1 text-xs hover:bg-sky-500/10 inline-flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Fix with Copilot
                </button>
              </Tooltip>
              <Tooltip content="Show evidence (if available)">
                <button className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] inline-flex items-center gap-1">
                  <LinkIcon className="h-3.5 w-3.5" /> Evidence
                </button>
              </Tooltip>
              <Tooltip content="Copy to clipboard">
                <button
                  className="rounded-full border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/[0.08] inline-flex items-center gap-1"
                  onClick={() => navigator.clipboard?.writeText(i.text)}
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

function prevIncludes(a: Severity[], s: Severity) {
  return a.includes(s);
}
