// components/site-cockpit/cards/wordpress/hooks/useFindingText.ts
"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { WordPressHealthFinding } from "@/types/site-cockpit";

/**
 * Finding text in the user's language. Engine findings carry message keys into
 * messages/Findings; anything without a key (or a key this build does not
 * know yet) falls back to the English text the engine rendered.
 */
export function useFindingText() {
  const t = useTranslations("Findings");

  const render = useCallback(
    (key: string | undefined, fallback: string, values?: Record<string, string | number>) => {
      if (!key || !t.has(key)) return fallback;
      try {
        return t(key, values);
      } catch {
        return fallback;
      }
    },
    [t],
  );

  return {
    title: (finding: WordPressHealthFinding) => render(finding.messages?.title, finding.title),
    summary: (finding: WordPressHealthFinding) =>
      render(finding.messages?.summary, finding.description, finding.messages?.values),
    action: (finding: WordPressHealthFinding) => render(finding.messages?.recommendation, finding.action),
  };
}
