// lib/optimization/fixes/applyFix.ts
// Apply a fix plan via the WordPress connector

import { createWordPressClient } from '@/lib/wordpress/client';
import type { FixPlan } from '../loops/types';

export interface ApplyFixInput {
  siteUrl: string;
  siteToken: string;
  fixPlan: FixPlan;
}

export interface ApplyFixResult {
  success: boolean;
  connectorResponse?: unknown;
  error?: string;
}

export async function applyFix(input: ApplyFixInput): Promise<ApplyFixResult> {
  const { siteUrl, siteToken, fixPlan } = input;

  if (fixPlan.fixType === 'manual_instruction') {
    return {
      success: false,
      error: 'Manual fix — no automated application possible.',
    };
  }

  try {
    const client = createWordPressClient({ siteUrl, tokenHash: siteToken });
    const response = await client.pushFixes([fixPlan.connectorFix as any]);

    if (!response.success && response.applied === 0) {
      return {
        success: false,
        connectorResponse: response,
        error: `Connector applied 0 fixes (skipped: ${response.skipped}).`,
      };
    }

    return { success: true, connectorResponse: response };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? 'Unknown error applying fix.',
    };
  }
}
