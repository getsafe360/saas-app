// lib/engine/fixers/catalog.ts
//
// Which fixers can run automatically, without importing their implementations.
// The checklist runs in the browser, so it reads this list instead of the
// registry (which pulls in the connector client). registry.test.ts keeps the
// two in sync.

import type { FixAutomation } from '../contracts';

export const AUTOMATIC_FIXER_IDS: ReadonlySet<string> = new Set([
  'wordpress-block-user-enumeration',
  'wordpress-disable-xmlrpc',
  'security-headers',
  // Connector 1.7
  'wordpress-disable-file-edit',
  'wordpress-enable-core-auto-updates',
  'wordpress-fix-default-role',
  'wordpress-tighten-config-permissions',
  'wordpress-enable-plugin-auto-updates',
  'wordpress-clean-transients',
  'wordpress-limit-revisions',
  // Connector 1.8
  'wordpress-update-plugins',
]);

/**
 * Fixers whose change cannot be undone (deleted rows, or a default role the
 * connector refuses to restore). They are never ticked in advance, and the
 * Applied changes list shows them without Undo.
 */
export const PERMANENT_FIXER_IDS: ReadonlySet<string> = new Set([
  'wordpress-fix-default-role',
  'wordpress-clean-transients',
  'wordpress-limit-revisions',
]);

/**
 * How the user resolves a finding:
 * - automatic: a registered fixer applies, verifies and can undo it
 * - guided: we give the steps; the user does them and re-scans
 * - manual: needs the host or a developer
 */
export type FixMode = 'automatic' | 'guided' | 'manual';

export function fixModeFor(fixerId: string | undefined, automation: FixAutomation | undefined): FixMode {
  if (fixerId && automation === 'auto' && AUTOMATIC_FIXER_IDS.has(fixerId)) return 'automatic';
  if (automation === 'guided' || automation === 'auto') return 'guided';
  return 'manual';
}
