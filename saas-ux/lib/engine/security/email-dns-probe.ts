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
  const [apex, dmarcName] = await Promise.all([
    withTimeout(lookupTxt(resolve, domain, /^v=spf1(\s|$)/i)).then((r) => r ?? failed),
    withTimeout(lookupTxt(resolve, `_dmarc.${domain}`, /^v=DMARC1\s*;?/i)).then((r) => r ?? failed),
  ]);

  // An answer for the site's own domain proves the resolver works. Only then
  // can a missing _dmarc name be read as "no DMARC record"; a resolver that
  // answers "not found" for everything must not fail every site.
  const resolverWorks = apex.kind === 'records';
  const spf = apex.kind === 'records' ? apex.records : null;
  const dmarc =
    dmarcName.kind === 'records'
      ? dmarcName.records
      : dmarcName.kind === 'nxdomain' && resolverWorks
        ? []
        : null;

  return { domain, spf, dmarc, checkedAt: new Date().toISOString() };
}

