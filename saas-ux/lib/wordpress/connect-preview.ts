// lib/wordpress/connect-preview.ts
//
// What connecting the WordPress plugin would let us fix, worked out from the
// public checks a site already has. Shown before pairing, so the owner sees
// the value of connecting on their own findings.

/**
 * automatic: one click, with undo. lasting: one click, but browsers keep the
 * effect after an undo (HSTS). tested: tried in report-only mode first.
 */
export type ConnectFixKind = 'automatic' | 'lasting' | 'tested';

export const CONNECT_FIXES: Readonly<Record<string, ConnectFixKind>> = {
  'sec-wp-xmlrpc': 'automatic',
  'sec-wp-user-enum': 'automatic',
  'sec-hsts': 'lasting',
  'sec-nosniff': 'automatic',
  'sec-referrer-policy': 'automatic',
  'sec-frame-options': 'automatic',
  'sec-csp': 'tested',
};

export interface ConnectPreview {
  automatic: string[];
  lasting: string[];
  tested: string[];
}

export function connectPreview(problemIds: ReadonlyArray<string>): ConnectPreview {
  const unique = [...new Set(problemIds)];
  return {
    automatic: unique.filter((id) => CONNECT_FIXES[id] === 'automatic'),
    lasting: unique.filter((id) => CONNECT_FIXES[id] === 'lasting'),
    tested: unique.filter((id) => CONNECT_FIXES[id] === 'tested'),
  };
}

/** Every failing check id across the cockpit's categories. */
export function problemIdsFrom(
  insights: Record<string, { problemIds?: string[]; topFindings?: Array<{ id: string }> } | undefined> | undefined,
): string[] {
  if (!insights) return [];
  return Object.values(insights).flatMap(
    (insight) => insight?.problemIds ?? insight?.topFindings?.map((finding) => finding.id) ?? [],
  );
}
