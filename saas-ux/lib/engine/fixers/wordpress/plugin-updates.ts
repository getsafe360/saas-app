// lib/engine/fixers/wordpress/plugin-updates.ts
//
// Updates outdated plugins through the connector (≥ 1.8). The connector saves
// a restore point before each update, checks the site still loads, and puts
// the old version back on its own when it does not. We verify from outside:
// the homepage must load, and no installable update may remain.

import { type ConnectorFixer, type VerificationCheck, verificationResult } from '../types';
import { auditChecks } from './audit-check';

const USER_AGENT = 'GetSafe360-WordPressVerifier/1.0';
const CRITICAL_ERROR = /There has been a critical error|<b>Fatal error<\/b>|Fatal error: /i;

async function homepageLoads(siteUrl: string, fetchImpl: typeof fetch = fetch): Promise<VerificationCheck> {
  const url = new URL(siteUrl);
  url.searchParams.set('gs360_verify', String(Date.now()));
  try {
    const response = await fetchImpl(url.toString(), {
      redirect: 'follow',
      cache: 'no-store',
      headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
    });
    const body = response.status < 500 ? await response.text() : '';
    const ok = response.status < 500 && !CRITICAL_ERROR.test(body);
    return {
      name: 'site-loads',
      ok,
      detail: ok
        ? `The homepage loads (HTTP ${response.status}).`
        : `The homepage returned HTTP ${response.status}${response.status < 500 ? ' with a PHP error' : ''}. Undo restores the previous plugin versions.`,
    };
  } catch (error) {
    return {
      name: 'site-loads',
      ok: false,
      detail: error instanceof Error ? error.message : 'The homepage could not be loaded.',
    };
  }
}

export const pluginUpdatesFixer: ConnectorFixer = {
  id: 'wordpress-update-plugins',
  executor: 'wp-connector',

  plan: (findings) =>
    findings.length === 0
      ? null
      : {
          type: 'update_plugins',
          title: 'Update outdated plugins',
          description:
            'Updates up to 5 plugins, one at a time. Before each update the connector saves the current version as a restore point; if the site stops loading, it puts the old version back immediately. Undo restores the plugin files of this run. Changes a new version makes to its own database tables are not undone.',
          risk: 'medium',
          autoApplyEligible: true,
          requiresApproval: false,
          requiredCapabilities: ['pluginUpdates'],
          verification: {
            kind: 'mixed',
            expectation: 'The site still loads and no installable plugin update remains.',
            assertions: ['The homepage loads without a PHP error', 'Site audit reports no installable plugin update'],
          },
          payload: { request: { plugins: 'outdated' } },
        },

  toConnectorRequest: (action) => ({ id: action.id, type: 'update_plugins', payload: { plugins: 'outdated' } }),

  async verify(context) {
    const checks = [await homepageLoads(context.siteUrl, context.fetchImpl)];
    checks.push(
      ...(await auditChecks(context, [
        {
          name: 'audit:plugin-updates',
          test: (audit) => {
            const available = audit.plugins.updatesAvailable;
            if (available === null) return null;
            return available - (audit.plugins.updatesWithoutPackage ?? 0) <= 0;
          },
          ok: 'Every plugin with an installable update is up to date.',
          failed: 'Some plugins still have updates; they may need another run, a licence, or were put back after an error.',
        },
      ])),
    );
    return verificationResult(checks);
  },
};
