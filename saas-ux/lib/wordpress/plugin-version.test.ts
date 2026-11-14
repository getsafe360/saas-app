import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CURRENT_PLUGIN_VERSION, isPluginOutdated } from './plugin-version';

test('matches the version in the shipped plugin file', () => {
  const source = readFileSync(join(process.cwd(), 'public/wp-plugin/getsafe-360-ai.php'), 'utf8');
  assert.equal(source.match(/^\s*\*\s*Version:\s*(\S+)/m)?.[1], CURRENT_PLUGIN_VERSION);
});

test('compares versions numerically', () => {
  assert.equal(isPluginOutdated('1.9.0', '1.10.0'), true);
  assert.equal(isPluginOutdated('1.10.0', '1.10.0'), false);
  assert.equal(isPluginOutdated('1.11.0', '1.10.0'), false);
  assert.equal(isPluginOutdated('2', '1.10.0'), false);
});
