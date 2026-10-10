// Pricing-page button styles, built from the design-system tokens
// (styles/components.css: --btn-primary-*, --btn-secondary-*, --btn-radius).
//
//   PRIMARY   — plan CTAs (Pro, Agency): filled brand colour
//   OUTLINE   — token packs: brand-coloured outline, lighter visual weight
//   SECONDARY — free tier: neutral
const BASE =
  "mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-[var(--btn-radius)] px-4 py-2.5 text-base font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

export const PRIMARY_BUTTON = `${BASE} bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)]`;

export const OUTLINE_BUTTON = `${BASE} border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--color-primary-100)] dark:hover:bg-[var(--color-primary-200)]`;

export const SECONDARY_BUTTON = `${BASE} border border-[var(--border-default)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:border-[var(--border-primary)] hover:bg-[var(--btn-secondary-hover)]`;
