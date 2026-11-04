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

export function planRollback(runs: ReadonlyArray<RollbackCandidate>): {
  planned: PlannedRollback[];
  notReversible: string[];
} {
  const planned: PlannedRollback[] = [];
  const notReversible: string[] = [];

  const applied = runs
    .filter((run) => run.status === 'applied')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  for (const run of applied) {
    const request = parseRollbackRequest(run.rollbackPayload);
    if (request) {
      planned.push({ runId: run.id, request });
    } else {
      notReversible.push(run.id);
    }
  }

  return { planned, notReversible };
}
