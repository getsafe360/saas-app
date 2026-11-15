// lib/optimization/fixes/applyFix.ts
// Apply a fix plan via the WordPress connector

import { createWordPressClient } from '@/lib/wordpress/client';
import type { FixPlan } from '../loops/types';
import type { WordPressConnectorActionRequest } from '@/lib/wordpress/types';

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

  if (fixPlan.fixType === 'connector_action' && fixPlan.connectorAction) {
    try {
      const client = createWordPressClient({ siteUrl, tokenHash: siteToken });
      const request = { id: fixPlan.connectorFix.id, ...fixPlan.connectorAction } as unknown as WordPressConnectorActionRequest;
      const response = await client.applyActions([request]);
      const result = response.results?.[0];
      if (!result || result.status !== 'applied') {
        return { success: false, connectorResponse: response, error: result?.message ?? 'The connector did not apply the change.' };
      }
      // The connector returns the exact inverse; that is how this fix is undone.
      if (result.rollback) fixPlan.rollbackPayload = { action: 'connector_action', request: result.rollback };
      return { success: true, connectorResponse: response };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Unknown error applying fix.' };
    }
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
