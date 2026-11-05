// lib/engine/security/email-dns.ts
//
// SPF and DMARC protect the site's domain from being used in spoofed email.
// DKIM is not checked: it needs the sender's selector, which DNS does not reveal.

import { type Rule, unknown } from '../rules';

export interface EmailDnsFacts {
  domain: string | null;
  /** TXT records at the domain starting with v=spf1; null when the lookup failed. */
  spf: string[] | null;
  /** TXT records at _dmarc.<domain> starting with v=DMARC1; null when the lookup failed. */
  dmarc: string[] | null;
}

export interface EmailDnsProbe {
  domain: string;
  spf: string[] | null;
  dmarc: string[] | null;
  checkedAt: string;
}

/** The domain mail would be sent from: the site host without a leading "www.". */
export function mailDomainFor(siteUrl: string): string | null {
  try {
    const host = new URL(siteUrl).hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function buildEmailDnsFacts(apiData: Record<string, any> | null | undefined): EmailDnsFacts {
  const probe = apiData?.emailDns;
  const list = (value: unknown) =>
    Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? (value as string[]) : null;
  return {
    domain: typeof probe?.domain === 'string' ? probe.domain : null,
    spf: list(probe?.spf),
    dmarc: list(probe?.dmarc),
  };
}

function dmarcPolicy(record: string): string | null {
  const match = /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(record);
  return match ? match[1].toLowerCase() : null;
}

export const EMAIL_DNS_RULES: ReadonlyArray<Rule<EmailDnsFacts>> = [
  {
    id: 'email-spf',
    category: 'security',
    title: 'SPF record',
    severity: 'medium',
    source: 'dns',
    recommendation:
      'Publish one SPF TXT record listing your mail senders and ending in -all (or ~all while testing). Domains that send no mail can use "v=spf1 -all".',
    fix: { fixerId: 'dns-publish-spf', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ domain, spf }) => {
      if (!domain || spf === null) return unknown('The SPF record could not be looked up.');
      if (spf.length === 0) {
        return {
          status: 'fail',
          summary: `${domain} has no SPF record, so anyone can send email that claims to come from it.`,
          impact: { riskReduction: 15 },
        };
      }
      if (spf.length > 1) {
        return {
          status: 'fail',
          summary: `${domain} has ${spf.length} SPF records; receivers treat that as an error and ignore all of them.`,
          observed: spf.join(' | '),
          impact: { riskReduction: 15 },
        };
      }
      const record = spf[0];
      if (/[+?]all\b/i.test(record) || !/[-~]all\b|redirect=/i.test(record)) {
        return {
          status: 'warn',
          summary: 'The SPF record does not reject unlisted senders.',
          observed: record,
          impact: { riskReduction: 8 },
        };
      }
      return { status: 'pass', summary: 'A valid SPF record is published.', observed: record };
    },
  },
  {
    id: 'email-dmarc',
    category: 'security',
    title: 'DMARC policy',
    severity: 'medium',
    source: 'dns',
    recommendation:
      'Publish a DMARC record at _dmarc.<domain>; start with p=none and a reporting address, then move to p=quarantine or p=reject.',
    fix: { fixerId: 'dns-publish-dmarc', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ domain, dmarc }) => {
      if (!domain || dmarc === null) return unknown('The DMARC record could not be looked up.');
      if (dmarc.length === 0) {
        return {
          status: 'fail',
          summary: `${domain} has no DMARC policy, so receivers have no instruction for spoofed mail.`,
          impact: { riskReduction: 12 },
        };
      }
      const record = dmarc[0];
      const policy = dmarcPolicy(record);
      if (policy === 'quarantine' || policy === 'reject') {
        return { status: 'pass', summary: `DMARC policy is "${policy}".`, observed: record };
      }
      return {
        status: 'warn',
        summary: policy === 'none' ? 'DMARC only monitors (p=none); spoofed mail is still delivered.' : 'The DMARC record has no valid policy.',
        observed: record,
        impact: { riskReduction: 6 },
      };
    },
  },
];
