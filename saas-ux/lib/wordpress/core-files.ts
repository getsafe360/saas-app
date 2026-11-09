// lib/wordpress/core-files.ts
//
// Core integrity data from the connector (≥ 1.9, capability `coreIntegrity`).
// Paths only for the list; one file's changed lines for a diff. Diffs are
// shown and reviewed, never stored.

export interface WordPressCoreFilesResponse {
  success: boolean;
  version: string;
  /** Core files whose checksum differs from the official release. */
  modified: string[];
  /** PHP files in wp-admin/ or wp-includes/ that are not part of WordPress. */
  unexpected: string[];
  /** False when the scan ran out of time; the lists may then be incomplete. */
  complete: boolean;
}

export interface WordPressCoreFileDiff {
  success: boolean;
  path: string;
  kind: 'modified' | 'unexpected' | 'unchanged';
  /** Unified diff against the official copy (unexpected files: all lines added); null when too large. */
  diff: string | null;
  truncated: boolean;
  size?: number;
}

const CORE_PATH = /^[A-Za-z0-9._/-]+$/;

/** Same rule as the connector: a core location, never wp-config.php or wp-content. */
export function isCorePath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    CORE_PATH.test(path) &&
    !path.includes('..') &&
    !path.startsWith('wp-content/') &&
    path !== 'wp-config.php'
  );
}

export function parseCoreFiles(raw: unknown): WordPressCoreFilesResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<WordPressCoreFilesResponse>;
  if (!Array.isArray(value.modified) || !Array.isArray(value.unexpected)) return null;
  return {
    success: value.success === true,
    version: typeof value.version === 'string' ? value.version : '',
    modified: value.modified.filter(isCorePath),
    unexpected: value.unexpected.filter(isCorePath),
    complete: value.complete === true,
  };
}
