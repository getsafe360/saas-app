// components/site-cockpit/cards/wordpress/components/Analysis/HealthFindingsPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { WordPressHealthFinding } from "@/types/site-cockpit";
import { fixModeFor, type FixMode } from "@/lib/engine/fixers/catalog";
import type { RemediationItem } from "@/lib/wordpress/remediation-result";
import { useFindingText } from "../../hooks/useFindingText";
import {
  estimateSelectedSavingsMs,
  estimateSelectedScoreGain,
} from "../../utils/healthEngine";

export type ApplyOutcome =
  | { ok: true; items: RemediationItem[] }
  | { ok: false; error: string };

export type UndoOutcome =
  | { ok: true; undoneRunIds: string[]; failedRunIds: string[] }
  | { ok: false; error: string };

interface HealthFindingsPanelProps {
  findings: WordPressHealthFinding[];
  onApply?: (
    selected: WordPressHealthFinding[],
    options: { safeMode: boolean },
  ) => Promise<ApplyOutcome>;
  onUndo?: (runIds: string[]) => Promise<UndoOutcome>;
  onRescan?: () => void;
  currentScore?: number;
  /** Runs undone elsewhere (the Applied changes list), so results here stay truthful. */
  externallyUndone?: ReadonlySet<string>;
}

const CATEGORY_LABEL: Record<WordPressHealthFinding["category"], string> = {
  security: "security",
  performance: "performance",
  stability: "stability",
  "seo-ux": "seoUx",
  "red-flags": "redFlags",
};

const MODES: FixMode[] = ["automatic", "guided", "manual"];

export function findingFixMode(finding: WordPressHealthFinding): FixMode {
  return fixModeFor(finding.remediationActionId, finding.automationLevel);
}

