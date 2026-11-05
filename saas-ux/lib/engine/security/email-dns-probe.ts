// lib/engine/security/email-dns-probe.ts
//
// DNS lookups for the SPF/DMARC checks. Node only: import from server code.
// Kept apart from the rules (email-dns.ts), which also run in the browser and
// must not pull in node:dns.

import { promises as dns } from 'node:dns';

import { mailDomainFor, type EmailDnsProbe } from './email-dns';

type TxtResolver = (name: string) => Promise<string[][]>;

type TxtLookup =
  /** The name exists; these are its matching records (possibly none). */
  | { kind: 'records'; records: string[] }
  /** The name does not exist (NXDOMAIN). */
  | { kind: 'nxdomain' }
  /** No usable answer: resolver failure, timeout, refused. */
  | { kind: 'failed' };

async function lookupTxt(resolve: TxtResolver, name: string, prefix: RegExp): Promise<TxtLookup> {
  try {
    const records = await resolve(name);
    return { kind: 'records', records: records.map((chunks) => chunks.join('')).filter((r) => prefix.test(r.trim())) };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'ENODATA') return { kind: 'records', records: [] };
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') return { kind: 'nxdomain' };
    return { kind: 'failed' };
  }
}

export async function probeEmailDns(
  siteUrl: string,
  options: { resolveTxt?: TxtResolver; timeoutMs?: number } = {},
): Promise<EmailDnsProbe | null> {
  const domain = mailDomainFor(siteUrl);
  if (!domain) return null;

  const resolve =
    options.resolveTxt ??
    ((name: string) => dns.resolveTxt(name));
  const timeoutMs = options.timeoutMs ?? 3000;

  const withTimeout = <T>(promise: Promise<T>) =>
    Promise.race([promise, new Promise<null>((done) => setTimeout(() => done(null), timeoutMs))]);

  const failed: TxtLookup = { kind: 'failed' };
  const DMARC_PREFIX = /^v=DMARC1\s*;?/i;
  const [apex, dmarcName] = await Promise.all([
    withTimeout(lookupTxt(resolve, domain, /^v=spf1(\s|$)/i)).then((r) => r ?? failed),
    withTimeout(lookupTxt(resolve, `_dmarc.${domain}`, DMARC_PREFIX)).then((r) => r ?? failed),
  ]);

  // An answer for the site's own domain proves the resolver works. Only then
  // can a missing _dmarc name be read as "no DMARC record"; a resolver that
  // answers "not found" for everything must not fail every site.
  const resolverWorks = apex.kind === 'records';
  const spf = apex.kind === 'records' ? apex.records : null;

  let dmarc: string[] | null = null;
  let dmarcSource: string | null = null;
  if (dmarcName.kind === 'records' && dmarcName.records.length > 0) {
    dmarc = dmarcName.records;
    dmarcSource = domain;
  } else if (dmarcName.kind === 'failed' || !resolverWorks) {
    dmarc = null;
  } else {
    // No record for the host itself: walk up to the parent domains, whose
    // policy covers subdomains (DMARC tree walk, RFC 7489 §6.6.3 / DMARCbis).
    dmarc = [];
    const labels = domain.split('.');
    for (let i = 1; i <= Math.min(labels.length - 2, 5); i += 1) {
      const parent = labels.slice(i).join('.');
      const lookup = (await withTimeout(lookupTxt(resolve, `_dmarc.${parent}`, DMARC_PREFIX))) ?? failed;
      if (lookup.kind === 'failed') {
        dmarc = null;
        break;
      }
      if (lookup.kind === 'records' && lookup.records.length > 0) {
        dmarc = lookup.records;
        dmarcSource = parent;
        break;
      }
    }
  }

  return { domain, spf, dmarc, dmarcSource, checkedAt: new Date().toISOString() };
}
