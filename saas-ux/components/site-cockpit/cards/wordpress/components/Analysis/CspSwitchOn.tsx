// components/site-cockpit/cards/wordpress/components/Analysis/CspSwitchOn.tsx
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { applyVerdicts, type CspCandidate } from "@/lib/security/csp/proposal";

interface ReviewedCandidate extends CspCandidate {
  decision: "allow" | "block";
  reason: string | null;
}

interface Review {
  aiUsed: boolean;
  summary: string | null;
  testedPolicy: string;
  candidates: ReviewedCandidate[];
}

interface CspSwitchOnProps {
  siteId: string;
  /** Days the report-only test has been running. */
  days: number;
  onEnforced: (visible: boolean) => void;
}

/** A week of normal traffic usually shows everything a site loads. */
const RECOMMENDED_DAYS = 7;
const ERRORS = new Set(["RATE_LIMITED", "NO_TEST", "REVIEW_STALE", "INVALID_POLICY", "CONNECTOR_UPDATE", "CONNECTOR_UNREACHABLE", "CONNECTOR_FAILED", "WORDPRESS_NOT_CONNECTED"]);

/**
 * Phase 2 of the CSP builder: Claude reviews what the test reported, the owner
 * decides source by source, and the policy is switched on (with undo).
 */
export function CspSwitchOn({ siteId, days, onEnforced }: CspSwitchOnProps) {
  const t = useTranslations("SiteCockpit.wordpress.csp.switch");
  const tErrors = useTranslations("SiteCockpit.wordpress.csp.errors");
  const locale = useLocale();
  const [review, setReview] = useState<Review | null>(null);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"review" | "enforce" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fail = (code: unknown) => setError(typeof code === "string" && ERRORS.has(code) ? code : "GENERIC");

  const runReview = async () => {
    setBusy("review");
    setError(null);
    setConfirming(false);
    try {
      const response = await fetch(`/api/sites/${siteId}/csp/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) return fail(body?.error);
      const next = body as Review;
      setReview(next);
      setAllowed(new Set(next.candidates.filter((candidate) => candidate.decision === "allow").map((candidate) => candidate.key)));
    } catch {
      fail("GENERIC");
    } finally {
      setBusy(null);
    }
  };

  const enforce = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy("enforce");
    setError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/csp/enforce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow: [...allowed] }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) return fail(body?.error);
      onEnforced(Boolean(body.visible));
    } catch {
      fail("GENERIC");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  // The same computation the server does, so the preview matches what will be sent.
  const policy = useMemo(
    () => (review ? applyVerdicts(review.testedPolicy, review.candidates, [...allowed]) : ""),
    [review, allowed],
  );

  const toggle = (key: string) =>
    setAllowed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "oklch(from var(--category-security) l c h / 0.4)" }}>
      <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--category-security)" }} />
        {t("title")}
      </p>

      {!review && (
        <>
          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {days < RECOMMENDED_DAYS ? t("early", { days, recommended: RECOMMENDED_DAYS }) : t("ready")}
          </p>
          <button
            type="button"
            onClick={runReview}
            disabled={busy !== null}
            className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            {busy === "review" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy === "review" ? t("reviewing") : t("review")}
          </button>
        </>
      )}

      {review && (
        <>
          {review.summary && (
            <p className="text-xs" style={{ color: "var(--text-primary)" }}>
              {review.summary}
            </p>
          )}
          {!review.aiUsed && review.candidates.length > 0 && <p className="text-[11px] text-amber-300">{t("aiUnavailable")}</p>}

          {review.candidates.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-primary)" }}>
              {t("noCandidates")}
            </p>
          ) : (
            <>
              <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
                {t("decide")}
              </p>
              <ul className="space-y-1.5">
                {review.candidates.map((candidate) => {
                  const on = allowed.has(candidate.key);
                  return (
                    <li key={candidate.key} className="gs-row flex items-start gap-2 px-1.5 py-1">
                      <input
                        type="checkbox"
                        id={`csp-${candidate.key}`}
                        checked={on}
                        onChange={() => toggle(candidate.key)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <label htmlFor={`csp-${candidate.key}`} className="min-w-0 flex-1 cursor-pointer text-[11px]">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <code style={{ color: "var(--text-subtle)" }}>{candidate.directive}</code>
                          <code className="break-all" style={{ color: "var(--text-primary)" }}>{candidate.source}</code>
                          <span style={{ color: "var(--text-subtle)" }}>{t("count", { count: candidate.count })}</span>
                          <span className={on ? "text-emerald-300" : "text-red-300"}>{on ? t("allow") : t("block")}</span>
                          {candidate.risky && (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              {t("risky")}
                            </span>
                          )}
                        </span>
                        {candidate.reason && (
                          <span className="mt-0.5 block" style={{ color: "var(--text-subtle)" }}>
                            {candidate.reason}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <details className="text-[11px]">
            <summary className="gs-link cursor-pointer text-sky-300">{t("showPolicy")}</summary>
            <code className="mt-1 block break-all rounded-md border p-2" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}>
              {policy}
            </code>
          </details>

          <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            {t("warning")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enforce}
              disabled={busy !== null}
              className="gs-btn gs-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {busy === "enforce" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirming ? t("confirm") : t("enforce")}
            </button>
            <button
              type="button"
              onClick={runReview}
              disabled={busy !== null}
              className="gs-btn gs-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
            >
              {busy === "review" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {t("reviewAgain")}
            </button>
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 p-2 text-xs text-red-300">
          {tErrors(error)}
        </div>
      )}
    </div>
  );
}
