"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const RANDOM_COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#fbbf24",
  "#38bdf8", "#fb923c", "#a3e635", "#2dd4bf", "#c084fc",
];

export function AnalysisWaitingRotator({
  className,
  withColor = false,
}: {
  className?: string;
  withColor?: boolean;
}) {
  const t = useTranslations("Terminal");
  const messages = t.raw("aiAnalysisProgress") as string[];
  const [idx, setIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIdx(i => (i + 1) % messages.length);
        if (withColor) setColorIdx(i => (i + 1) % RANDOM_COLORS.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(swap);
    }, 3200);
    return () => clearInterval(tick);
  }, [messages.length, withColor]);

  return (
    <span
      className={cn("transition-opacity duration-300", visible ? "opacity-100" : "opacity-0", className)}
      style={withColor ? { color: RANDOM_COLORS[colorIdx] } : undefined}
    >
      {messages[idx]}…
    </span>
  );
}
