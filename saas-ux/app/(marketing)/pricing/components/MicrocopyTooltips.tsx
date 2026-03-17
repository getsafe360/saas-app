export const MICROCOPY_TOOLTIPS = {
  unlimitedRepairs:
    "Unlimited repairs: Run as many AI fixes as you need without limits.",
  unlimitedBuilds:
    "Unlimited builds: Generate new components, pages, and code with no usage cap.",
  priorityQueue:
    "Priority queue: Your tasks are processed faster during peak times.",
  whiteLabelReports:
    "White-label reports: Export client-ready reports with your own branding.",
  tokenUsage: "Token usage: Tokens are consumed when running AI operations.",
  tokenPackUsage:
    "Tokens are consumed when running AI repairs, builds, or advanced analyses.",
} as const;

export function MicrocopyTooltip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-500/60 text-xs text-neutral-300"
    >
      i
    </span>
  );
}
