// lib/fix/execute.ts
//
// Applies an approved FixProposal to a connected WordPress site.
//
// Called only from /api/fix/accept, only after the user has seen the exact
// snippets and settings involved. Never called from a GET, and never called
// before tokens are held.

import 'server-only';

import { createWordPressClient, WordPressAPIError } from '@/lib/wordpress/client';
import type { WordPressSeoFix } from '@/lib/wordpress/client';
import type { WordPressConnectorActionRequest } from '@/lib/wordpress/types';
import type { FixOperation, FixOperationResult, FixProposal } from '@/lib/fix/types';
import { logger } from '@/lib/logger';

const log = logger('fix/execute');

function friendly(err: unknown): string {
  if (err instanceof WordPressAPIError) {
    const payload = err.toJSON();
    return `${payload.title}: ${payload.action}`;
  }
  return err instanceof Error ? err.message : 'Unknown error while contacting your site.';
}

export type ExecuteParams = {
  proposal: FixProposal;
  siteUrl: string;
  tokenHash: string;
};

export async function executeFixProposal({
  proposal,
  siteUrl,
  tokenHash,
}: ExecuteParams): Promise<FixOperationResult[]> {
  const client = createWordPressClient({ siteUrl, tokenHash, timeout: 15_000 });
  const results: FixOperationResult[] = [];

  const snippets = proposal.operations.filter(
    (o): o is Extract<FixOperation, { kind: 'head_snippet' }> => o.kind === 'head_snippet'
  );
  const settings = proposal.operations.filter(
    (o): o is Extract<FixOperation, { kind: 'connector_setting' }> =>
      o.kind === 'connector_setting'
  );

  // ── 1. Head snippets via /push ────────────────────────────────────────────
  if (snippets.length > 0) {
    const fixes: WordPressSeoFix[] = snippets.map((op) => ({
      id: op.issueId,
      title: op.title,
      section: 'head',
      severity: 'medium',
      // The connector only applies snippets whose fixType is 'code' or
      // 'config'; anything else is logged and skipped.
      fixType: 'code',
      snippet: op.snippet,
      summary: op.effect,
    }));

    try {
      const response = await client.pushFixes(fixes);
      const applied = new Set(response.appliedIds ?? []);

      for (const op of snippets) {
        results.push({
          issueId: op.issueId,
          title: op.title,
          status: applied.has(op.issueId) ? 'applied' : 'failed',
          message: applied.has(op.issueId)
            ? op.effect
            : 'Your site\'s connector rejected this snippet. It was not applied and you were not charged for it.',
        });
      }
    } catch (err) {
      log.error('push failed', err, { siteUrl, count: snippets.length });
      const message = friendly(err);
      for (const op of snippets) {
        results.push({ issueId: op.issueId, title: op.title, status: 'failed', message });
      }
    }
  }

  // ── 2. Connector settings via /actions ────────────────────────────────────
  if (settings.length > 0) {
    const requests: WordPressConnectorActionRequest[] = settings.map((op) => ({
      id: op.issueId,
      type: 'update_connector_setting',
      payload: { key: op.key, enabled: op.enabled },
    }));

    try {
      const response = await client.applyActions(requests);
      for (const op of settings) {
        const result = response.results?.find((r) => r.id === op.issueId);
        const ok = response.success && result?.status === 'applied';
        results.push({
          issueId: op.issueId,
          title: op.title,
          status: ok ? 'applied' : 'failed',
          message: ok ? op.effect : result?.message ?? 'The connector did not apply this setting.',
        });
      }
    } catch (err) {
      log.error('action gateway failed', err, { siteUrl, count: settings.length });
      const message = friendly(err);
      for (const op of settings) {
        results.push({ issueId: op.issueId, title: op.title, status: 'failed', message });
      }
    }
  }

  return results;
}
