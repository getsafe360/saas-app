// lib/security/csp/proposal.ts
//
// Turns what browsers reported during the report-only test into a policy that
// can be switched on: every source that was blocked becomes a candidate, the
// owner (with Claude's advice) allows or blocks each one, and the final policy
// is computed here — never written by the model.

import type { CspViolationSummary } from './reports';
import { isValidSource, parseCsp, serializeCsp, type CspDirective, type CspPolicy } from './policy';

export const CSP_ENFORCE_ACTION_ID = 'security-csp-enforce';
export const CSP_ENFORCE_HEADER = 'Content-Security-Policy';
export const MAX_CANDIDATES = 60;

export type CandidateDecision = 'allow' | 'block';

export interface CspCandidate {
  /** Stable key: "<directive> <source>". */
  key: string;
  directive: CspDirective;
  source: string;
  /** How often browsers reported it. */
  count: number;
  /** One page where it happened. */
  page: string | null;
  /** Weakens the policy noticeably ('unsafe-inline', 'unsafe-eval', a bare scheme). */
  risky: boolean;
}

export interface CandidateVerdict {
  key: string;
  decision: CandidateDecision;
  /** Short explanation for the owner, in their language. */
  reason: string | null;
}

/** Directives a report can name; anything else (e.g. script-src-elem) has been aliased already. */
const FETCH_DIRECTIVES: ReadonlySet<string> = new Set([
  'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'media-src', 'frame-src',
  'worker-src', 'manifest-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'default-src',
]);

/** The policy keyword that would allow what a report calls 'inline', 'eval' or 'wasm-eval'. */
function tokenFor(blocked: string): string | null {
  if (blocked === "'inline'") return "'unsafe-inline'";
  if (blocked === "'eval'") return "'unsafe-eval'";
  if (blocked === "'wasm-eval'") return "'wasm-unsafe-eval'";
  return isValidSource(blocked) ? blocked : null;
}

const RISKY = new Set(["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", 'http:', 'https:', 'ws:', 'wss:', '*']);

/** What a directive currently allows, falling back to default-src as browsers do. */
function effectiveSources(policy: CspPolicy, directive: CspDirective): string[] {
  const own = policy[directive];
  if (own) return own;
  // base-uri, form-action and frame-ancestors do not fall back to default-src.
  if (directive === 'base-uri' || directive === 'form-action' || directive === 'frame-ancestors') return [];
  return policy['default-src'] ?? [];
}

export function buildCandidates(policyHeader: string, violations: ReadonlyArray<CspViolationSummary>): CspCandidate[] {
  const policy = parseCsp(policyHeader);
  const byKey = new Map<string, CspCandidate>();
  for (const violation of violations) {
    if (!FETCH_DIRECTIVES.has(violation.directive)) continue;
    const directive = violation.directive as CspDirective;
    const source = tokenFor(violation.blocked);
    if (!source) continue;
    if (effectiveSources(policy, directive).includes(source)) continue;
    const key = `${directive} ${source}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += violation.count;
      existing.page ??= violation.page;
    } else {
      byKey.set(key, { key, directive, source, count: violation.count, page: violation.page, risky: RISKY.has(source) });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count).slice(0, MAX_CANDIDATES);
}

/** Without advice: allow ordinary sources, keep the policy-weakening ones blocked. */
export function defaultVerdicts(candidates: ReadonlyArray<CspCandidate>): CandidateVerdict[] {
  return candidates.map((candidate) => ({ key: candidate.key, decision: candidate.risky ? 'block' : 'allow', reason: null }));
}

/** The policy to switch on: the tested one plus every allowed candidate. Unknown keys are ignored. */
export function applyVerdicts(
  policyHeader: string,
  candidates: ReadonlyArray<CspCandidate>,
  allowedKeys: ReadonlyArray<string>,
): string {
  const policy = parseCsp(policyHeader);
  const allowed = new Set(allowedKeys);
  for (const candidate of candidates) {
    if (!allowed.has(candidate.key)) continue;
    const current = policy[candidate.directive] ?? [...effectiveSources(policy, candidate.directive)];
    // 'none' cannot be combined with other sources.
    const next = current.filter((token) => token !== "'none'");
    if (!next.includes(candidate.source)) next.push(candidate.source);
    policy[candidate.directive] = next;
  }
  return serializeCsp(policy);
}
