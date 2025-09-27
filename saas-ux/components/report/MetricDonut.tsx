// components/report/MetricDonut.tsx
'use client';
import { motion } from 'framer-motion';

type DonutColor = 'amber' | 'sky' | 'emerald' | 'violet' | 'indigo' | 'slate';

const colorClass: Record<DonutColor, string> = {
  amber: 'text-amber-500',
  sky: 'text-sky-500',
  emerald: 'text-emerald-500',
  violet: 'text-violet-500',
  indigo: 'text-indigo-500',
  slate: 'text-slate-500',
};

export default function MetricDonut({
  value,
  label,
  color = 'emerald'
}: {
  value: number;
  label: string;
  color?: DonutColor;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const R = 26, C = 2 * Math.PI * R, filled = (clamped / 100) * C;

  return (
    <div className="inline-flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" className="drop-shadow">
        <circle
          cx="32" cy="32" r={R} strokeWidth="8"
          className="stroke-black/10 dark:stroke-white/10 fill-none"
        />
        <motion.circle
          cx="32" cy="32" r={R} strokeWidth="8" pathLength={C}
          className={`fill-none stroke-current ${colorClass[color]}`}
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C - filled}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - filled }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <div className="text-2xl font-semibold">
          {clamped}<span className="opacity-60 text-base">/100</span>
        </div>
        <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      </div>
    </div>
  );
}
