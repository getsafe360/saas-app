// components/site-cockpit/cards/CockpitCard.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Accessibility,
  Bot,
  GripVertical,
  Loader2,
  Search,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryType } from "@/types/site-cockpit";
import type { ComponentType, ReactNode } from "react";
import { useTranslations } from "next-intl";

interface CockpitCardProps {
  id: string;
  title: string | ReactNode;
  category: CategoryType;
  score?: number;
  grade?: string;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
  children: React.ReactNode;
  className?: string;
  stats?: {
    passed: number;
    warnings: number;
    criticalIssues: number;
  };
  onOptimize?: () => void;
  optimizing?: boolean;
}

const CATEGORY_STYLES: Record<
  CategoryType,
  {
    color: string;
    glow: string;
    icon: ComponentType<{ className?: string }>;
    scorePillBg: string;
  }
> = {
  performance: {
    color: "var(--category-performance)",
    glow: "0 0 30px rgba(16,185,129,0.15)",
    icon: Zap,
    scorePillBg: "oklch(from var(--category-performance) l c h / 0.12)",
  },
  security: {
    color: "var(--category-security)",
    glow: "0 0 30px rgba(239,68,68,0.15)",
    icon: Shield,
    scorePillBg: "oklch(from var(--category-security) l c h / 0.12)",
  },
  seo: {
    color: "var(--category-seo)",
    glow: "0 0 30px rgba(59,130,246,0.15)",
    icon: Search,
    scorePillBg: "oklch(from var(--category-seo) l c h / 0.12)",
  },
  accessibility: {
    color: "var(--category-accessibility)",
    glow: "0 0 30px rgba(245,158,11,0.18)",
    icon: Accessibility,
    scorePillBg: "oklch(from var(--category-accessibility) l c h / 0.12)",
  },
  tech: {
    color: "var(--category-tech)",
    glow: "0 0 30px rgba(249,115,22,0.15)",
    icon: Wrench,
    scorePillBg: "oklch(from var(--category-tech) l c h / 0.12)",
  },
  wordpress: {
    color: "var(--category-wordpress)",
    glow: "0 0 30px rgba(33,117,155,0.15)",
    icon: Wrench,
    scorePillBg: "oklch(from var(--category-wordpress) l c h / 0.12)",
  },
  geo: {
    color: "var(--category-geo)",
    glow: "0 0 30px rgba(147,51,234,0.18)",
    icon: Bot,
    scorePillBg:
      "linear-gradient(135deg, oklch(from var(--category-geo) l c h / 0.22), oklch(from var(--category-seo) l c h / 0.16))",
  },
};

const DEFAULT_STYLES = {
  color: "var(--text-subtle)",
  glow: "0 0 30px rgba(107,114,128,0.15)",
  icon: Wrench,
  scorePillBg: "oklch(from var(--color-neutral-400) l c h / 0.12)",
};

export function CockpitCard({
  id,
  title,
  category,
  score,
  grade,
  minimized = false,
  editable = true,
  children,
  className,
  stats,
  onOptimize,
  optimizing,
}: CockpitCardProps) {
  const t = useTranslations("SiteCockpit");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const styles = CATEGORY_STYLES[category] || DEFAULT_STYLES;
  const CategoryIcon = styles.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-50",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gray-900/40 border transition-all duration-300",
          isDragging && "scale-105",
        )}
        style={{
          borderColor: `oklch(from ${styles.color} l c h / 0.35)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `oklch(from ${styles.color} l c h / 0.58)`;
          e.currentTarget.style.boxShadow = styles.glow;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `oklch(from ${styles.color} l c h / 0.35)`;
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div className="relative">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {typeof title === "string" ? (
                <>
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: `oklch(from ${styles.color} l c h / 0.12)`,
                      color: styles.color,
                    }}
                  >
                    <CategoryIcon className="h-4 w-4" />
                  </span>
                  <h3 className="text-xl font-bold text-white truncate">
                    {title}
                  </h3>
                </>
              ) : (
                <h3 className="text-xl font-bold truncate">{title}</h3>
              )}
            </div>

            <div className="ml-4 flex items-center gap-3">
              {score !== undefined && grade && (
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-sm"
                  style={{
                    background: styles.scorePillBg,
                    borderColor: `oklch(from ${styles.color} l c h / 0.45)`,
                  }}
                >
                  <span
                    className="text-2xl font-bold"
                    style={{ color: styles.color }}
                  >
                    {grade}
                  </span>
                  <span className="text-sm text-gray-400">({score}/100)</span>
                </div>
              )}

              {editable && (
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {score !== undefined && !minimized && (
            <div className="px-6 pb-4">
              <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background:
                      category === "geo"
                        ? "linear-gradient(90deg, var(--category-geo), var(--category-seo), var(--category-accessibility))"
                        : styles.color,
                  }}
                />
              </div>
            </div>
          )}

          {!minimized && (
            <>
              {stats && (
                <div
                  className="px-6 pb-4 text-xs"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {t("summary.passed")}: {stats.passed} ·{" "}
                  {t("summary.warnings")}: {stats.warnings} ·{" "}
                  {t("summary.criticalIssues")}: {stats.criticalIssues}
                </div>
              )}
              {onOptimize && (
                <div className="px-6 pb-4">
                  <button
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold border transition"
                    style={{
                      borderColor: `oklch(from ${styles.color} l c h / 0.55)`,
                      background:
                        category === "geo"
                          ? "linear-gradient(135deg, oklch(from var(--category-geo) l c h / 0.16), oklch(from var(--category-seo) l c h / 0.14))"
                          : `oklch(from ${styles.color} l c h / 0.12)`,
                      color: styles.color,
                    }}
                    onClick={onOptimize}
                    disabled={optimizing}
                  >
                    {optimizing ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </span>
                    ) : (
                      t("actions.optimize")
                    )}
                  </button>
                </div>
              )}
              <div className="px-6 pb-6">{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
