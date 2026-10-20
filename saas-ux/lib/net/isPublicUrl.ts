// lib/net/isPublicUrl.ts
//
// SSRF guard for every place the server fetches a user-supplied URL.
//
// This module is PURE JavaScript (no node:* imports) so it also runs on the Edge
// runtime. It checks the URL's scheme, credentials, hostname and any IP literal.
// To also resolve DNS and reject public names that point at private addresses,
// use isPublicUrlResolved() from ./isPublicUrlResolved (Node runtime only).
//
// Known limit: a redirect from a public host to a private one is not caught here;
// callers that follow redirects must re-check each hop.

/** IPv4 ranges that are never valid fetch targets: [first, last] as unsigned ints. */
const PRIVATE_V4: Array<[number, number]> = [
  [ip4('0.0.0.0'), ip4('0.255.255.255')], //         "this" network
  [ip4('10.0.0.0'), ip4('10.255.255.255')], //       private
  [ip4('100.64.0.0'), ip4('100.127.255.255')], //    carrier-grade NAT
  [ip4('127.0.0.0'), ip4('127.255.255.255')], //     loopback
  [ip4('169.254.0.0'), ip4('169.254.255.255')], //   link-local, cloud metadata (169.254.169.254)
  [ip4('172.16.0.0'), ip4('172.31.255.255')], //     private
  [ip4('192.0.0.0'), ip4('192.0.0.255')], //         IETF protocol assignments
  [ip4('192.168.0.0'), ip4('192.168.255.255')], //   private
  [ip4('198.18.0.0'), ip4('198.19.255.255')], //     benchmarking
  [ip4('224.0.0.0'), ip4('255.255.255.255')], //     multicast + reserved + broadcast
];

function ip4(s: string): number {
  const [a, b, c, d] = s.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

const V4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateV4(s: string): boolean {
  const m = s.match(V4_RE);
  if (!m) return true; // not a valid dotted quad: refuse
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const n = ip4(parts.join('.'));
  return PRIVATE_V4.some(([lo, hi]) => n >= lo && n <= hi);
}

/** Expand an IPv6 literal to eight 16-bit groups, or null if malformed. */
function parseV6(input: string): number[] | null {
  let s = input.toLowerCase();
  if (s.includes('%')) s = s.slice(0, s.indexOf('%')); // zone id

  // Embedded dotted IPv4 tail (::ffff:1.2.3.4) -> two hex groups
  const tail = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (tail) {
    const m = tail[1].split('.').map(Number);
    if (m.some((n) => n > 255)) return null;
    s = s.slice(0, -tail[1].length) + ((m[0] << 8) | m[1]).toString(16) + ':' + ((m[2] << 8) | m[3]).toString(16);
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

function v4FromGroups(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function isPrivateV6(s: string): boolean {
  const g = parseV6(s);
  if (!g) return true; // malformed: refuse
  const allZero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);

  if (allZero(0, 8)) return true; //                                  ::  unspecified
  if (allZero(0, 7) && g[7] === 1) return true; //                    ::1 loopback
  if ((g[0] & 0xfe00) === 0xfc00) return true; //                     fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; //                     fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; //                     ff00::/8 multicast
  if (allZero(0, 5) && g[5] === 0xffff) return isPrivateV4(v4FromGroups(g[6], g[7])); // ::ffff:a.b.c.d
  if (allZero(0, 6)) return isPrivateV4(v4FromGroups(g[6], g[7])); //                    ::a.b.c.d (deprecated)
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) return isPrivateV4(v4FromGroups(g[6], g[7])); // NAT64
  return false;
}

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip);
}

/** WHATWG URL normalises numeric hosts (e.g. http://2130706433 -> 127.0.0.1). */
export function isIpLiteral(host: string): boolean {
  return host.includes(':') || V4_RE.test(host);
}

const BLOCKED_HOSTNAME = /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/i;

export function isPublicUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;

    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (BLOCKED_HOSTNAME.test(host)) return false;
    if (isIpLiteral(host)) return !isPrivateIp(host);
    return true;
  } catch {
    return false;
  }
}
