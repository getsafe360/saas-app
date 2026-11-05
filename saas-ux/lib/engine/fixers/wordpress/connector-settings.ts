// lib/engine/fixers/wordpress/connector-settings.ts
//
// Fixers for the connector's built-in protection toggles (XML-RPC, user
// enumeration). Behaviour is unchanged from the previous switch-based
// planner; only the structure moved into the registry.

import { createWordPressClient } from '@/lib/wordpress/client';
import type { WordPressConnectorSettingPayload } from '@/lib/wordpress/types';
import {
  type ConnectorFixer,
  type FixerActionTemplate,
  type FixerVerifyContext,
  type VerificationCheck,
  verificationResult,
} from '../types';

type SettingKey = WordPressConnectorSettingPayload['key'];

const USER_AGENT = 'GetSafe360-WordPressVerifier/1.0';

async function connectorStateCheck(context: FixerVerifyContext, key: SettingKey): Promise<VerificationCheck> {
  const client = createWordPressClient({ siteUrl: context.siteUrl, tokenHash: context.tokenHash, timeout: 10000 });
  const setting = (context.action.payload.setting ?? {}) as Partial<WordPressConnectorSettingPayload>;
  const pull = await client.pull();
  const actual = Boolean(pull.protections?.[key]);
  const ok = actual === Boolean(setting.enabled);
  const label = key === 'disableXmlRpc' ? 'XML-RPC protection' : 'user enumeration protection';
  return {
    name: key === 'disableXmlRpc' ? 'connector-state:disable-xmlrpc' : 'connector-state:block-user-enumeration',
    ok,
    detail: ok ? `Connector reports ${label} enabled.` : `Connector did not confirm ${label}.`,
  };
}

async function publicUserEndpointsBlocked(context: FixerVerifyContext): Promise<VerificationCheck[]> {
  const doFetch = context.fetchImpl ?? fetch;
  const base = context.siteUrl.replace(/\/$/, '');
  const checks: VerificationCheck[] = [];

  try {
    const rest = await doFetch(`${base}/wp-json/wp/v2/users`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    checks.push({
      name: 'public-rest-users-blocked',
      ok: rest.status >= 400,
      detail: `Public user endpoint returned HTTP ${rest.status}.`,
    });
  } catch (error) {
    checks.push({
      name: 'public-rest-users-blocked',
      ok: false,
      detail: error instanceof Error ? error.message : 'Failed to verify REST user endpoint.',
    });
  }

  try {
    const probe = await doFetch(`${base}/?author=1`, {
      redirect: 'manual',
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
    });
    const location = probe.headers.get('location') ?? '';
    checks.push({
      name: 'author-probe-blocked',
      ok: probe.status >= 400 || !/\/author\//i.test(location),
      detail:
        probe.status >= 400
          ? `Author probe returned HTTP ${probe.status}.`
          : location
            ? `Author probe redirect location: ${location}`
            : `Author probe returned HTTP ${probe.status} with no author redirect.`,
    });
  } catch (error) {
    checks.push({
      name: 'author-probe-blocked',
      ok: false,
      detail: error instanceof Error ? error.message : 'Failed to verify author archive probe.',
    });
  }

  return checks;
}

function settingFixer(
  id: string,
  key: SettingKey,
  template: Omit<FixerActionTemplate, 'type' | 'payload' | 'requiredCapabilities'> & { capability: string },
  extraVerify?: (context: FixerVerifyContext) => Promise<VerificationCheck[]>,
): ConnectorFixer {
  return {
    id,
    executor: 'wp-connector',
    plan: (findings) => {
      if (findings.length === 0) return null;
      const { capability, ...rest } = template;
      return {
        ...rest,
        type: 'update_connector_setting',
        requiredCapabilities: [capability],
        payload: { setting: { key, enabled: true } },
      };
    },
    toConnectorRequest: (action) => {
      const setting = action.payload.setting as Partial<WordPressConnectorSettingPayload> | undefined;
      if (setting?.key !== key) return null;
      return { id: action.id, type: 'update_connector_setting', payload: { key, enabled: setting.enabled !== false } };
    },
    verify: async (context) => {
      const checks = [await connectorStateCheck(context, key)];
      if (extraVerify) checks.push(...(await extraVerify(context)));
      return verificationResult(checks);
    },
  };
}

export const blockUserEnumerationFixer = settingFixer(
  'wordpress-block-user-enumeration',
  'blockUserEnumeration',
  {
    title: 'Block public user enumeration',
    description:
      'Enable the connector guard that blocks REST user list exposure and the common ?author=ID enumeration path for anonymous visitors.',
    risk: 'low',
    autoApplyEligible: true,
    requiresApproval: false,
    capability: 'securityBlockUserEnumeration',
    verification: {
      kind: 'mixed',
      expectation: 'The connector reports user enumeration protection as enabled and public user endpoints stop exposing users.',
      assertions: [
        'Connector protection state reports blockUserEnumeration = true',
        'Public /wp-json/wp/v2/users no longer returns a user list',
        'Public ?author=1 probing is blocked or does not resolve to an author archive',
      ],
    },
  },
  publicUserEndpointsBlocked,
);

export const disableXmlRpcFixer = settingFixer('wordpress-disable-xmlrpc', 'disableXmlRpc', {
  title: 'Disable XML-RPC',
  description: 'Enable the connector guard that disables XML-RPC at the WordPress layer unless the site explicitly needs it.',
  risk: 'low',
  autoApplyEligible: true,
  requiresApproval: false,
  capability: 'securityDisableXmlrpc',
  verification: {
    kind: 'api',
    expectation: 'The connector reports XML-RPC protection as enabled after the change.',
    assertions: ['Connector protection state reports disableXmlRpc = true'],
  },
});
