import { createWordPressClient } from '@/lib/wordpress/client';
import type {
  WordPressDetailedVerificationResult,
  WordPressPlannedAction,
} from '@/lib/wordpress/types';

async function verifyConnectorSettingAction(params: {
  siteUrl: string;
  tokenHash: string;
  action: WordPressPlannedAction;
}): Promise<WordPressDetailedVerificationResult> {
  const client = createWordPressClient({
    siteUrl: params.siteUrl,
    tokenHash: params.tokenHash,
    timeout: 10000,
  });

  const setting = (params.action.payload.setting ?? {}) as {
    key?: 'disableXmlRpc' | 'blockUserEnumeration';
    enabled?: boolean;
  };

  const pull = await client.pull();
  const protections = pull.protections ?? {
    disableXmlRpc: false,
    blockUserEnumeration: false,
  };

  const checks: WordPressDetailedVerificationResult['checks'] = [];

  if (setting.key === 'disableXmlRpc') {
    const enabled = protections.disableXmlRpc === Boolean(setting.enabled);
    checks.push({
      name: 'connector-state:disable-xmlrpc',
      ok: enabled,
      detail: enabled
        ? 'Connector reports XML-RPC protection enabled.'
        : 'Connector did not confirm XML-RPC protection.',
    });
  }

  if (setting.key === 'blockUserEnumeration') {
    const enabled = protections.blockUserEnumeration === Boolean(setting.enabled);
    checks.push({
      name: 'connector-state:block-user-enumeration',
      ok: enabled,
      detail: enabled
        ? 'Connector reports user enumeration protection enabled.'
        : 'Connector did not confirm user enumeration protection.',
    });

    try {
      const restResponse = await fetch(`${params.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GetSafe360-WordPressVerifier/1.0',
        },
      });
      checks.push({
        name: 'public-rest-users-blocked',
        ok: restResponse.status >= 400,
        detail: `Public user endpoint returned HTTP ${restResponse.status}.`,
      });
    } catch (error) {
      checks.push({
        name: 'public-rest-users-blocked',
        ok: false,
        detail: error instanceof Error ? error.message : 'Failed to verify REST user endpoint.',
      });
    }

    try {
      const authorProbe = await fetch(`${params.siteUrl.replace(/\/$/, '')}/?author=1`, {
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'GetSafe360-WordPressVerifier/1.0',
        },
      });
      const location = authorProbe.headers.get('location') ?? '';
      const likelyBlocked = authorProbe.status >= 400 || !/\/author\//i.test(location);
      checks.push({
        name: 'author-probe-blocked',
        ok: likelyBlocked,
        detail:
          authorProbe.status >= 400
            ? `Author probe returned HTTP ${authorProbe.status}.`
            : location
              ? `Author probe redirect location: ${location}`
              : `Author probe returned HTTP ${authorProbe.status} with no author redirect.`,
      });
    } catch (error) {
      checks.push({
        name: 'author-probe-blocked',
        ok: false,
        detail: error instanceof Error ? error.message : 'Failed to verify author archive probe.',
      });
    }
  }

  const success = checks.every((check) => check.ok);
  return {
    success,
    checkedAt: new Date().toISOString(),
    message: success
      ? 'Action verified successfully.'
      : 'One or more verification checks did not pass.',
    checks,
  };
}

export async function verifyWordPressAction(params: {
  siteUrl: string;
  tokenHash: string;
  action: WordPressPlannedAction;
}): Promise<WordPressDetailedVerificationResult> {
  if (params.action.type === 'update_connector_setting') {
    return verifyConnectorSettingAction(params);
  }

  return {
    success: false,
    checkedAt: new Date().toISOString(),
    message: 'No verification strategy is implemented for this action type yet.',
    checks: [
      {
        name: 'verification-strategy',
        ok: false,
        detail: `Unsupported action type: ${params.action.type}`,
      },
    ],
  };
}
