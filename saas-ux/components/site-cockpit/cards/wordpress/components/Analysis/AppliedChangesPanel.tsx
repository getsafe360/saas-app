// components/site-cockpit/cards/wordpress/components/Analysis/AppliedChangesPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AppliedChange } from "@/lib/wordpress/applied-changes";
import type { UndoOutcome } from "./HealthFindingsPanel";

interface AppliedChangesPanelProps {
  siteId: string;
  /** Bump to reload after the checklist applies or undoes something. */
  refreshKey: number;
  onUndo: (runIds: string[]) => Promise<UndoOutcome>;
  /** Tells the card which runs were undone here, so the checklist can follow. */
  onUndone?: (runIds: string[]) => void;
}

const STATE_STYLE: Record<AppliedChange["state"], string> = {
  active: "text-emerald-300 border-emerald-500/40",
  unverified: "text-amber-300 border-amber-500/40",
  undone: "text-neutral-400 border-neutral-600",
};

/**
 * Every change GetSafe 360 made through the connector, kept across reloads,
 * with Undo where the rollback can safely run.
 */
export function AppliedChangesPanel({ siteId, refreshKey, onUndo, onUndone }: AppliedChangesPanelProps) {
  const t = useTranslations("SiteCockpit.wordpress.changes");
  const tFindings = useTranslations("Findings");
  const locale = useLocale();
  const [changes, setChanges] = useState<AppliedChange[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/wordpress/changes`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.error ?? String(response.status));
      setChanges(Array.isArray(body.changes) ? body.changes : []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const titleOf = (change: AppliedChange) => {
    const titles = change.findingIds
      .map((id) => (tFindings.has(`${id}.title`) ? tFindings(`${id}.title`) : null))
      .filter((title): title is string => Boolean(title));
    return titles.length > 0 ? titles.join(", ") : change.title;
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const undo = async (runId: string) => {
    setUndoing(runId);
    setError(null);
    try {
      const outcome = await onUndo([runId]);
      if (!outcome.ok) {
        setError(outcome.error === "undoNewerFirst" ? "undoNewerFirst" : "undo");
      } else if (outcome.undoneRunIds.length > 0) {
        onUndone?.(outcome.undoneRunIds);
      } else {
        setError("undo");
      }
    } finally {
      setUndoing(null);
      await load();
    }
  };

  // Nothing to show until the first change, or when the history could not be loaded.
  if (loadFailed || !changes || changes.length === 0) return null;

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
      aria-labelledby="applied-changes-title"
    >
      <h5 id="applied-changes-title" className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <History className="h-4 w-4" style={{ color: "var(--category-wordpress)" }} />
        {t("title")}
      </h5>
      <p className="mb-3 text-[11px]" style={{ color: "var(--text-subtle)" }}>
        {t("description")}
      </p>

      <ul className="space-y-2">
        {changes.map((change) => (
          <li
            key={change.runId}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">{titleOf(change)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-subtle)" }}>
                <span className={`rounded-full border px-1.5 py-0.5 ${STATE_STYLE[change.state]}`}>
                  {t(`state.${change.state}`)}
                </span>
                <span>
                  {change.state === "undone" && change.undoneAt
                    ? t("undoneAt", { date: formatDate(change.undoneAt) })
                    : t("appliedAt", { date: formatDate(change.appliedAt) })}
                </span>
              </div>
            </div>
            {change.state !== "undone" && (
              change.permanent ? (
                <span className="max-w-[14rem] text-[11px]" style={{ color: "var(--text-subtle)" }}>
                  {t("permanent")}
                </span>
              ) : change.undoable ? (
                <button
                  type="button"
                  className="gs-btn gs-btn-secondary inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs"
                  disabled={undoing !== null}
                  onClick={() => undo(change.runId)}
                >
                  {undoing === change.runId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  {t("undo")}
                </button>
              ) : (
                <span className="max-w-[14rem] text-[11px]" style={{ color: "var(--text-subtle)" }}>
                  {t("newerFirst")}
                </span>
              )
            )}
          </li>
        ))}
      </ul>

      {error && (
        <div role="alert" className="mt-2 rounded-md border border-red-500/40 p-2 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}
    </section>
  );
}
