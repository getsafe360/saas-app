// lib/net/isPublicUrl.ts
//
// SSRF guard for every place the server fetches a user-supplied URL.
//
//   isPublicUrl(url)          — synchronous: scheme, credentials, hostname and
//                               IP-literal checks
//   isPublicUrlResolved(url)  — also resolves DNS and rejects hostnames that
//                               point at private addresses (e.g. a public name
//                               that resolves to 169.254.169.254)
//
// Known limit: a redirect from a public host to a private one is not caught by
// either function; callers that follow redirects must re-check each hop.

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const PRIVATE = new BlockList();
// IPv4
PRIVATE.addSubnet('0.0.0.0', 8, 'ipv4'); //        "this" network
PRIVATE.addSubnet('10.0.0.0', 8, 'ipv4'); //       private
PRIVATE.addSubnet('100.64.0.0', 10, 'ipv4'); //    carrier-grade NAT
PRIVATE.addSubnet('127.0.0.0', 8, 'ipv4'); //      loopback
PRIVATE.addSubnet('169.254.0.0', 16, 'ipv4'); //   link-local, cloud metadata (169.254.169.254)
PRIVATE.addSubnet('172.16.0.0', 12, 'ipv4'); //    private
PRIVATE.addSubnet('192.0.0.0', 24, 'ipv4'); //     IETF protocol assignments
PRIVATE.addSubnet('192.168.0.0', 16, 'ipv4'); //   private
PRIVATE.addSubnet('198.18.0.0', 15, 'ipv4'); //    benchmarking
PRIVATE.addSubnet('224.0.0.0', 3, 'ipv4'); //      multicast + reserved + broadcast
// IPv6
PRIVATE.addAddress('::', 'ipv6'); //               unspecified
PRIVATE.addAddress('::1', 'ipv6'); //              loopback
PRIVATE.addSubnet('fc00::', 7, 'ipv6'); //         unique local
PRIVATE.addSubnet('fe80::', 10, 'ipv6'); //        link-local
PRIVATE.addSubnet('ff00::', 8, 'ipv6'); //         multicast

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (!version) return true; // not an IP at all: refuse rather than guess

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) must be judged by its IPv4 part.
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return PRIVATE.check(mapped[1], 'ipv4');

  return PRIVATE.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

const BLOCKED_HOSTNAME = /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/i;

export function isPublicUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;

    // WHATWG URL normalises decimal/hex/octal IPv4 forms (e.g. http://2130706433
    // becomes 127.0.0.1) and strips IPv6 brackets only via the hostname below.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (BLOCKED_HOSTNAME.test(host)) return false;
    if (isIP(host)) return !isPrivateIp(host);
    return true;
  } catch {
    return false;
  }
}

/** isPublicUrl + DNS: every address the hostname resolves to must be public. */
export async function isPublicUrlResolved(u: string): Promise<boolean> {
  if (!isPublicUrl(u)) return false;
  const host = new URL(u).hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return true; // already checked above

  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // unresolvable: nothing to fetch anyway
  }
}
