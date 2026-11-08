// lib/wordpress/applied-changes.ts
//
// The site's history of connector changes, as the "Applied changes" list shows
// it: only runs that actually modified WordPress, newest first, with Undo
// offered exactly where the rollback route would accept it.

import { parseRollbackRequest, planRollback, type RollbackCandidate } from './rollback';

export type AppliedChangeState =
  /** Applied and confirmed on the live site. */
  | 'active'
  /** Applied, but the live check did not see it (e.g. a cache). Still on the site. */
  | 'unverified'
  /** Undone. */
  | 'undone';

export interface AppliedChange {
  runId: string;
  actionId: string;
  /** Findings the change addressed, for translated titles. */
  findingIds: string[];
  /** English title recorded with the run; the fallback when no finding title exists. */
  title: string;
  state: AppliedChangeState;
  appliedAt: string;
  /** When it was undone (rolled_back runs only). */
  undoneAt: string | null;
  undoable: boolean;
}

export interface ActionRunRow extends RollbackCandidate {
  title: string;
  inputPayload: unknown;
  verificationOk: boolean | null;
  completedAt: Date | string | null;
}

const iso = (value: Date | string) => new Date(value).toISOString();

function findingIdsOf(run: ActionRunRow): string[] {
  const payload = (run.inputPayload as { planAction?: { payload?: { sourceFindingIds?: unknown } }; findingId?: unknown } | null);
  const ids = payload?.planAction?.payload?.sourceFindingIds;
  if (Array.isArray(ids)) {
    const clean = ids.filter((id): id is string => typeof id === 'string');
    if (clean.length > 0) return clean;
  }
  return typeof payload?.findingId === 'string' ? [payload.findingId] : [];
}

/** True when the run changed the site: the connector applied it and returned an inverse. */
function changedSite(run: ActionRunRow): boolean {
  if (run.status === 'rolled_back') return true;
  return (run.status === 'applied' || run.status === 'failed') && parseRollbackRequest(run.rollbackPayload) !== null;
}

export function toAppliedChanges(runs: ReadonlyArray<ActionRunRow>, limit = 20): AppliedChange[] {
  const relevant = runs
    .filter(changedSite)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);

  return relevant.map((run) => {
    const state: AppliedChangeState =
      run.status === 'rolled_back' ? 'undone' : run.status === 'applied' && run.verificationOk !== false ? 'active' : 'unverified';
    // Same check the rollback route runs: blocked while a newer change to the same setting is applied.
    const plan = state === 'undone' ? null : planRollback([run], runs);
    return {
      runId: run.id,
      actionId: run.actionId,
      findingIds: findingIdsOf(run),
      title: run.title,
      state,
      appliedAt: iso(run.startedAt),
      undoneAt: state === 'undone' && run.completedAt ? iso(run.completedAt) : null,
      undoable: plan !== null && plan.planned.length === 1 && plan.blocked.length === 0,
    };
  });
}
