"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function AnalysisWaitingRotator({ className }: { className?: string }) {
  const t = useTranslations("Terminal");
  const messages = t.raw("aiAnalysisProgress") as string[];
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIdx(i => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(swap);
    }, 3200);
    return () => clearInterval(tick);
  }, [messages.length]);

  return (
    <span
      className={cn("transition-opacity duration-300", visible ? "opacity-100" : "opacity-0", className)}
    >
      {messages[idx]}…
    </span>
  );
}
