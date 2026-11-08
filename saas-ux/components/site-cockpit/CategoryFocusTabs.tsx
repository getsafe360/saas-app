// components/site-cockpit/CategoryFocusTabs.tsx
"use client";

import { useEffect, useRef } from "react";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FocusCategory, FocusSelection } from "@/lib/cockpit/focus";

export interface FocusTab {
  id: FocusCategory;
  score: number | null;
  critical: number;
  warnings: number;
}

interface CategoryFocusTabsProps {
  tabs: FocusTab[];
  selected: FocusSelection;
  /** Category to return to when leaving "Show all". */
  defaultFocus: FocusCategory | null;
  onSelect: (selection: FocusSelection) => void;
}

const COLOR: Record<FocusCategory, string> = {
  performance: "var(--category-performance)",
  security: "var(--category-security)",
  seo: "var(--category-seo)",
  accessibility: "var(--category-accessibility)",
  content: "var(--category-content)",
  wordpress: "var(--category-wordpress)",
};

/**
 * One row per category with its score and open issues. Picking one shows only
 * that category's card below, so the page stays short and focused.
 */
export function CategoryFocusTabs({ tabs, selected, defaultFocus, onSelect }: CategoryFocusTabsProps) {
  const t = useTranslations("SiteCockpit");
  const listRef = useRef<HTMLDivElement>(null);

  // On narrow screens the row scrolls sideways: keep the selected tab visible
  // by scrolling the row itself, never the page.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    const left = active.offsetLeft - list.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [selected]);

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--text-subtle)" }}>
          {t("focus.heading")}
        </h2>
        <button
          type="button"
          onClick={() => onSelect(selected === "all" ? (defaultFocus ?? tabs[0]?.id ?? "all") : "all")}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/5"
          style={{ color: "var(--text-subtle)" }}
          aria-pressed={selected === "all"}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {selected === "all" ? t("focus.showOne") : t("focus.showAll")}
        </button>
      </div>

      <div ref={listRef} role="tablist" aria-label={t("focus.heading")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {tabs.map((tab) => {
          const active = selected === tab.id;
          const color = COLOR[tab.id];
          const issues = tab.critical + tab.warnings;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`card-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className="min-w-[9.5rem] shrink-0 cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors sm:min-w-0"
              style={{
                borderColor: active ? color : "var(--border-default)",
                background: active ? `oklch(from ${color} l c h / 0.1)` : "var(--header-bg)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold" style={{ color: active ? color : "var(--text-default)" }}>
                  {t(`focus.labels.${tab.id}`)}
                </span>
                <span className="text-sm font-semibold tabular-nums" style={{ color }}>
                  {tab.score ?? "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-subtle)" }}>
                {issues === 0 ? (
                  <span>{t("focus.allClear")}</span>
                ) : (
                  <>
                    {tab.critical > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {t("focus.critical", { count: tab.critical })}
                      </span>
                    )}
                    {tab.warnings > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {t("focus.warnings", { count: tab.warnings })}
                      </span>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
