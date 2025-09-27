// components/report/IssueCard.tsx
import React from 'react';

type Cat = 'seo' | 'performance' | 'accessibility' | 'security';
type Sev = 'low' | 'medium' | 'high';

const catStyles: Record<Cat, {
  wrap: string; pill: string; button: string; ring: string;
}> = {
  seo: { wrap:'text-amber-600 border-amber-300/40',
         pill:'text-amber-600 bg-amber-500/10 border border-amber-500/30',
         button:'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-200',
         ring:'focus-visible:ring-amber-500/40' },
  performance: { wrap:'text-sky-600 border-sky-300/40',
         pill:'text-sky-600 bg-sky-500/10 border border-sky-500/30',
         button:'bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-200',
         ring:'focus-visible:ring-sky-500/40' },
  accessibility: { wrap:'text-emerald-600 border-emerald-300/40',
         pill:'text-emerald-600 bg-emerald-500/10 border border-emerald-500/30',
         button:'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-200',
         ring:'focus-visible:ring-emerald-500/40' },
  security: { wrap:'text-violet-600 border-violet-300/40',
         pill:'text-violet-600 bg-violet-500/10 border border-violet-500/30',
         button:'bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-200',
         ring:'focus-visible:ring-violet-500/40' },
};

const sevPill: Record<Sev, string> = {
  low:    'text-emerald-600 bg-emerald-500/10 border border-emerald-500/30',
  medium: 'text-amber-600 bg-amber-500/10 border border-amber-500/30',
  high:   'text-rose-600 bg-rose-500/10 border border-rose-500/30'
};

export function IssueCard({
  title,
  description,
  suggestion,
  category,
  severity,
  fixAvailable,
  estTokens,
  onFix,
  fixState = 'idle',
  disabled = false
}: {
  title: string;
  description: string;
  suggestion: string;
  category: Cat;
  severity: Sev;
  fixAvailable: boolean;
  estTokens: number;
  onFix?: () => void;
  // ✅ allow "accepted"
  fixState?: 'idle' | 'working' | 'done' | 'insufficient' | 'accepted';
  disabled?: boolean;
}) {
  const c = catStyles[category];

  const label =
    fixState === 'working'      ? 'Fixing…' :
    fixState === 'done'         ? 'Fixed ✓' :
    fixState === 'accepted'     ? 'Accepted ✓' :
    fixState === 'insufficient' ? 'Not enough tokens' :
    'Fix now';

  // ✅ accepted is also disabled
  const isDisabled = disabled || fixState === 'working' || fixState === 'done' || fixState === 'accepted';

  return (
    <article className={`rounded-2xl border p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur ${c.wrap}`}>
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <h4 className="font-medium leading-tight">{title}</h4>
        <span className={`${c.pill} px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase`}>
          {category}
        </span>
      </header>

      {/* Problem */}
      <div className="mt-2 space-y-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="opacity-70">Severity:</span>
          <span className={`${sevPill[severity]} px-2 py-0.5 rounded-md`}>{severity}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px my-4 bg-black/10 dark:bg-white/10 rounded-full" />

      {/* Solution */}
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          <span className="font-medium">Suggestion:</span> {suggestion}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Estimated tokens:&nbsp;<span className="font-medium">~{estTokens.toLocaleString()}</span>
          </span>

          {fixAvailable ? (
            <button
              type="button"
              onClick={onFix}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border border-white/20 ${c.button} focus-visible:outline-none focus-visible:ring-2 ${c.ring} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={label}
            >
              {label}
            </button>
          ) : (
            <span className="text-sm opacity-60">Manual step</span>
          )}
        </div>
      </div>
    </article>
  );
}
