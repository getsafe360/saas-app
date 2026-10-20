// lib/net/isPublicUrlResolved.ts
//
// isPublicUrl() plus DNS: every address the hostname resolves to must be public,
// so a public-looking name that points at 169.254.169.254 or 127.0.0.1 is
// rejected. Uses node:dns, so it works on the Node runtime only (not Edge).

import { lookup } from 'node:dns/promises';
import { isIpLiteral, isPrivateIp, isPublicUrl } from './isPublicUrl';

export async function isPublicUrlResolved(u: string): Promise<boolean> {
  if (!isPublicUrl(u)) return false;
  const host = new URL(u).hostname.replace(/^\[|\]$/g, '');
  if (isIpLiteral(host)) return true; // already checked by isPublicUrl

  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // unresolvable: nothing to fetch anyway
  }
}
