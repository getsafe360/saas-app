// components/site-cockpit/cards/CockpitCard.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryType } from "@/types/site-cockpit";
import type { ReactNode } from "react";

interface CockpitCardProps {
  id: string;
  title: string | ReactNode; // ✅ Support both string and custom elements
  category: CategoryType;
  score?: number;
  grade?: string;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
  children: React.ReactNode;
  className?: string;
}

const CATEGORY_STYLES: Record<
  CategoryType,
  {
    gradient: string;
    border: string;
    glow: string;
    text: string;
    bg: string;
  }
> = {
  performance: {
    gradient: "from-green-500/10 via-green-500/5 to-transparent",
    border: "border-green-500/20 hover:border-green-500/40",
    glow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    text: "text-green-400",
    bg: "bg-green-500/5",
  },
  security: {
    gradient: "from-red-500/10 via-red-500/5 to-transparent",
    border: "border-red-500/20 hover:border-red-500/40",
    glow: "hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    text: "text-red-400",
    bg: "bg-red-500/5",
  },
  seo: {
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    border: "border-blue-500/20 hover:border-blue-500/40",
    glow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
    text: "text-blue-400",
    bg: "bg-blue-500/5",
  },
  accessibility: {
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    border: "border-purple-500/20 hover:border-purple-500/40",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
    text: "text-purple-400",
    bg: "bg-purple-500/5",
  },
  tech: {
    gradient: "from-orange-500/10 via-orange-500/5 to-transparent",
    border: "border-orange-500/20 hover:border-orange-500/40",
    glow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
    text: "text-orange-400",
    bg: "bg-orange-500/5",
  },
  wordpress: {
    gradient: "from-blue-600/10 via-blue-600/5 to-transparent",
    border: "border-blue-600/20 hover:border-blue-600/40",
    glow: "hover:shadow-[0_0_30px_rgba(33,117,155,0.15)]",
    text: "text-blue-500",
    bg: "bg-blue-600/5",
  },
};

// Default fallback styles
const DEFAULT_STYLES = {
  gradient: "from-gray-500/10 via-gray-500/5 to-transparent",
  border: "border-gray-500/20 hover:border-gray-500/40",
  glow: "hover:shadow-[0_0_30px_rgba(107,114,128,0.15)]",
  text: "text-gray-400",
  bg: "bg-gray-500/5",
};

export function CockpitCard({
  id,
  title,
  category,
  score,
  grade,
  minimized = false,
  onToggleMinimize,
  editable = true,
  children,
  className,
}: CockpitCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-50",
        className
      )}
    >
      {/* Futuristic card with glass morphism effect */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "backdrop-blur-xl bg-gray-900/40",
          "border transition-all duration-300",
          styles.border,
          styles.glow,
          isDragging && "scale-105"
        )}
      >
        {/* Gradient overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-50",
            styles.gradient
          )}
        />

        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3 flex-1">
              {/* Drag handle */}
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

              {/* Title - ✅ Support both string and ReactNode */}
              {typeof title === "string" ? (
                <h3 className="text-xl font-bold text-white">{title}</h3>
              ) : (
                <h3 className="text-xl font-bold">{title}</h3>
              )}

              {/* Score pill */}
              {score !== undefined && grade && (
                <div
                  className={cn(
                    "ml-auto flex items-center gap-2 px-3 py-1 rounded-full",
                    "backdrop-blur-sm",
                    styles.bg,
                    styles.border.replace("hover:", "")
                  )}
                >
                  <span className={cn("text-2xl font-bold", styles.text)}>
                    {grade}
                  </span>
                  <span className="text-sm text-gray-400">({score}/100)</span>
                </div>
              )}
            </div>

            {/* Minimize button removed - keeping it simple! */}
          </div>

          {/* Score bar */}
          {score !== undefined && !minimized && (
            <div className="px-6 pb-4">
              <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                    "bg-gradient-to-r",
                    score >= 90 && "from-green-400 to-green-500",
                    score >= 70 &&
                      score < 90 &&
                      "from-yellow-400 to-yellow-500",
                    score >= 50 &&
                      score < 70 &&
                      "from-orange-400 to-orange-500",
                    score < 50 && "from-red-400 to-red-500"
                  )}
                  style={{ width: `${score}%` }}
                >
                  {/* Animated glow */}
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {!minimized && <div className="px-6 pb-6">{children}</div>}
        </div>

        {/* Scan line effect (futuristic touch) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent animate-scan" />
        </div>
      </div>
    </div>
  );
}
