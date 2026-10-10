// Pricing-page button styles, built from the design-system tokens
// (styles/components.css: --btn-radius, --border-primary, --text-primary).
//
//   ACCENT_BUTTON — plan CTAs: outlined in the card's accent colour, matching
//                   the icon at the top of each card
//   OUTLINE_BUTTON — token packs: brand-coloured outline
//
// Tailwind needs complete class names, so each accent is spelled out in full.
const BASE =
  "mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-[var(--btn-radius)] border px-4 py-2.5 text-base font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

export const ACCENT_BUTTON = {
  free: `${BASE} border-emerald-500/60 text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500/10 focus-visible:ring-emerald-500 dark:border-emerald-400/50 dark:text-emerald-400 dark:hover:border-emerald-400`,
  pro: `${BASE} border-violet-500/60 text-violet-600 hover:border-violet-500 hover:bg-violet-500/10 focus-visible:ring-violet-500 dark:border-violet-400/50 dark:text-violet-400 dark:hover:border-violet-400`,
  agency: `${BASE} border-sky-500/60 text-sky-600 hover:border-sky-500 hover:bg-sky-500/10 focus-visible:ring-sky-500 dark:border-sky-400/50 dark:text-sky-400 dark:hover:border-sky-400`,
} as const;

export const OUTLINE_BUTTON = `${BASE} border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--color-primary-100)] focus-visible:ring-[var(--border-primary)] dark:hover:bg-[var(--color-primary-200)]`;
