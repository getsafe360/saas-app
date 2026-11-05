import { getFixer } from '@/lib/engine/fixers/registry';
import type {
  WordPressDetailedVerificationResult,
  WordPressPlannedAction,
} from '@/lib/wordpress/types';

/** Verify an applied action with the fixer that planned it. */
export async function verifyWordPressAction(params: {
  siteUrl: string;
  tokenHash: string;
  action: WordPressPlannedAction;
}): Promise<WordPressDetailedVerificationResult> {
  const fixer = getFixer(params.action.id);
  if (fixer) {
    return fixer.verify(params);
  }

  return {
    success: false,
    checkedAt: new Date().toISOString(),
    message: 'No verification strategy is implemented for this action yet.',
    checks: [
      {
        name: 'verification-strategy',
        ok: false,
        detail: `No fixer registered for action: ${params.action.id}`,
      },
    ],
  };
}
