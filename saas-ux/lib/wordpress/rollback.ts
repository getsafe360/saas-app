// lib/wordpress/rollback.ts
//
// Undo for connector actions. Every applied action stores the exact inverse
// request the connector returned (`rollbackPayload`); undo replays those,
// newest first, so stacked changes unwind back to the original state.

import type { WordPressConnectorActionRequest } from '@/lib/wordpress/types';

export interface RollbackCandidate {
  id: string;
  actionId: string;
  status: string;
  rollbackPayload: unknown;
  startedAt: Date | string;
}

export interface PlannedRollback {
  runId: string;
  request: WordPressConnectorActionRequest;
}

const SETTING_KEYS = new Set(['disableXmlRpc', 'blockUserEnumeration']);

/** Accept only the two inverse shapes the connector produces. */
export function parseRollbackRequest(raw: unknown): WordPressConnectorActionRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { id?: unknown; type?: unknown; payload?: unknown };
  if (typeof value.id !== 'string' || !value.payload || typeof value.payload !== 'object') return null;
  const payload = value.payload as Record<string, unknown>;

  if (value.type === 'update_connector_setting') {
    if (typeof payload.key !== 'string' || !SETTING_KEYS.has(payload.key)) return null;
    return {
      id: value.id,
      type: 'update_connector_setting',
      payload: { key: payload.key as 'disableXmlRpc' | 'blockUserEnumeration', enabled: Boolean(payload.enabled) },
    };
  }

  if (value.type === 'set_security_headers') {
    const headers = payload.headers;
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return null;
    const clean: Record<string, string | null> = {};
    for (const [name, header] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof header !== 'string' && header !== null) return null;
      clean[name] = header;
    }
    return { id: value.id, type: 'set_security_headers', payload: { headers: clean, replace: payload.replace === true } };
  }

  return null;
}

/**
 * A run can be undone when the connector returned a valid inverse. That only
 * happens when it applied the change, so this includes runs recorded as
 * `failed` because live verification failed afterwards (e.g. a CDN still
 * serving cached headers): WordPress was modified and must stay undoable.
 */
function isUndoable(run: RollbackCandidate): boolean {
  return (run.status === 'applied' || run.status === 'failed') && parseRollbackRequest(run.rollbackPayload) !== null;
}

const newestFirst = (a: RollbackCandidate, b: RollbackCandidate) =>
  new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();

export interface RollbackBlock {
  runId: string;
  /** Newer, still-applied runs of the same fixer that must be undone first. */
  newerRunIds: string[];
}

/**
 * Plan an undo of `selected`. Inverses are full snapshots of the fixer's state
 * before that run, so replaying one while a newer run of the same fixer is
 * still applied would also wipe the newer change. `siteRuns` (every run of
 * those fixers on the site) lets us refuse that instead of corrupting state.
 */
export function planRollback(
  selected: ReadonlyArray<RollbackCandidate>,
  siteRuns: ReadonlyArray<RollbackCandidate> = selected,
): {
  planned: PlannedRollback[];
  notReversible: string[];
  blocked: RollbackBlock[];
} {
  const selectedIds = new Set(selected.map((run) => run.id));
  const candidates = selected.filter((run) => run.status === 'applied' || run.status === 'failed');
  const notReversible = candidates.filter((run) => !isUndoable(run)).map((run) => run.id);
  const undoable = candidates.filter(isUndoable).sort(newestFirst);

  const blocked: RollbackBlock[] = [];
  for (const run of undoable) {
    const startedAt = new Date(run.startedAt).getTime();
    const newerRunIds = siteRuns
      .filter(
        (other) =>
          other.actionId === run.actionId &&
          !selectedIds.has(other.id) &&
          isUndoable(other) &&
          new Date(other.startedAt).getTime() > startedAt,
      )
      .map((other) => other.id);
    if (newerRunIds.length > 0) blocked.push({ runId: run.id, newerRunIds });
  }

  return {
    planned: blocked.length > 0
      ? []
      : undoable.map((run) => ({ runId: run.id, request: parseRollbackRequest(run.rollbackPayload)! })),
    notReversible,
    blocked,
  };
}
