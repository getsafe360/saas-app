// lib/engine/messages.ts
//
// All finding text lives in messages/Findings/{locale}.json (ICU format), one
// entry per rule: `title`, `recommendation` and one key per outcome. Rules
// only name the outcome key; the engine renders English for stored data and
// reports, and the UI renders the same key in the user's language.

import { IntlMessageFormat } from 'intl-messageformat';
import enCatalog from '@/messages/Findings/en.json';

export type MessageValues = Record<string, string | number>;

/** A rule's outcome key ("outdated") or a shared one ("common.notReported"). */
export interface MessageRef {
  key: string;
  values?: MessageValues;
}

type Catalog = Record<string, Record<string, string>>;

const EN = (enCatalog as { Findings: Catalog }).Findings;
const formatters = new Map<string, IntlMessageFormat>();

/** Full catalog key ("wp-cron.overdue"); shared keys are already absolute. */
export function messageKey(ruleId: string, key: string): string {
  return key.includes('.') ? key : `${ruleId}.${key}`;
}

export function hasMessage(fullKey: string): boolean {
  const [group, entry] = fullKey.split('.');
  return typeof EN[group]?.[entry] === 'string';
}

/** English text for a catalog key; the key itself when missing (tests catch that). */
export function renderMessage(fullKey: string, values?: MessageValues): string {
  const [group, entry] = fullKey.split('.');
  const template = EN[group]?.[entry];
  if (typeof template !== 'string') return fullKey;
  let formatter = formatters.get(fullKey);
  if (!formatter) {
    formatter = new IntlMessageFormat(template, 'en', undefined, { ignoreTag: true });
    formatters.set(fullKey, formatter);
  }
  return String(formatter.format(values ?? {}));
}
