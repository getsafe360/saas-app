// lib/wordpress/timeouts.ts
//
// How long the SaaS waits for the connector per action type. Most actions
// flip a setting and answer within a second; plugin updates download and
// unpack packages (the connector stops starting new ones after 20 s).

import type { WordPressConnectorActionRequest } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;

const TIMEOUT_BY_TYPE: Partial<Record<WordPressConnectorActionRequest['type'], number>> = {
  update_plugins: 90_000,
  restore_plugins: 60_000,
};

export function connectorTimeoutFor(type: WordPressConnectorActionRequest['type'] | string): number {
  return TIMEOUT_BY_TYPE[type as WordPressConnectorActionRequest['type']] ?? DEFAULT_TIMEOUT_MS;
}
