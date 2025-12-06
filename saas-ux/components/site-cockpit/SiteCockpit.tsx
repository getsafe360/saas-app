// components/site-cockpit/SiteCockpit.tsx
"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
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
import { QuickWinsCard } from "./cards/QuickWinsCard";
import { PerformanceCard } from "./cards/PerformanceCard";
import { SecurityCard } from "./cards/SecurityCard";
import { SEOCard } from "./cards/SEOCard";
import { AccessibilityCard } from "./cards/AccessibilityCard";
import { WordPressCard } from "./cards/WordPressCard";
import { TechnologyCard } from "./cards/TechnologyCard";
// import { MobileCard } from "./cards/MobileCard";
// import { NetworkCard } from "./cards/NetworkCard";
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
  initialLayout?: CockpitLayoutData; // Server-side loaded layout
}

interface CardConfig {
  id: string;
  component: React.ComponentType<any>;
  visible: boolean;
  minimized: boolean;
  order: number;
}

// Card component registry
const CARD_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "quick-wins": QuickWinsCard,
  performance: PerformanceCard,
  security: SecurityCard,
  seo: SEOCard,
  accessibility: AccessibilityCard,
  wordpress: WordPressCard,
  technology: TechnologyCard,
  //  mobile: MobileCard,
  //  network: NetworkCard,
};

// Default card order
const DEFAULT_CARDS: CockpitCardLayout[] = [
  { id: "quick-wins", visible: true, minimized: false, order: 0 },
  { id: "performance", visible: true, minimized: false, order: 1 },
  { id: "security", visible: true, minimized: false, order: 2 },
  { id: "seo", visible: true, minimized: false, order: 3 },
  { id: "accessibility", visible: true, minimized: false, order: 4 },
  { id: "wordpress", visible: true, minimized: false, order: 5 },
  { id: "technology", visible: true, minimized: false, order: 6 },
  { id: "mobile", visible: true, minimized: false, order: 7 },
  { id: "network", visible: true, minimized: false, order: 8 },
];

const DEFAULT_LAYOUT: CockpitLayoutData = {
  version: 1,
  cards: DEFAULT_CARDS,
};

// Convert layout data to card configs with components
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
    .filter((card) => card.component); // Only include cards with valid components
}

// Convert card configs back to layout data
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
  // Initialize with server-provided layout or default
  const [cards, setCards] = useState<CardConfig[]>(() =>
    layoutToCards(initialLayout || DEFAULT_LAYOUT)
  );

  // Track saving state
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Save layout to database (debounced)
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

        // Reset status after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Error saving layout:", error);
        setSaveStatus("error");

        // Reset status after 3 seconds
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [siteId, editable]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCards((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Save to database in background
        startTransition(() => {
          saveLayout(newOrder);
        });

        return newOrder;
      });
    }
  };

  // Toggle card minimized state
  const toggleMinimize = useCallback(
    (cardId: string) => {
      setCards((items) => {
        const newCards = items.map((card) =>
          card.id === cardId ? { ...card, minimized: !card.minimized } : card
        );

        // Save to database in background
        startTransition(() => {
          saveLayout(newCards);
        });

        return newCards;
      });
    },
    [saveLayout]
  );

  // Toggle card visibility
  const toggleVisibility = useCallback(
    (cardId: string) => {
      setCards((items) => {
        const newCards = items.map((card) =>
          card.id === cardId ? { ...card, visible: !card.visible } : card
        );

        // Save to database in background
        startTransition(() => {
          saveLayout(newCards);
        });

        return newCards;
      });
    },
    [saveLayout]
  );

  // Reset to default order
  const resetLayout = useCallback(async () => {
    const defaultCards = layoutToCards(DEFAULT_LAYOUT);
    setCards(defaultCards);

    // Delete custom layout from database
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

  // Filter WordPress card if not WordPress site
  const visibleCards = cards.filter((card) => {
    if (card.id === "wordpress" && data.cms.type !== "wordpress") {
      return false;
    }
    return card.visible;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Overall Score Hero - Always at top */}
      <OverallScoreHero
        summary={data.summary}
        domain={data.domain}
        faviconUrl={data.faviconUrl}
        cms={data.cms}
      />

      {/* Layout Controls */}
      {editable && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-end gap-3">
            {/* Save status indicator */}
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="text-sm text-blue-400 flex items-center gap-1">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-sm text-green-400">✓ Saved</span>
              )}
              {saveStatus === "error" && (
                <span className="text-sm text-red-400">✗ Save failed</span>
              )}
            </div>

            <button
              onClick={resetLayout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Reset Layout
            </button>
            <div className="text-sm text-gray-500">
              Drag cards to rearrange • Click to minimize
            </div>
          </div>
        </div>
      )}

      {/* Draggable Card Grid */}
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
                    minimized={card.minimized}
                    onToggleMinimize={() => toggleMinimize(card.id)}
                    editable={editable}
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
