// lib/optimization/loops/goals.ts
// Goal scores and default mode per category

import type { OptimizationMode } from '@/lib/db/schema';

export interface CategoryGoal {
  goalScore: number;
  maxIterations: number;
  defaultMode: OptimizationMode;
  label: string;
}

export const CATEGORY_GOALS: Record<string, CategoryGoal> = {
  seo: {
    goalScore: 95,
    maxIterations: 5,
    defaultMode: 'safe_auto',
    label: 'Optimize SEO',
  },
  performance: {
    goalScore: 90,
    maxIterations: 5,
    defaultMode: 'approval_required',
    label: 'Optimize Performance',
  },
  security: {
    goalScore: 90,
    maxIterations: 5,
    defaultMode: 'approval_required',
    label: 'Optimize Security',
  },
  accessibility: {
    goalScore: 95,
    maxIterations: 5,
    defaultMode: 'approval_required',
    label: 'Optimize Accessibility',
  },
  content: {
    goalScore: 90,
    maxIterations: 5,
    defaultMode: 'approval_required',
    label: 'Optimize Content',
  },
  wordpress: {
    goalScore: 90,
    maxIterations: 5,
    defaultMode: 'report_only',
    label: 'Optimize WordPress',
  },
};

export function getCategoryGoal(category: string): CategoryGoal {
  return CATEGORY_GOALS[category] ?? {
    goalScore: 90,
    maxIterations: 5,
    defaultMode: 'approval_required',
    label: `Optimize ${category}`,
  };
}
