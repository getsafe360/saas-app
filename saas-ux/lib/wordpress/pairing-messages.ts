// lib/wordpress/pairing-messages.ts
//
// Pairing status and error messages as translation keys
// (SiteCockpit.connection.pairing.messages.*), so every pairing UI can show
// them in the user's language. The English text stays available for callers
// that do not translate yet.

export const PAIRING_MESSAGE_KEYS = [
  'pluginDetected',
  'pluginNotDetected',
  'openAdmin',
  'waiting',
  'connected',
  'expired',
  'noConfirmation',
  'tooMany',
  'unavailable',
  'domainNotAllowed',
  'invalidUrl',
  'generic',
] as const;

export type PairingMessageKey = (typeof PAIRING_MESSAGE_KEYS)[number];

export const PAIRING_MESSAGES_EN: Record<PairingMessageKey, string> = {
  pluginDetected: 'Plugin detected — open WordPress Admin → GetSafe 360 → paste the code',
  pluginNotDetected: 'Plugin not detected — install the GetSafe 360 plugin first, then paste the code',
  openAdmin: 'Open WordPress Admin → GetSafe 360 → paste the code',
  waiting: 'Waiting for plugin confirmation…',
  connected: 'Connection established — syncing dashboard…',
  expired: 'Code expired (10 min limit) → generate a new one',
  noConfirmation: 'No confirmation received — paste the code in WordPress and try again',
  tooMany: 'Too many attempts → wait 10 minutes and try again',
  unavailable: 'Service temporarily unavailable → retry in a moment',
  domainNotAllowed: 'Domain not allowed in this environment',
  invalidUrl: 'Enter a valid site URL (include https://)',
  generic: 'Error generating code → try again',
};

/** Maps an error from /api/connect/start (or the network) to a message key. */
export function classifyPairingError(raw: string): PairingMessageKey {
  const text = raw.toLowerCase();
  if (raw.includes('429') || text.includes('too many')) return 'tooMany';
  if (raw.includes('503') || text.includes('busy')) return 'unavailable';
  if (text.includes('domain not allowed')) return 'domainNotAllowed';
  if (text.includes('enter a valid')) return 'invalidUrl';
  return 'generic';
}

/** The key for the plugin-detection hint shown once a code exists. */
export function readyMessageKey(pluginDetected: boolean | null): PairingMessageKey {
  if (pluginDetected === true) return 'pluginDetected';
  if (pluginDetected === false) return 'pluginNotDetected';
  return 'openAdmin';
}
