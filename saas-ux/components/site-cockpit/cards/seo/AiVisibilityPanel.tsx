// components/site-cockpit/cards/seo/AiVisibilityPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Eye, Link2, Loader2, Lock, Pencil, Plus, Quote, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import type { QuestionResult, TrackedQuestion, VisibilityRun } from "@/lib/ai-visibility/types";
import { ESTIMATED_TOKENS_PER_QUESTION, QUESTION_MAX_CHARS } from "@/lib/ai-visibility/config";

interface PanelData {
  questions: TrackedQuestion[];
  language: string | null;
  latest: VisibilityRun | null;
  competitors: Array<{ host: string; questions: number }>;
  history: Array<{ checkedAt: string; score: number }>;
  plan: { name: string; questionLimit: number; weekly: boolean; canRun: boolean; trialUsed: boolean };
}

const ERRORS = new Set([
  "NOT_CONFIGURED", "RATE_LIMITED", "SITE_UNREACHABLE", "SUGGEST_FAILED", "NO_QUESTIONS",
  "INSUFFICIENT_TOKENS", "TRIAL_USED", "ALREADY_RUNNING", "RUN_FAILED",
]);

function scoreColor(score: number) {
  if (score >= 60) return "text-emerald-400";
  if (score >= 25) return "text-amber-400";
  return "text-red-400";
}

/**
 * AI visibility: Claude, with web search, is asked the questions a site's
 * customers would ask. Each answer is measured: does it name the site, does it
 * cite it, which other sites does it cite instead.
 */
