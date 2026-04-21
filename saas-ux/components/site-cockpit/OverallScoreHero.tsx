"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle,
  Globe,
  ShieldAlert,
  Zap,
  Shield,
  Search,
  Accessibility,
  FileText,
  PenLine,
  Languages,
  Code2,
  Bot,
  Lock,
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

// ─── Mini arc for one category score ────────────────────────────────────────

const ARC_R = 22;
const ARC_CIRC = 2 * Math.PI * ARC_R; // ≈ 138.2

interface CategoryArcProps {
  label: string;
  score: number;
  color: string;
  icon: ComponentType<{ className?: string }>;
}

function CategoryArc({ label, score, color, icon: Icon }: CategoryArcProps) {
  const dash = (score / 100) * ARC_CIRC;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-14 w-14">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={ARC_R}
            stroke="var(--border-default)"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx="28"
            cy="28"
            r={ARC_R}
            stroke={color}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${ARC_CIRC}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ color }}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="text-[9px] font-bold leading-none mt-0.5" style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <span
        className="text-[10px] font-medium tracking-wide text-center leading-tight"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Future-tool chip ────────────────────────────────────────────────────────

interface ToolChipProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  available?: boolean;
}

function ToolChip({ icon: Icon, label, available = false }: ToolChipProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors select-none"
      style={{
        borderColor: available
          ? "var(--color-primary-500)"
          : "var(--border-default)",
        background: available
          ? "oklch(from var(--color-primary-500) l c h / 0.08)"
          : "var(--background-default)",
        color: available ? "var(--color-primary-500)" : "var(--text-subtle)",
        opacity: available ? 1 : 0.6,
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
      {!available && (
        <span
          className="ml-auto flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
          style={{
            background: "var(--border-default)",
            color: "var(--text-subtle)",
          }}
        >
          <Lock className="h-2 w-2" />
          Soon
        </span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

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

  const scores = summary.categoryScores;

  const categoryArcs: CategoryArcProps[] = [
    {
      label: "Performance",
      score: scores.performance,
      color: "var(--category-performance)",
      icon: Zap,
    },
    {
      label: "Security",
      score: scores.security,
      color: "var(--category-security)",
      icon: Shield,
    },
    {
      label: "SEO",
      score: scores.seo,
      color: "var(--category-seo)",
      icon: Search,
    },
    {
      label: "Accessibility",
      score: scores.accessibility,
      color: "var(--category-accessibility)",
      icon: Accessibility,
    },
    {
      label: "Content",
      score: scores.content,
      color: "var(--category-content)",
      icon: FileText,
    },
  ];

  return (
    <div
      className="border-b"
      style={{
        background: "var(--background-default)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Row 1: Site info + Overall arc ── */}
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

          {/* Overall score arc */}
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

        {/* ── Row 2: Category score arcs ── */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "var(--header-bg)",
            borderColor: "var(--border-default)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4"
            style={{ color: "var(--text-subtle)" }}
          >
            Category Scores
          </div>
          <div className="flex items-start justify-around gap-4 flex-wrap">
            {categoryArcs.map((arc) => (
              <CategoryArc key={arc.label} {...arc} />
            ))}
          </div>
        </div>

        {/* ── Row 3: AI tool strip ── */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "var(--header-bg)",
            borderColor: "var(--border-default)",
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3"
            style={{ color: "var(--text-subtle)" }}
          >
            AI Optimization Toolkit
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <ToolChip icon={FileText} label="Content Analysis" available />
            <ToolChip icon={PenLine} label="AI Rewriter" />
            <ToolChip icon={Languages} label="Multi-language" />
            <ToolChip icon={Code2} label="Schema Builder" />
            <ToolChip icon={Bot} label="AI Chatbot" />
          </div>
        </div>
      </div>
    </div>
  );
}
