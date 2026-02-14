// components/site-cockpit/SiteCockpit.tsx
"use client";

import { useState, useCallback, useTransition } from "react";
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
import { OverallScoreHero } from "./OverallScoreHero";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type {
  CockpitLayoutData,
  CockpitCardLayout,
} from "@/lib/db/schema/features/cockpit-layouts";

interface SiteCockpitProps {
  data: SiteCockpitResponse;
  siteId?: string;
  editable?: boolean;
  initialLayout?: CockpitLayoutData;
}

interface CardConfig {
  id: string;
  component: React.ComponentType<any>;
  visible: boolean;
  minimized: boolean;
  order: number;
}

const CARD_COMPONENTS: Record<string, React.ComponentType<any>> = {
  wordpress: WordPressCard,
  optimization: OptimizationCard,
};

const DEFAULT_CARDS: CockpitCardLayout[] = [
  { id: "wordpress", visible: true, minimized: false, order: 0 },
  { id: "optimization", visible: true, minimized: false, order: 1 },
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
}: SiteCockpitProps) {
  const t = useTranslations("SiteCockpit");
  const [cards, setCards] = useState<CardConfig[]>(() =>
    layoutToCards(initialLayout || DEFAULT_LAYOUT)
  );
  const [optimizingCategory, setOptimizingCategory] = useState<string | null>(null);

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
    [siteId, editable]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
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

  const handleOptimizeCategory = useCallback(async (category: "performance" | "security" | "seo" | "accessibility") => {
    if (!siteId) return;
    setOptimizingCategory(category);
    try {
      const response = await fetch(`/api/reports/${siteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", scope: category }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed report generation");
      }
      if (payload.report?.downloadUrl) {
        const link = document.createElement("a");
        link.href = payload.report.downloadUrl;
        link.download = payload.report.filename || `${category}-report.pdf`;
        link.click();
      }
    } catch (error) {
      console.error(`Failed to optimize ${category}:`, error);
    } finally {
      setOptimizingCategory(null);
    }
  }, [siteId]);

  const visibleCards = cards.filter((card) => {
    if (card.id === "wordpress" && data.cms.type !== "wordpress") {
      return false;
    }
    return card.visible;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--background-default)" }}>
      <OverallScoreHero
        summary={data.summary}
        domain={data.domain}
        finalUrl={data.finalUrl}
        cms={data.cms}
        onOptimizeCategory={handleOptimizeCategory}
        optimizingCategory={optimizingCategory}
      />

      {editable && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-end gap-3 text-sm" style={{ color: "var(--text-subtle)" }}>
            {saveStatus === "saving" && <span>{t("common.loading")}</span>}
            {saveStatus === "saved" && <span>✓ {t("common.save")}</span>}
            {saveStatus === "error" && <span>✗ {t("common.error")}</span>}
            <button onClick={resetLayout} className="hover:underline">{t("common.refresh")}</button>
          </div>
        </div>
      )}

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {visibleCards.map((card) => {
                const CardComponent = card.component;
                return (
                  <CardComponent
                    key={card.id}
                    id={card.id}
                    data={data}
                    siteId={siteId}
                    minimized={card.minimized}
                    editable={editable}
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
              })}
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