export function AiVisibilityPanel({ siteId }: { siteId: string }) {
  const t = useTranslations("SiteCockpit.aiVisibility");
  const format = useFormatter();
  const locale = useLocale();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"suggest" | "save" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${siteId}/ai-visibility`, { cache: "no-store" });
      if (response.ok) setData((await response.json()) as PanelData);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (kind: "suggest" | "save" | "run", path: string, body?: unknown) => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/ai-visibility${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(ERRORS.has(json?.error) ? json.error : "GENERIC");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("GENERIC");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const suggest = () => call("suggest", "/questions", { action: "suggest", locale });
  const save = async () => {
    if (await call("save", "/questions", { questions: draft, locale })) setEditing(false);
  };
  const runCheck = () => call("run", "/run");

  const startEditing = () => {
    setDraft((data?.questions ?? []).map((question) => question.text));
    setEditing(true);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("loading")}
      </div>
    );
  }
  if (!data) return null;

  const { plan, latest } = data;
  const limit = plan.questionLimit;
  const resultsById = new Map<string, QuestionResult>((latest?.results ?? []).map((result) => [result.questionId, result]));
  const runCount = Math.min(data.questions.length, limit);

  const runButton = () => {
    if (data.questions.length === 0 || editing) return null;
    if (!plan.canRun) {
      return (
        <Link href="/pricing" className="gs-btn gs-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
          <Lock className="h-3.5 w-3.5" />
          {t("unlock")}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={runCheck}
        disabled={busy !== null}
        className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
      >
        {busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {busy === "run" ? t("running") : plan.weekly ? t("checkNow") : t("runTrial")}
      </button>
    );
  };

  const resultLine = (result: QuestionResult | undefined) => {
    if (!result) return <span style={{ color: "var(--text-subtle)" }}>{t("notChecked")}</span>;
    if (result.error) return <span className="text-red-300">{t("answerFailed")}</span>;
    if (result.cited) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <Link2 className="h-3.5 w-3.5" />
          {t("cited")}
        </span>
      );
    }
    if (result.mentioned) {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <Eye className="h-3.5 w-3.5" />
          {t("mentioned")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-red-400">
        <CircleDashed className="h-3.5 w-3.5" />
        {result.foundInSearch ? t("foundNotUsed") : t("absent")}
      </span>
    );
  };

  const editor = () => (
    <div className="space-y-2">
      {draft.map((text, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={text}
            maxLength={QUESTION_MAX_CHARS}
            onChange={(event) => setDraft((prev) => prev.map((value, i) => (i === index ? event.target.value : value)))}
            aria-label={t("questionLabel", { number: index + 1 })}
            className="min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={() => setDraft((prev) => prev.filter((_, i) => i !== index))}
            aria-label={t("remove")}
            className="gs-link p-1"
            style={{ color: "var(--text-subtle)" }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {draft.length < limit && (
          <button type="button" onClick={() => setDraft((prev) => [...prev, ""])} className="gs-link inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-subtle)" }}>
            <Plus className="h-3.5 w-3.5" />
            {t("add")}
          </button>
        )}
        <span className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("limit", { count: draft.length, limit })}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="gs-btn gs-btn-secondary rounded-lg px-3 py-1.5 text-xs">
            {t("cancel")}
          </button>
          <button type="button" onClick={save} disabled={busy !== null} className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
            {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="space-y-4 rounded-xl border p-4" style={{ borderColor: "var(--border-default)" }} id="ai-visibility">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            <Sparkles className="h-4 w-4" style={{ color: "var(--category-seo)" }} />
            {t("title")}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-subtle)" }}>{t("subtitle")}</p>
          {latest && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              {t("checked", { date: format.dateTime(new Date(latest.checkedAt), { dateStyle: "medium", timeStyle: "short" }) })}
              {plan.weekly && ` · ${t("weekly")}`}
            </p>
          )}
        </div>
        {runButton()}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-xs text-red-300">
          {t(`errors.${error}`)}
        </div>
      )}

      {data.questions.length === 0 && !editing ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-subtle)" }}>
          <p>{t("empty")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={suggest} disabled={busy !== null} className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
              {busy === "suggest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy === "suggest" ? t("suggesting") : t("suggest")}
            </button>
            <button type="button" onClick={() => { setDraft([""]); setEditing(true); }} className="gs-link text-xs">
              {t("writeOwn")}
            </button>
          </div>
        </div>
      ) : editing ? (
        editor()
      ) : (
        <>
          {latest && (
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("score")}</p>
                <p className={`text-3xl font-bold ${scoreColor(latest.score)}`}>{latest.score}</p>
              </div>
              {data.history.length > 1 && (
                <div className="flex h-10 items-end gap-1" aria-label={t("trend")}>
                  {data.history.slice(-12).map((point) => (
                    <span
                      key={point.checkedAt}
                      title={`${format.dateTime(new Date(point.checkedAt), { dateStyle: "short" })}: ${point.score}`}
                      className="w-2 rounded-sm bg-current opacity-70"
                      style={{ height: `${Math.max(4, point.score * 0.4)}px`, color: "var(--category-seo)" }}
                    />
                  ))}
                </div>
              )}
              {data.competitors.length > 0 && (
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("competitors")}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-primary)" }}>
                    {data.competitors.map((c) => `${c.host} (${c.questions})`).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <ul className="divide-y" style={{ borderColor: "var(--border-default)" }}>
            {data.questions.map((question, index) => {
              const result = resultsById.get(question.id);
              const outsideLimit = index >= limit;
              return (
                <li key={question.id} className={`py-2.5 ${outsideLimit ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm" style={{ color: "var(--text-primary)" }}>{question.text}</p>
                    <span className="text-xs">{resultLine(result)}</span>
                  </div>
                  {result && !result.error && result.excerpt && (
                    <p className="mt-1 flex gap-1.5 text-xs" style={{ color: "var(--text-subtle)" }}>
                      <Quote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{result.excerpt}</span>
                    </p>
                  )}
                  {result && !result.error && !result.cited && result.otherSources.length > 0 && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
                      {t("citedInstead", { sites: result.otherSources.map((s) => s.host).join(", ") })}
                    </p>
                  )}
                  {result?.cited && result.citedUrls[0] && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {new URL(result.citedUrls[0]).pathname}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
            <button type="button" onClick={startEditing} className="gs-link inline-flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" />
              {t("edit")}
            </button>
            {plan.weekly && plan.canRun && <span>{t("cost", { tokens: format.number(runCount * ESTIMATED_TOKENS_PER_QUESTION) })}</span>}
            {!plan.weekly && (plan.trialUsed ? <span>{t("trialUsed")}</span> : <span>{t("trialNote", { count: runCount })}</span>)}
          </div>
          <p className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("method")}</p>
        </>
      )}
    </section>
  );
}
