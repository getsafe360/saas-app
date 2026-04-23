// components/site-cockpit/SiteCockpit.tsx
"use client";

import {
  useState,
  useCallback,
  useTransition,
  type ComponentType,
} from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { WordPressCard } from "./cards/wordpress/WordPressCard";
import { OptimizationCard } from "./cards/optimization";
import { PerformanceCard } from "./cards/PerformanceCard";
import { SecurityCard } from "./cards/SecurityCard";
import { SEOCard } from "./cards/SEOCard";
import { AccessibilityCard } from "./cards/AccessibilityCard";
import { ContentCard } from "./cards/ContentCard";
import { SiteSummaryCard } from "./cards/SiteSummaryCard";
import { OverallScoreHero } from "./OverallScoreHero";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type { ConnectionStatus } from "./cards/wordpress/types";
import type {
  CockpitLayoutData,
  CockpitCardLayout,
} from "@/lib/db/schema/features/cockpit-layouts";

type OptimizeCategory =
  | "performance"
  | "security"
  | "seo"
  | "accessibility"
  | "content"
  | "wordpress";

interface SiteCockpitProps {
  data: SiteCockpitResponse;
  siteId?: string;
  editable?: boolean;
  initialLayout?: CockpitLayoutData;
  siteSummary?: string;
  wordpressConnectionStatus?: ConnectionStatus;
  wordpressLastConnected?: string;
  wordpressOnly?: boolean;
}

interface CardConfig {
  id: string;
  component: ComponentType<any>;
  visible: boolean;
  minimized: boolean;
  order: number;
}

const CARD_COMPONENTS: Record<string, ComponentType<any>> = {
  performance: PerformanceCard,
  security: SecurityCard,
  seo: SEOCard,
  accessibility: AccessibilityCard,
  content: ContentCard,
  wordpress: WordPressCard,
  optimization: OptimizationCard,
};

const DEFAULT_CARDS: CockpitCardLayout[] = [
  { id: "performance", visible: true, minimized: false, order: 1 },
  { id: "security", visible: true, minimized: false, order: 2 },
  { id: "seo", visible: true, minimized: false, order: 3 },
  { id: "accessibility", visible: true, minimized: false, order: 4 },
  { id: "content", visible: true, minimized: false, order: 5 },
  { id: "wordpress", visible: true, minimized: false, order: 6 },
  { id: "optimization", visible: true, minimized: false, order: 7 },
];

const DEFAULT_LAYOUT: CockpitLayoutData = {
  version: 1,
  cards: DEFAULT_CARDS,
};

function layoutToCards(layout: CockpitLayoutData): CardConfig[] {
  return layout.cards
    .sort((a, b) => a.order - b.order)
    .map((card) => ({
      id: card.id,
      component: CARD_COMPONENTS[card.id],
      visible: card.visible,
      minimized: card.minimized,
      order: card.order,
    }))
    .filter((card) => card.component);
}

function cardsToLayout(cards: CardConfig[]): CockpitLayoutData {
  return {
    version: 1,
    cards: cards.map((card, index) => ({
      id: card.id,
      visible: card.visible,
      minimized: card.minimized,
      order: index,
    })),
  };
}

