// lib/net/safeFetch.ts
//
// fetch() that follows redirects ITSELF, validating every hop, so a public URL cannot
// bounce our server to an internal address (cloud metadata, localhost, a private
// network). `redirect: "follow"` hides the hops; this does not.
//
// Pure JavaScript (no node:* imports) so it also runs on the Edge runtime. The
// default validator is the synchronous isPublicUrl. Node-only callers should pass
// isPublicUrlResolved (lib/net/isPublicUrlResolved) to also reject public names whose
// DNS points at a private address.
//
// Known limit: DNS is resolved by the validator and again by fetch, so a hostname that
// changes its answer between the two (DNS rebinding) is only narrowed, not eliminated.

import { fetchWithTimeout } from './fetchWithTimeout';
import { isPublicUrl } from './isPublicUrl';

export type UrlValidator = (url: string) => boolean | Promise<boolean>;

export class UnsafeUrlError extends Error {
  constructor(public readonly url: string) {
    super('Refusing to fetch a non-public address.');
    this.name = 'UnsafeUrlError';
  }
}

export async function fetchFollowingSafely(
  url: string,
  opts: { timeoutMs?: number; validate?: UrlValidator; maxRedirects?: number } & Omit<RequestInit, 'redirect'> = {},
): Promise<Response> {
  const { validate = isPublicUrl, maxRedirects = 5, ...rest } = opts;
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await validate(current))) throw new UnsafeUrlError(current);

    const res = await fetchWithTimeout(current, { ...rest, redirect: 'manual' });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      try {
        await res.body?.cancel();
      } catch {
        /* the body is not needed */
      }
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }

  throw new Error('Too many redirects.');
}
