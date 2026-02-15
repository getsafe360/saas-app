"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle, Globe, ShieldAlert } from "lucide-react";
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

export function OverallScoreHero({
  summary,
  domain,
  finalUrl,
  metaTitle,
  cms,
  onOptimizeCategory: _onOptimizeCategory,
  optimizingCategory: _optimizingCategory,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </div>
    </div>
  );
}
