// lib/engine/fixers/registry.ts
//
// Every automated fix is registered here. Findings reach a fixer through
// their `FixRef.fixerId`; anything without a registered fixer falls back to
// guided review in the planner.

import type { ConnectorFixer } from './types';
import { blockUserEnumerationFixer, disableXmlRpcFixer } from './wordpress/connector-settings';
import { securityHeadersFixer } from './wordpress/security-headers';

const FIXERS: ReadonlyArray<ConnectorFixer> = [blockUserEnumerationFixer, disableXmlRpcFixer, securityHeadersFixer];

const BY_ID = new Map(FIXERS.map((fixer) => [fixer.id, fixer]));

export function getFixer(fixerId: string | undefined | null): ConnectorFixer | undefined {
  return fixerId ? BY_ID.get(fixerId) : undefined;
}

export function listFixers(): ReadonlyArray<ConnectorFixer> {
  return FIXERS;
}
