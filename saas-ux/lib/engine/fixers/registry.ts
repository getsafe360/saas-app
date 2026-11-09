// lib/engine/fixers/registry.ts
//
// Every automated fix is registered here. Findings reach a fixer through
// their `FixRef.fixerId`; anything without a registered fixer falls back to
// guided review in the planner.

import type { ConnectorFixer } from './types';
import {
  blockUserEnumerationFixer,
  coreAutoUpdatesFixer,
  disableFileEditorFixer,
  disableXmlRpcFixer,
} from './wordpress/connector-settings';
import { securityHeadersFixer } from './wordpress/security-headers';
import { pluginUpdatesFixer } from './wordpress/plugin-updates';
import {
  cleanTransientsFixer,
  configPermissionsFixer,
  defaultRoleFixer,
  pluginAutoUpdatesFixer,
  revisionsFixer,
} from './wordpress/site-maintenance';

const FIXERS: ReadonlyArray<ConnectorFixer> = [
  blockUserEnumerationFixer,
  disableXmlRpcFixer,
  securityHeadersFixer,
  // Connector 1.7
  disableFileEditorFixer,
  coreAutoUpdatesFixer,
  defaultRoleFixer,
  configPermissionsFixer,
  pluginAutoUpdatesFixer,
  cleanTransientsFixer,
  revisionsFixer,
  // Connector 1.8
  pluginUpdatesFixer,
];

const BY_ID = new Map(FIXERS.map((fixer) => [fixer.id, fixer]));

export function getFixer(fixerId: string | undefined | null): ConnectorFixer | undefined {
  return fixerId ? BY_ID.get(fixerId) : undefined;
}

export function listFixers(): ReadonlyArray<ConnectorFixer> {
  return FIXERS;
}
