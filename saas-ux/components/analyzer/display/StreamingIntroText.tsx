// components/analyzer/display/StreamingIntroText.tsx
"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  locale: string;
};

export default function StreamingIntroText({ locale }: Props) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const t = useTranslations("Sparky");

  const text = `${t("greeting")}, ${t("tagline")}`;

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 20); // Typing speed

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl border border-neutral-700">
      <div className="mb-6 flex items-center gap-3">
        <div className="relative">
          <Sparkles className="h-12 w-12 text-sky-400" />
          {!isComplete && (
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-white">{t("drawer.title")}</h2>
      </div>

      <div className="relative max-w-md">
        <p className="text-lg leading-relaxed text-neutral-300">
          {displayedText}
          {!isComplete && (
            <span className="inline-block w-0.5 h-5 bg-sky-400 ml-1 animate-pulse" />
          )}
        </p>
      </div>

      {isComplete && (
        <div className="mt-8 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Analysis in progress...</span>
          </div>
        </div>
      )}
    </div>
  );
}
