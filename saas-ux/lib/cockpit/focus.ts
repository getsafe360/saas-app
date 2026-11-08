// lib/cockpit/focus.ts
//
// The cockpit shows one category at a time. It opens on the category that
// needs attention most, unless the user picked one before.

export const FOCUS_CATEGORIES = ['performance', 'security', 'seo', 'accessibility', 'content', 'wordpress'] as const;
export type FocusCategory = (typeof FOCUS_CATEGORIES)[number];
export type FocusSelection = FocusCategory | 'all';

export interface FocusCandidate {
  id: FocusCategory;
  score: number | null;
  critical: number;
  warnings: number;
}

/**
 * Most critical issues first, then the lowest score, then the most warnings;
 * ties keep the page order. Unscored categories go last.
 */
export function pickDefaultFocus(candidates: ReadonlyArray<FocusCandidate>): FocusCategory | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort(
    (a, b) =>
      b.critical - a.critical ||
      (a.score ?? 101) - (b.score ?? 101) ||
      b.warnings - a.warnings,
  );
  return ranked[0].id;
}

/** A stored choice is used only while that category is still on the page. */
export function resolveFocus(
  stored: string | null | undefined,
  available: ReadonlyArray<FocusCategory>,
  fallback: FocusCategory | null,
): FocusSelection {
  if (stored === 'all') return 'all';
  if (stored && (available as ReadonlyArray<string>).includes(stored)) return stored as FocusCategory;
  return fallback ?? 'all';
}

export const focusStorageKey = (siteId: string | undefined) => `cockpit-focus:${siteId ?? 'anonymous'}`;
