// lib/wordpress/rollback.ts
//
// Undo for connector actions. Every applied action stores the exact inverse
// request the connector returned (`rollbackPayload`); undo replays those,
// newest first, so stacked changes unwind back to the original state.

import { AI_CRAWLERS } from '@/lib/engine/seo/robots';
import { CONNECTOR_SETTING_KEYS, type WordPressConnectorActionRequest } from '@/lib/wordpress/types';

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

const SETTING_KEYS: ReadonlySet<string> = new Set(CONNECTOR_SETTING_KEYS);
const PLUGIN_FILE = /^[A-Za-z0-9._/-]+\.php$/;
const AI_AGENTS: ReadonlySet<string> = new Set(AI_CRAWLERS.map((bot) => bot.agent));
const LLMS_TXT_MAX = 65_536;

const optionalText = (value: unknown, max: number): value is string | null =>
  value === null || (typeof value === 'string' && value.length <= max);

/** Accept only the inverse shapes the connector produces. */
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
      payload: {
        key: payload.key as (typeof CONNECTOR_SETTING_KEYS)[number],
        enabled: Boolean(payload.enabled),
      },
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

  if (value.type === 'set_config_permissions') {
    // Restores a previous mode only; never world-writable.
    if (typeof payload.mode !== 'string' || !/^0?[0-7]{3}$/.test(payload.mode)) return null;
    if (parseInt(payload.mode, 8) & 0o002) return null;
    return { id: value.id, type: 'set_config_permissions', payload: { mode: payload.mode } };
  }

  if (value.type === 'set_default_role') {
    if (typeof payload.role !== 'string' || !/^[a-z0-9_-]+$/.test(payload.role)) return null;
    return { id: value.id, type: 'set_default_role', payload: { role: payload.role } };
  }

  if (value.type === 'restore_core_backup') {
    if (typeof payload.restorePoint !== 'string' || !/^[a-f0-9]{32}$/.test(payload.restorePoint)) return null;
    return { id: value.id, type: 'restore_core_backup', payload: { restorePoint: payload.restorePoint } };
  }

  if (value.type === 'restore_plugins') {
    const ids = payload.restorePoints;
    if (!Array.isArray(ids) || ids.length === 0) return null;
    if (!ids.every((id) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id))) return null;
    return { id: value.id, type: 'restore_plugins', payload: { restorePoints: ids as string[] } };
  }

  if (value.type === 'set_llms_txt') {
    if (!optionalText(payload.content, LLMS_TXT_MAX)) return null;
    return { id: value.id, type: 'set_llms_txt', payload: { content: payload.content } };
  }

  if (value.type === 'set_ai_crawler_rules') {
    const rules = payload.rules;
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return null;
    const clean: Record<string, 'allow' | 'block' | null> = {};
    for (const [agent, rule] of Object.entries(rules as Record<string, unknown>)) {
      if (!AI_AGENTS.has(agent) || (rule !== 'allow' && rule !== 'block' && rule !== null)) return null;
      clean[agent] = rule;
    }
    if (Object.keys(clean).length === 0) return null;
    return { id: value.id, type: 'set_ai_crawler_rules', payload: { rules: clean } };
  }

  if (value.type === 'set_schema') {
    const types = payload.types;
    if (!Array.isArray(types) || !types.every((type) => type === 'Organization' || type === 'WebSite')) return null;
    const sameAs = Array.isArray(payload.sameAs) ? payload.sameAs : [];
    if (!sameAs.every((url) => typeof url === 'string' && url.startsWith('https://'))) return null;
    return { id: value.id, type: 'set_schema', payload: { types: types as Array<'Organization' | 'WebSite'>, sameAs: sameAs as string[] } };
  }

  if (value.type === 'set_seo_meta') {
    if (typeof payload.postId !== 'number' || !Number.isInteger(payload.postId) || payload.postId <= 0) return null;
    const meta: { postId: number; restore: true; title?: string | null; description?: string | null } = { postId: payload.postId, restore: true };
    for (const field of ['title', 'description'] as const) {
      if (!(field in payload)) continue;
      if (!optionalText(payload[field], 2000)) return null;
      meta[field] = payload[field] as string | null;
    }
    if (!('title' in meta) && !('description' in meta)) return null;
    return { id: value.id, type: 'set_seo_meta', payload: meta };
  }

  if (value.type === 'set_plugin_auto_updates') {
    const plugins = payload.plugins;
    if (payload.replace !== true || !Array.isArray(plugins)) return null;
    if (!plugins.every((file) => typeof file === 'string' && PLUGIN_FILE.test(file) && !file.includes('..'))) return null;
    return { id: value.id, type: 'set_plugin_auto_updates', payload: { plugins: plugins as string[], replace: true } };
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
