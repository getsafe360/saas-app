"use client";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import { HelpCircle } from "lucide-react";

type Props = {
  label: string;
  ok: number;
  warn: number;
  crit: number;
  tooltip?: string;      // NEW
  onClick?: () => void;
  className?: string;
};

export function ScoreBar({ label, ok, warn, crit, tooltip, onClick, className }: Props) {
  const total = Math.max(1, ok + warn + crit);
  const okPct = (ok / total) * 100;
  const warnPct = (warn / total) * 100;
  const critPct = (crit / total) * 100;

  const Bar = (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div className="h-full bg-emerald-500" style={{ width: `${okPct}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${warnPct}%` }} />
      <div className="h-full bg-red-500" style={{ width: `${critPct}%` }} />
    </div>
  );

  return (
    <button onClick={onClick} className={cn("group w-full text-left", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="inline-flex items-center gap-1.5">
          <span className="font-medium">{label}</span>
          {tooltip && (
            <Tooltip content={tooltip}>
              <span className="inline-flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </Tooltip>
          )}
        </div>
        <span className="text-neutral-500">{ok + warn + crit}</span>
      </div>
      {Bar}
      <div className="mt-1 flex gap-3 text-xs text-neutral-500">
        <span>✅ {ok}</span><span>⚠️ {warn}</span><span>🔴 {crit}</span>
      </div>
    </button>
  );
}
