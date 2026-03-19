export const MICROCOPY_TOOLTIPS = {
  unlimitedRepairs: "tooltips.unlimitedRepairs",
  unlimitedBuilds: "tooltips.unlimitedBuilds",
  priorityQueue: "tooltips.priorityQueue",
  whiteLabelReports: "tooltips.whiteLabelReports",
  tokenUsage: "tooltips.tokenUsage",
  tokenPackUsage: "tooltips.tokenPackUsage",
} as const;

export function MicrocopyTooltip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-2 inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-500/60 text-xs text-slate-300 transition-colors duration-200 hover:border-slate-300/70 hover:text-slate-100"
    >
      i
    </span>
  );
}