function ResultIcon({ item, undone }: { item: RemediationItem; undone: boolean }) {
  if (undone) return <RotateCcw className="h-4 w-4 text-neutral-400" />;
  if (item.reason === "verified") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (item.reason === "verification_failed") return <Clock className="h-4 w-4 text-amber-400" />;
  if (item.status === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

export function HealthFindingsPanel({
  findings,
  onApply,
  onUndo,
  onRescan,
  currentScore = 0,
  externallyUndone,
}: HealthFindingsPanelProps) {
  const t = useTranslations("SiteCockpit.wordpress.findings");
  const text = useFindingText();

  const actionable = useMemo(
    () => findings.filter((f) => f.status === "fail" || f.status === "warning"),
    [findings],
  );

  const byMode = useMemo(() => {
    const groups: Record<FixMode, WordPressHealthFinding[]> = { automatic: [], guided: [], manual: [] };
    for (const finding of actionable) groups[findingFixMode(finding)].push(finding);
    return groups;
  }, [actionable]);

  const automatic = byMode.automatic;
  const prechecked = useMemo(() => automatic.filter((f) => f.checkedByDefault), [automatic]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(prechecked.map((f) => f.id)));
  const [safeMode, setSafeMode] = useState(true);
  const [applying, setApplying] = useState(false);
  const [items, setItems] = useState<RemediationItem[] | null>(null);
  const [undoneHere, setUndoneRunIds] = useState<Set<string>>(new Set());
  const undoneRunIds = useMemo(
    () => new Set([...undoneHere, ...(externallyUndone ?? [])]),
    [undoneHere, externallyUndone],
  );
  const [undoingRunIds, setUndoingRunIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // New scan data: reset the selection and drop results that described the old state.
  useEffect(() => {
    setSelectedIds(new Set(prechecked.map((f) => f.id)));
    setItems(null);
    setUndoneRunIds(new Set());
    setError(null);
  }, [prechecked]);

  const itemByFindingId = useMemo(() => {
    const map = new Map<string, RemediationItem>();
    for (const item of items ?? []) for (const id of item.findingIds) map.set(id, item);
    return map;
  }, [items]);

  // A finding is settled while its change is on the site (applied, or applied but not
  // yet visible). Everything else (never run, failed, skipped, undone) can be applied again.
  const isSettled = (finding: WordPressHealthFinding) => {
    const item = itemByFindingId.get(finding.id);
    if (!item || (item.runId && undoneRunIds.has(item.runId))) return false;
    return item.status === "applied" || item.reason === "verification_failed";
  };

  const pending = automatic.filter((finding) => !isSettled(finding));
  const selected = pending.filter((finding) => selectedIds.has(finding.id));
  const toApply = safeMode ? selected.filter((f) => f.safetyLevel !== "sensitive") : selected;

  const projectedGain = estimateSelectedScoreGain(toApply);
  const projectedScore = Math.min(100, currentScore + projectedGain);
  const projectedSavingsMs = estimateSelectedSavingsMs(toApply);

  const undoableRunIds = (items ?? [])
    .filter((item) => item.undoable && item.runId && !undoneRunIds.has(item.runId))
    .map((item) => item.runId as string);

  const handleApply = async () => {
    if (!onApply || toApply.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const outcome = await onApply(toApply, { safeMode });
      if (outcome.ok) {
        // Newer outcomes replace older ones for the same findings; the rest (and their Undo) stay.
        const rerun = new Set(outcome.items.flatMap((item) => item.findingIds));
        setItems((prev) => [
          ...(prev ?? []).filter((item) => !item.findingIds.some((id) => rerun.has(id))),
          ...outcome.items,
        ]);
      } else {
        setError(outcome.error);
      }
    } finally {
      setApplying(false);
    }
  };

  const handleUndo = async (runIds: string[]) => {
    if (!onUndo || runIds.length === 0) return;
    setUndoingRunIds((prev) => new Set([...prev, ...runIds]));
    setError(null);
    try {
      const outcome = await onUndo(runIds);
      if (outcome.ok) {
        setUndoneRunIds((prev) => new Set([...prev, ...outcome.undoneRunIds]));
        if (outcome.failedRunIds.length > 0) setError("undo");
      } else {
        setError(outcome.error);
      }
    } finally {
      setUndoingRunIds((prev) => {
        const next = new Set(prev);
        for (const id of runIds) next.delete(id);
        return next;
      });
    }
  };

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const counts = items
    ? {
        applied: items.filter((i) => i.status === "applied" && !(i.runId && undoneRunIds.has(i.runId))).length,
        failed: items.filter((i) => i.status === "failed").length,
        skipped: items.filter((i) => i.status === "skipped").length,
      }
    : null;

  const renderFinding = (finding: WordPressHealthFinding, mode: FixMode) => {
    const item = itemByFindingId.get(finding.id);
    const undone = Boolean(item?.runId && undoneRunIds.has(item.runId));
    const settled = isSettled(finding);
    const checked = selectedIds.has(finding.id);
    const gain = finding.estimatedScoreGain ?? 0;

    return (
      <div
        key={finding.id}
        className="flex items-start gap-2 rounded-lg border p-3"
        style={{ borderColor: "var(--border-default)" }}
      >
        {mode === "automatic" &&
          (item && settled ? (
            <div className="mt-0.5">
              <ResultIcon item={item} undone={undone} />
            </div>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              aria-label={text.title(finding)}
              disabled={applying}
              onClick={() => toggle(finding.id)}
              className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? "bg-[var(--category-wordpress)]" : "bg-neutral-600"}`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`}
              />
            </button>
          ))}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm text-white">
            {finding.category === "red-flags" ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> : null}
            {text.title(finding)}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
            {t(`categories.${CATEGORY_LABEL[finding.category]}`)} · {t(`severity.${finding.severity}`)}
            {gain > 0 ? ` · ${t("impactGain", { gain })}` : ""}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
            {text.action(finding)}
          </div>
          {item && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={undone ? "text-neutral-400" : item.reason === "verified" ? "text-emerald-300" : "text-amber-300"}>
                {undone ? t("result.undone") : t(`result.${item.reason}`)}
              </span>
              {item.undoable && item.runId && !undone && onUndo && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-white disabled:opacity-60"
                  style={{ borderColor: "var(--border-default)" }}
                  disabled={undoingRunIds.has(item.runId)}
                  onClick={() => handleUndo([item.runId as string])}
                >
                  {undoingRunIds.has(item.runId) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  {t("undo")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h5 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--category-wordpress)" }} />
          {t("title")}
        </h5>
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {t("modeSummary", {
            automatic: byMode.automatic.length,
            guided: byMode.guided.length,
            manual: byMode.manual.length,
          })}
        </div>
      </div>

      {actionable.length === 0 && (
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {t("noActionable")}
        </div>
      )}

      {automatic.length === 0 && actionable.length > 0 && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
          style={{ borderColor: "var(--border-default)" }}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <div className="font-semibold text-white">{t("allAutomaticDone.title")}</div>
            <div className="mt-0.5" style={{ color: "var(--text-subtle)" }}>
              {t("allAutomaticDone.description")}
            </div>
          </div>
        </div>
      )}

      {automatic.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
              <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("before")}</div>
              <div className="font-semibold text-white">{currentScore}</div>
            </div>
            <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
              <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("after")}</div>
              <div className="font-semibold text-emerald-300">{projectedScore}</div>
            </div>
            <div className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)" }}>
              <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>{t("savings")}</div>
              <div className="font-semibold text-blue-300">~{(projectedSavingsMs / 1000).toFixed(1)}s</div>
            </div>
          </div>

          <div className="mb-3 rounded-lg border p-3" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex items-center justify-between text-xs text-white">
              <span>{t("safeMode")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={safeMode}
                aria-label={t("safeMode")}
                disabled={applying}
                onClick={() => setSafeMode((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${safeMode ? "bg-emerald-500" : "bg-neutral-600"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${safeMode ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-subtle)" }}>
              {safeMode ? t("safeModeDescriptionOn") : t("safeModeDescriptionOff")}
            </div>
          </div>
        </>
      )}

      {MODES.map((mode) =>
        byMode[mode].length === 0 ? null : (
          <div key={mode} className="mb-4">
            <h6 className="text-xs font-semibold uppercase tracking-wide text-white">
              {t(`sections.${mode}.title`)}
            </h6>
            <p className="mb-2 mt-0.5 text-[11px]" style={{ color: "var(--text-subtle)" }}>
              {t(`sections.${mode}.description`)}
            </p>
            <div className="space-y-2">{byMode[mode].map((finding) => renderFinding(finding, mode))}</div>

            {mode === "automatic" && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2" aria-live="polite">
                {counts && (
                  <span className="mr-auto text-xs" style={{ color: "var(--text-subtle)" }}>
                    {t("resultSummary", counts)}
                  </span>
                )}
                {undoableRunIds.length > 1 && onUndo && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs text-white disabled:opacity-60"
                    style={{ borderColor: "var(--border-default)" }}
                    disabled={undoableRunIds.some((id) => undoingRunIds.has(id))}
                    onClick={() => handleUndo(undoableRunIds)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("undoAll")}
                  </button>
                )}
                {items && onRescan && (
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ borderColor: "var(--category-wordpress)" }}
                    onClick={onRescan}
                  >
                    {t("rescan")}
                  </button>
                )}
                {pending.length > 0 && onApply && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--category-wordpress)" }}
                    onClick={handleApply}
                    disabled={applying || toApply.length === 0}
                  >
                    {applying && <Loader2 className="h-3 w-3 animate-spin" />}
                    {applying ? t("applying") : t("applyAutomatic", { count: toApply.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        ),
      )}

      {error && (
        <div role="alert" className="mt-2 rounded-md border border-red-500/40 p-2 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}
    </section>
  );
}