export function SiteCockpit({
  data,
  siteId,
  editable = true,
  initialLayout,
  siteSummary,
  wordpressConnectionStatus = "disconnected",
  wordpressLastConnected,
}: SiteCockpitProps) {
  const t = useTranslations("SiteCockpit");
  const [cards, setCards] = useState<CardConfig[]>(() =>
    layoutToCards(initialLayout || DEFAULT_LAYOUT),
  );
  const [optimizingCategory, setOptimizingCategory] =
    useState<OptimizeCategory | null>(null);

  const [, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const saveLayout = useCallback(
    async (newCards: CardConfig[]) => {
      if (!editable) return;

      setSaveStatus("saving");

      try {
        const response = await fetch("/api/cockpit-layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: siteId || null,
            layout: cardsToLayout(newCards),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save layout");
        }

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Error saving layout:", error);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [siteId, editable],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCards((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        startTransition(() => {
          saveLayout(newOrder);
        });

        return newOrder;
      });
    }
  };

  const resetLayout = useCallback(async () => {
    const defaultCards = layoutToCards(DEFAULT_LAYOUT);
    setCards(defaultCards);

    try {
      await fetch(`/api/cockpit-layout${siteId ? `?siteId=${siteId}` : ""}`, {
        method: "DELETE",
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Error resetting layout:", error);
      setSaveStatus("error");
    }
  }, [siteId]);

  const handleOptimizeCategory = useCallback(
    async (category: OptimizeCategory) => {
      setOptimizingCategory(category);

      if (siteId) {
        try {
          await fetch(`/api/sites/${siteId}/ai-optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category }),
          });
        } catch (err) {
          console.error("[SiteCockpit] Failed to create optimization job", err);
        }
      }
    },
    [siteId],
  );

  const isWordPress = data.cms.type === "wordpress";
  const isWordPressOptimizing = optimizingCategory === "wordpress";

  const visibleCards = cards.filter((card) => {
    if (!card.visible) return false;

    // WordPress card: show whenever the site is WordPress
    if (card.id === "wordpress") {
      return isWordPress;
    }

    // Optimization card: only when any category optimization is active
    if (card.id === "optimization") {
      return !!optimizingCategory;
    }

    return true;
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background-default)" }}
    >
      <OverallScoreHero
        summary={data.summary}
        domain={data.domain}
        finalUrl={data.finalUrl}
        metaTitle={data.meta?.title}
        wordpressScore={data.wordpress?.score}
        cms={data.cms}
        onOptimizeCategory={handleOptimizeCategory}
        optimizingCategory={optimizingCategory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* AI Site Summary — shown between hero and card grid when available */}
        {siteSummary && (
          <div className="mb-6">
            <SiteSummaryCard summary={siteSummary} />
          </div>
        )}

        {editable && (
          <div className="mb-6">
            <div
              className="flex items-center justify-end gap-3 text-sm"
              style={{ color: "var(--text-subtle)" }}
            >
              {saveStatus === "saving" && <span>{t("common.loading")}</span>}
              {saveStatus === "saved" && <span>✓ {t("common.save")}</span>}
              {saveStatus === "error" && <span>✗ {t("common.error")}</span>}
              <button onClick={resetLayout} className="hover:underline">
                {t("common.refresh")}
              </button>
            </div>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleCards.map((c) => c.id)}
          strategy={rectSortingStrategy}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            {/* WordPress AI banner — only when WordPress optimization is active */}
            {isWordPressOptimizing && (
              <div
                className="mb-6 rounded-2xl border p-5 backdrop-blur-sm"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--header-bg)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-[0.18em]"
                  style={{ color: "var(--text-subtle)" }}
                >
                  WordPress AI
                </div>
                <h2
                  className="mt-2 text-2xl font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Ultimate AI WP Optimizer
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--text-subtle)" }}>
                  Focused WordPress diagnostics and remediation workflow built
                  for reliable checks today and plugin packaging next.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {visibleCards.map((card) => {
                if (card.id === "performance") {
                  return (
                    <PerformanceCard
                      key={card.id}
                      data={data.performance}
                      stats={data.summary.categoryInsights?.performance}
                      onOptimize={() => handleOptimizeCategory("performance")}
                      optimizing={optimizingCategory === "performance"}
                    />
                  );
                }
                if (card.id === "security") {
                  return (
                    <SecurityCard
                      key={card.id}
                      data={data.security}
                      stats={data.summary.categoryInsights?.security}
                      onOptimize={() => handleOptimizeCategory("security")}
                      optimizing={optimizingCategory === "security"}
                    />
                  );
                }
                if (card.id === "seo") {
                  return (
                    <SEOCard
                      key={card.id}
                      data={data.seo}
                      stats={data.summary.categoryInsights?.seo}
                      onOptimize={() => handleOptimizeCategory("seo")}
                      optimizing={optimizingCategory === "seo"}
                    />
                  );
                }
                if (card.id === "accessibility") {
                  return (
                    <AccessibilityCard
                      key={card.id}
                      data={data.accessibility}
                      stats={data.summary.categoryInsights?.accessibility}
                      onOptimize={() => handleOptimizeCategory("accessibility")}
                      optimizing={optimizingCategory === "accessibility"}
                    />
                  );
                }

                if (card.id === "content") {
                  return (
                    <ContentCard
                      key={card.id}
                      data={data.content}
                      stats={data.summary.categoryInsights?.content}
                      onOptimize={() => handleOptimizeCategory("content")}
                      optimizing={optimizingCategory === "content"}
                    />
                  );
                }

                if (card.id === "wordpress") {
                  return (
                    <WordPressCard
                      key={card.id}
                      id={card.id}
                      data={data}
                      siteId={siteId}
                      minimized={card.minimized}
                      editable={editable}
                      connectionStatus={wordpressConnectionStatus}
                      lastConnected={wordpressLastConnected}
                    />
                  );
                }

                if (card.id === "optimization") {
                  return (
                    <OptimizationCard
                      key={card.id}
                      id={card.id}
                      data={data}
                      siteId={siteId}
                      minimized={card.minimized}
                      editable={editable}
                      siteName={data.domain}
                      connection={{
                        method: data.wordpress ? "wordpress" : "none",
                        status: data.wordpress ? "connected" : "disconnected",
                        wordpress: data.wordpress
                          ? {
                              siteId: siteId || "",
                              pluginVersion: "1.0.0",
                            }
                          : undefined,
                      }}
                    />
                  );
                }

                return null;
              })}
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
