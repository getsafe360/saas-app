// components/ui/TokenUsageBar.tsx
// Live token usage indicator shown in the SEO analysis drawer footer.
// Reflects monthly consumption with a soft-cap warning at 80%.
"use client";

import { cn } from "@/lib/utils";

interface TokenUsageBarProps {
  tokensUsed: number;
  tokensTotal: number;
  tokensConsumedThisAnalysis: number;
  modelLabel: string;
  className?: string;
}

export function TokenUsageBar({
  tokensUsed,
  tokensTotal,
  tokensConsumedThisAnalysis,
  modelLabel,
  className,
}: TokenUsageBarProps) {
  const pct = tokensTotal > 0 ? Math.min(1, tokensUsed / tokensTotal) : 0;
  const isWarning = pct >= 0.8;
  const isCritical = pct >= 1;

  const barColor = isCritical
    ? "var(--category-security)"   // red
    : isWarning
    ? "oklch(0.75 0.18 55)"        // amber
    : "var(--category-performance)"; // green

  const remaining = Math.max(0, tokensTotal - tokensUsed);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Bar */}
      <div className="relative h-1.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct * 100}%`, background: barColor }}
        />
      </div>

      {/* Labels row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">
          {tokensConsumedThisAnalysis.toLocaleString()} tokens used this analysis
        </span>
        <span className={cn("font-medium", isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-white/60")}>
          {remaining.toLocaleString()} remaining this month
        </span>
      </div>

      {/* Model badge row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/30">Powered by {modelLabel}</span>
        {isCritical && (
          <span className="text-xs font-medium text-red-400">Token limit reached</span>
        )}
        {isWarning && !isCritical && (
          <span className="text-xs font-medium text-amber-400">80% used — consider upgrading</span>
        )}
      </div>
    </div>
  );
}
