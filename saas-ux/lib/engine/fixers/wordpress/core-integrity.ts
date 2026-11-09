// lib/engine/fixers/wordpress/core-integrity.ts
//
// Core integrity fixes through the connector (≥ 1.9): restore modified core
// files from the official release (every copy checked against the official
// checksum first) and quarantine PHP files that do not belong in wp-admin or
// wp-includes. Both keep the previous files in a restore point for undo and
// put them back on their own if the site stops loading.

import { parseCoreFiles } from '@/lib/wordpress/core-files';
import { createWordPressClient } from '@/lib/wordpress/client';
import type { WordPressConnectorActionRequest } from '@/lib/wordpress/types';
import { type ConnectorFixer, type FixerActionTemplate, type FixerVerifyContext, verificationResult } from '../types';

type Spec = {
  id: string;
  type: 'restore_core_files' | 'quarantine_core_files';
  paths: 'modified' | 'unexpected';
  template: Pick<FixerActionTemplate, 'title' | 'description'>;
  ok: string;
  failed: (count: number) => string;
};

async function coreFilesCheck(context: FixerVerifyContext, spec: Spec) {
  try {
    const client = createWordPressClient({ siteUrl: context.siteUrl, tokenHash: context.tokenHash, timeout: 20_000 });
    const files = parseCoreFiles(await client.coreFiles());
    if (!files) {
      return { name: `core-files:${spec.paths}`, ok: false, detail: 'The connector did not return the core file list.' };
    }
    const remaining = files[spec.paths].length;
    return {
      name: `core-files:${spec.paths}`,
      ok: remaining === 0 && files.complete,
      detail: remaining === 0 ? spec.ok : spec.failed(remaining),
    };
  } catch (error) {
    return {
      name: `core-files:${spec.paths}`,
      ok: false,
      detail: error instanceof Error ? error.message : 'The core file list could not be read.',
    };
  }
}

function coreFixer(spec: Spec): ConnectorFixer {
  return {
    id: spec.id,
    executor: 'wp-connector',
    plan: (findings) =>
      findings.length === 0
        ? null
        : {
            ...spec.template,
            type: spec.type,
            risk: 'medium',
            autoApplyEligible: true,
            requiresApproval: false,
            requiredCapabilities: ['coreIntegrity'],
            verification: {
              kind: 'api',
              expectation: spec.ok,
              assertions: [`The connector reports no ${spec.paths} core files`],
            },
            payload: { request: { paths: spec.paths } },
          },
    toConnectorRequest: (action): WordPressConnectorActionRequest => ({
      id: action.id,
      type: spec.type,
      payload: { paths: spec.paths },
    }),
    verify: async (context) => verificationResult([await coreFilesCheck(context, spec)]),
  };
}

export const restoreCoreFilesFixer = coreFixer({
  id: 'wordpress-restore-core-files',
  type: 'restore_core_files',
  paths: 'modified',
  template: {
    title: 'Restore official WordPress core files',
    description:
      'Replaces every modified core file with the official copy for your WordPress version, each checked against the official checksum before anything is written. The current files are kept in a restore point: undo puts them back, and so does the connector if the site stops loading. Review the changes first if someone customised core on purpose.',
  },
  ok: 'All core files match the official release.',
  failed: (count) => `${count} core file(s) still differ from the official release.`,
});

export const quarantineCoreFilesFixer = coreFixer({
  id: 'wordpress-quarantine-core-files',
  type: 'quarantine_core_files',
  paths: 'unexpected',
  template: {
    title: 'Quarantine unexpected files in core folders',
    description:
      'Removes PHP files from wp-admin and wp-includes that are not part of WordPress — a common hiding place for backdoors. They are kept in a restore point: undo brings them back, and so does the connector if the site stops loading. Change all passwords afterwards.',
  },
  ok: 'No unexpected files remain in wp-admin or wp-includes.',
  failed: (count) => `${count} unexpected file(s) remain in wp-admin or wp-includes.`,
});
