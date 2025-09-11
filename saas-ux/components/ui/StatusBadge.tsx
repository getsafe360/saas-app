// No "use client" needed; purely presentational.
export type StatusKey = "connected" | "pending" | "error" | "unknown";

type Props = {
  status: string;               // raw status from data
  size?: "sm" | "md";           // visual size
  className?: string;           // extra classes
};

const STATUS_THEME: Record<StatusKey, { badge: string; dot: string }> = {
  connected: {
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 " +
      "dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  pending: {
    badge:
      "bg-amber-100 text-amber-800 border-amber-200 " +
      "dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  error: {
    badge:
      "bg-rose-100 text-rose-800 border-rose-200 " +
      "dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  unknown: {
    badge:
      "bg-slate-100 text-slate-800 border-slate-200 " +
      "dark:bg-slate-900/70 dark:text-slate-300 dark:border-slate-800",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
};

function toKey(status?: string): StatusKey {
  const k = (status || "").toLowerCase().trim();
  if (k === "connected") return "connected";
  if (k === "pending" || k === "connecting") return "pending";
  if (k === "error" || k === "failed" || k === "disconnected") return "error";
  return "unknown";
}

export default function StatusBadge({ status, size = "md", className = "" }: Props) {
  const key = toKey(status);
  const { badge, dot } = STATUS_THEME[key];

  const sizing =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[11px]"
      : "gap-1.5 px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizing} ${badge} ${className}`}
      aria-label={`Status: ${key}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span className="capitalize">{status}</span>
    </span>
  );
}
