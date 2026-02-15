"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  AlertCircle,
  CheckCircle,
  Globe,
  GripVertical,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { getCMSInfo } from "@/components/analyzer/cms/cms-signatures";
import type { CategoryType, Summary } from "@/types/site-cockpit";

interface OverallScoreHeroProps {
  summary: Summary;
  domain: string;
  finalUrl: string;
  metaTitle?: string;
  cms?: {
    type: string;
    name?: string;
    version?: string;
  };
  onOptimizeCategory?: (
    category: Extract<
      CategoryType,
      "performance" | "security" | "seo" | "accessibility"
    >,
  ) => Promise<void>;
  optimizingCategory?: string | null;
}

const PERFORMANCE = "performance" as const;
const SECURITY = "security" as const;
const SEO = "seo" as const;
const ACCESSIBILITY = "accessibility" as const;

type HeroCategory =
  | typeof PERFORMANCE
  | typeof SECURITY
  | typeof SEO
  | typeof ACCESSIBILITY;

const CATEGORY_CONFIG: Record<
  HeroCategory,
  { icon: ComponentType<{ className?: string }>; color: string }
> = {
  performance: { icon: Zap, color: "var(--category-performance)" },
  security: { icon: Shield, color: "var(--category-security)" },
  seo: { icon: Search, color: "var(--category-seo)" },
  accessibility: {
    icon: Accessibility,
    color: "var(--category-accessibility)",
  },
};

function CategorySnapshotCard({
  category,
  summary,
  label,
  onOptimizeCategory,
  optimizingCategory,
  t,
}: {
  category: HeroCategory;
  summary: Summary;
  label: string;
  onOptimizeCategory?: (
    category: Extract<
      CategoryType,
      "performance" | "security" | "seo" | "accessibility"
    >,
  ) => Promise<void>;
  optimizingCategory?: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const score = summary.categoryScores[category] ?? 0;
  const insights = summary.categoryInsights?.[category];
  const config = CATEGORY_CONFIG[category];
  const CategoryIcon = config.icon;

  return (
    <div
      className="rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        borderColor: `oklch(from ${config.color} l c h / 0.35)`,
        background: "var(--header-bg)",
        boxShadow: "0 0 0 rgba(0,0,0,0)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 28px oklch(from ${config.color} l c h / 0.18)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: `oklch(from ${config.color} l c h / 0.12)`,
              color: config.color,
            }}
          >
            <CategoryIcon className="h-4 w-4" />
          </span>
          <div className="truncate font-medium" style={{ color: config.color }}>
            {label}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-lg font-bold" style={{ color: config.color }}>
            {score}
          </div>
          <GripVertical
            className="h-4 w-4"
            style={{ color: "var(--text-subtle)" }}
          />
        </div>
      </div>

      <div
        className="mb-3 h-1.5 rounded-full"
        style={{ background: "var(--color-neutral-300)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: config.color }}
        />
      </div>

      <div className="mb-3 text-xs" style={{ color: "var(--text-subtle)" }}>
        {t("summary.passed")}: {insights?.passed ?? summary.passed} ·{" "}
        {t("summary.warnings")}: {insights?.warnings ?? summary.warnings} ·{" "}
        {t("summary.criticalIssues")}:{" "}
        {insights?.criticalIssues ?? summary.criticalIssues}
      </div>

      {insights?.topIssues?.length ? (
        <div
          className="mb-3 rounded-lg border px-2.5 py-2 text-xs"
          style={{
            borderColor: `oklch(from ${config.color} l c h / 0.30)`,
            color: "var(--text-subtle)",
          }}
        >
          <span className="font-medium" style={{ color: config.color }}>
            {t("summary.criticalIssues")}:
          </span>{" "}
          {insights.topIssues[0]}
        </div>
      ) : null}

      <button
        className="w-full rounded-xl px-3 py-2 text-sm font-semibold border transition"
        style={{
          borderColor: `oklch(from ${config.color} l c h / 0.55)`,
          background: `oklch(from ${config.color} l c h / 0.12)`,
          color: config.color,
        }}
        onClick={() => onOptimizeCategory?.(category)}
        disabled={optimizingCategory === category}
      >
        {optimizingCategory === category ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </span>
        ) : (
          t("actions.optimize")
        )}
      </button>
    </div>
  );
}

export function OverallScoreHero({
  summary,
  domain,
  finalUrl,
  metaTitle,
  cms,
  onOptimizeCategory,
  optimizingCategory,
}: OverallScoreHeroProps) {
  const t = useTranslations("SiteCockpit");
  const [imageError, setImageError] = useState(false);

  const screenshotUrl = useMemo(
    () => `/api/screenshot?w=360&q=55&url=${encodeURIComponent(finalUrl)}`,
    [finalUrl],
  );

  const cmsInfo = getCMSInfo((cms?.type || "custom") as any);
  const CmsIcon = typeof cmsInfo?.icon === "function" ? cmsInfo.icon : null;
  const hasMetaTitle = Boolean(metaTitle?.trim());

  return (
    <div
      className="border-b"
      style={{
        background: "var(--background-default)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div
            className="lg:col-span-2 rounded-2xl border p-4"
            style={{
              background: "var(--header-bg)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="col-span-1">
                <div
                  className="aspect-[4/3] overflow-hidden rounded-sm border"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--color-neutral-200)",
                  }}
                >
                  {!imageError ? (
                    <img
                      src={screenshotUrl}
                      alt={t("summary.title")}
                      className="h-full w-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Globe className="h-5 w-5" />
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2 min-w-0">
                <h1
                  className="text-2xl font-semibold truncate"
                  style={{ color: "var(--text-default)" }}
                >
                  {domain}
                </h1>
                <div
                  className="text-sm mt-1 truncate flex items-center gap-2"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {hasMetaTitle ? (
                    <>
                      <span className="font-medium">
                        {t("seo.meta.title")}:
                      </span>
                      <span>{metaTitle}</span>
                    </>
                  ) : (
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ background: "var(--category-security)" }}
                    />
                  )}
                </div>
                {cms && (
                  <div
                    className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-subtle)",
                    }}
                  >
                    {CmsIcon ? (
                      <CmsIcon size={14} />
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                    <span>{cms.name || cms.type}</span>
                    {cms.version && <span>v{cms.version}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              background: "var(--header-bg)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="var(--border-default)"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="var(--color-primary-500)"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(summary.overallScore / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xl font-bold">
                    {summary.overallScore}
                  </div>
                  <div className="text-[10px]">{summary.grade}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {t("summary.passed")}: {summary.passed}
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  {t("summary.warnings")}: {summary.warnings}
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  {t("summary.criticalIssues")}: {summary.criticalIssues}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategorySnapshotCard
            category={PERFORMANCE}
            summary={summary}
            label={t("performance.title")}
            onOptimizeCategory={onOptimizeCategory}
            optimizingCategory={optimizingCategory}
            t={t}
          />
          <CategorySnapshotCard
            category={SECURITY}
            summary={summary}
            label={t("security.title")}
            onOptimizeCategory={onOptimizeCategory}
            optimizingCategory={optimizingCategory}
            t={t}
          />
          <CategorySnapshotCard
            category={SEO}
            summary={summary}
            label={t("seo.title")}
            onOptimizeCategory={onOptimizeCategory}
            optimizingCategory={optimizingCategory}
            t={t}
          />
          <CategorySnapshotCard
            category={ACCESSIBILITY}
            summary={summary}
            label={t("accessibility.title")}
            onOptimizeCategory={onOptimizeCategory}
            optimizingCategory={optimizingCategory}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
