// lib/optimization/fixes/rollbackFix.ts
// Rollback an applied fix
// NOTE: Rollback requires DELETE /wp-json/getsafe360/v1/fixes/:id on the WP connector.
// That endpoint does not exist yet (v1.2.0). Until it lands, rollback is recorded
// in the DB but cannot be executed remotely. The UI exposes a manual instruction
// to the user when connector rollback is unavailable.

import { createWordPressClient } from '@/lib/wordpress/client';
import type { FixPlan } from '../loops/types';

export interface RollbackFixInput {
  siteUrl: string;
  siteToken: string;
  fixPlan: FixPlan;
}

export interface RollbackFixResult {
  success: boolean;
  method: 'connector' | 'manual' | 'noop';
  message: string;
}

export async function rollbackFix(input: RollbackFixInput): Promise<RollbackFixResult> {
  const { siteUrl, siteToken, fixPlan } = input;
  const rollback = fixPlan.rollbackPayload;

  if (!rollback) {
    return {
      success: false,
      method: 'noop',
      message: 'No rollback payload recorded for this fix.',
    };
  }

  if (rollback.action === 'delete_fix') {
    // Attempt connector rollback — will fail gracefully if endpoint missing
    try {
      const client = createWordPressClient({ siteUrl, tokenHash: siteToken });
      // @ts-expect-error — deleteFix not yet on client; will be added with WP plugin v1.3.0
      if (typeof client.deleteFix === 'function') {
        await (client as any).deleteFix(rollback.fixId);
        return {
          success: true,
          method: 'connector',
          message: `Fix ${rollback.fixId} removed from WordPress.`,
        };
      }
    } catch {
      // Fall through to manual instruction
    }

    return {
      success: false,
      method: 'manual',
      message: `To undo this fix, go to your WordPress admin and remove the GetSafe360 snippet with ID "${rollback.fixId}" from Appearance → GetSafe360 Snippets, or update the plugin to v1.3.0 which supports automatic rollback.`,
    };
  }

  return {
    success: false,
    method: 'noop',
    message: 'Unsupported rollback action.',
  };
}
