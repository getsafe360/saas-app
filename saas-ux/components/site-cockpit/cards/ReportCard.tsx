// components/site-cockpit/cards/ReportCard.tsx
"use client";

import { useState } from "react";
import { Building2, CheckCircle, DollarSign, FileText, Info, Languages, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ReportLink } from "@/components/reports/ReportLink";
import { canGenerateReports, canUseWhiteLabel, isPlanName } from "@/lib/plans/config";

const INCLUDED = ["fixes", "scores", "wordpress", "next", "formats"] as const;
const AGENCY = ["unlimited", "whiteLabel", "noBranding"] as const;
const BENEFITS = [
  { key: "billing", icon: DollarSign },
  { key: "whiteLabel", icon: Building2 },
  { key: "languages", icon: Languages },
] as const;

function ReportInfoModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Reports.info");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-info-title"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--header-bg)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--color-primary-500) l c h / 0.12)", color: "var(--color-primary-400, #60a5fa)" }}
            >
              <FileText className="h-3.5 w-3.5" />
            </span>
            <h2 id="report-info-title" className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("title")}
            </h2>
          </div>
          <button onClick={onClose} className="gs-icon-btn p-1.5" style={{ color: "var(--text-subtle)" }} aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t("lead")}</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-subtle)" }}>{t("body")}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl p-3" style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>{t("includedTitle")}</div>
              <ul className="space-y-1.5">
                {INCLUDED.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-subtle)" }} />
                    {t(`included.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="space-y-2 rounded-xl p-3"
              style={{ background: "oklch(from var(--color-primary-500) l c h / 0.06)", border: "1px solid oklch(from var(--color-primary-500) l c h / 0.2)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-primary-400, #60a5fa)" }}>{t("agencyTitle")}</div>
              <ul className="space-y-1.5">
                {AGENCY.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-primary-400, #60a5fa)" }} />
                    {t(`agency.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportCardProps {
  siteId: string;
  siteName: string;
  planName?: string;
}

export function ReportCard({ siteId, planName = "free" }: ReportCardProps) {
  const t = useTranslations("Reports.card");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const plan = isPlanName(planName) ? planName : "free";
  const planLine = !canGenerateReports(plan) ? t("planFree") : canUseWhiteLabel(plan) ? t("planAgency") : t("planPro");

  return (
    <>
      {showInfoModal && <ReportInfoModal onClose={() => setShowInfoModal(false)} />}

      <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--background-subtle, var(--header-bg))", color: "var(--text-subtle)", border: "1px solid var(--border-default)" }}
          >
            <FileText className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>{t("eyebrow")}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t("title")}</span>
              <button
                onClick={() => setShowInfoModal(true)}
                className="gs-link inline-flex shrink-0 items-center gap-1 text-xs"
                style={{ color: "var(--text-primary)" }}
              >
                <Info className="h-3.5 w-3.5" />
                {t("howItWorks")}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {BENEFITS.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-2.5 rounded-xl p-3" style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}>
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "oklch(from var(--color-primary-500) l c h / 0.10)", color: "var(--color-primary-400, #60a5fa)" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="mb-0.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t(`benefits.${key}.title`)}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>{t(`benefits.${key}.text`)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{planLine}</div>
            <ReportLink siteId={siteId} planName={plan} />
          </div>
        </div>
      </div>
    </>
  );
}
