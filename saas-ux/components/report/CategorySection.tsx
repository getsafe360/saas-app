// components/report/CategorySection.tsx
import MetricDonut from './MetricDonut';

export function CategorySection({
  title, score, issues, accent
}: {
  title: string;
  score: number;
  issues: React.ReactNode[];
  accent: 'amber' | 'sky' | 'emerald' | 'violet';
}) {
  const ring = {
    amber: 'from-amber-500/20 to-transparent',
    sky: 'from-sky-500/20 to-transparent',
    emerald: 'from-emerald-500/20 to-transparent',
    violet: 'from-violet-500/20 to-transparent'
  }[accent];

  const hasIssues = issues.length > 0;

  return (
    <section className="rounded-3xl border p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-radial ${ring} pointer-events-none`} />
      <div className="flex items-center justify-between mb-4 relative">
        <h3 className="text-lg font-semibold">{title}</h3>
        <MetricDonut value={score} label="Score" color={accent} />
      </div>

      <div className="grid gap-3 relative">
        {hasIssues ? (
          issues
        ) : (
          <div className="rounded-xl border border-white/20 dark:border-white/10 p-4 text-sm text-slate-600 dark:text-slate-300 bg-white/40 dark:bg-slate-900/30">
            🎉 No issues found in this category.
          </div>
        )}
      </div>
    </section>
  );
}
