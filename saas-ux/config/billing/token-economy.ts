export const TOKENS_PER_FIX_UNIT = Number(process.env.TOKENS_PER_FIX_UNIT ?? 2000);

export const FIX_UNITS = {
  minor: Number(process.env.FIX_UNITS_MINOR ?? 1),
  medium: Number(process.env.FIX_UNITS_MEDIUM ?? 2),
  major: Number(process.env.FIX_UNITS_MAJOR ?? 3),
} as const;

export type FixSize = keyof typeof FIX_UNITS;

export function getTokensToBurnForFix(fixUnits: number): number {
  return Math.max(0, Math.round(fixUnits * TOKENS_PER_FIX_UNIT));
}

export function getTokensToBurnForFixSize(fixSize: FixSize): number {
  return getTokensToBurnForFix(FIX_UNITS[fixSize]);
}
