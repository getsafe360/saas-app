// components/analyzer/display/ScoreBar.tsx
import { cn } from "@/lib/cn";

type Props = {
  category: "seo" | "a11y" | "perf" | "sec";
  label: string;
  icon: string;
  score?: number; // 0-100, optional for vague display
  pass?: number;
  warn?: number;
  crit?: number;
};

const CATEGORY_COLORS = {
  seo: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    bar: "bg-gradient-to-r from-blue-500 to-blue-400",
  },
  a11y: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    bar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  },
  perf: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    bar: "bg-gradient-to-r from-amber-500 to-amber-400",
  },
  sec: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    bar: "bg-gradient-to-r from-purple-500 to-purple-400",
  },
};

export default function ScoreBar({
  category,
  label,
  icon,
  score,
  pass = 0,
  warn = 0,
  crit = 0,
}: Props) {
  const colors = CATEGORY_COLORS[category];

  // Calculate vague score if not provided
  const displayScore = score ?? calculateVagueScore(pass, warn, crit);

  // Convert to percentage for bar width (add some randomness for "vague" feel)
  const barWidth = Math.min(
    100,
    Math.max(20, displayScore + (Math.random() * 10 - 5))
  );

  return (
    <div className={cn("rounded-xl border p-4", colors.bg, colors.border)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={cn("text-sm font-semibold", colors.text)}>
          {label}
        </span>
      </div>

      {/* Vague Score Bar - no exact numbers */}
      <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-out",
            colors.bar
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Issue indicators (no counts, just presence) */}
      <div className="mt-3 flex gap-2">
        {crit > 0 && <div className="h-2 w-2 rounded-full bg-red-500" />}
        {warn > 0 && <div className="h-2 w-2 rounded-full bg-amber-500" />}
        {pass > 0 && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
      </div>
    </div>
  );
}

function calculateVagueScore(pass: number, warn: number, crit: number): number {
  const total = pass + warn + crit;
  if (total === 0) return 85; // Default vague "good" score
  return Math.round(((pass + warn * 0.5) / total) * 100);
}
