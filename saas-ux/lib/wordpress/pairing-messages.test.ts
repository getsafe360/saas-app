import assert from 'node:assert/strict';
import test from 'node:test';

import { PAIRING_MESSAGES_EN, PAIRING_MESSAGE_KEYS, classifyPairingError, readyMessageKey } from './pairing-messages';

test('maps /api/connect/start errors to message keys', () => {
  assert.equal(classifyPairingError('too many attempts, try again later'), 'tooMany');
  assert.equal(classifyPairingError('Connection failed (429) → try again'), 'tooMany');
  assert.equal(classifyPairingError('Pairing service busy. Please retry in a few seconds.'), 'unavailable');
  assert.equal(classifyPairingError('domain not allowed (private beta)'), 'domainNotAllowed');
  assert.equal(classifyPairingError('Enter a valid site URL'), 'invalidUrl');
  assert.equal(classifyPairingError('Internal error → try again'), 'generic');
  assert.equal(classifyPairingError(''), 'generic');
});

test('plugin detection picks the hint', () => {
  assert.equal(readyMessageKey(true), 'pluginDetected');
  assert.equal(readyMessageKey(false), 'pluginNotDetected');
  assert.equal(readyMessageKey(null), 'openAdmin');
});

test('every key has English text', () => {
  for (const key of PAIRING_MESSAGE_KEYS) assert.ok(PAIRING_MESSAGES_EN[key], key);
});
