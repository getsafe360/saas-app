// saas-ux/lib/ab.ts
// Stable 0..1 bucketing based on a seed (domain etc.)
export function bucketVariant(seed: string, ratio = 0.5): boolean {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
  const u = (h >>> 0) / 2 ** 32;
  return u < ratio;
}
