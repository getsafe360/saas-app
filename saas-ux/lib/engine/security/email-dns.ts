// lib/engine/security/email-dns.ts
//
// SPF and DMARC protect the site's domain from being used in spoofed email.
// DKIM is not checked: it needs the sender's selector, which DNS does not reveal.

import { type Rule, unknown } from '../rules';

export interface EmailDnsFacts {
  domain: string | null;
  /** TXT records at the domain starting with v=spf1; null when the lookup failed. */
  spf: string[] | null;
  /** DMARC records that apply (own or inherited); null when the lookup failed. */
  dmarc: string[] | null;
  /** Domain whose _dmarc record applies; differs from `domain` when inherited. */
  dmarcSource: string | null;
}

export interface EmailDnsProbe {
  domain: string;
  spf: string[] | null;
  dmarc: string[] | null;
  dmarcSource: string | null;
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
    dmarcSource: typeof probe?.dmarcSource === 'string' ? probe.dmarcSource : null,
  };
}

function dmarcTag(record: string, tag: string): string | null {
  const match = new RegExp(`(?:^|;)\\s*${tag}\\s*=\\s*([a-z]+)`, 'i').exec(record);
  return match ? match[1].toLowerCase() : null;
}

export const EMAIL_DNS_RULES: ReadonlyArray<Rule<EmailDnsFacts>> = [
  {
    id: 'email-spf',
    category: 'security',
    severity: 'medium',
    source: 'dns',
    fix: { fixerId: 'dns-publish-spf', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ domain, spf }) => {
      if (!domain || spf === null) return unknown('unknown');
      if (spf.length === 0) {
        return {
          status: 'fail',
          message: 'missing',
          values: { domain },
          impact: { riskReduction: 15 },
        };
      }
      if (spf.length > 1) {
        return {
          status: 'fail',
          message: 'multiple',
          values: { domain, count: spf.length },
          observed: spf.join(' | '),
          impact: { riskReduction: 15 },
        };
      }
      const record = spf[0];
      if (/[+?]all\b/i.test(record) || !/[-~]all\b|redirect=/i.test(record)) {
        return {
          status: 'warn',
          message: 'weak',
          observed: record,
          impact: { riskReduction: 8 },
        };
      }
      return { status: 'pass', message: 'valid', observed: record };
    },
  },
  {
    id: 'email-dmarc',
    category: 'security',
    severity: 'medium',
    source: 'dns',
    fix: { fixerId: 'dns-publish-dmarc', automation: 'guided', risk: 'medium', reversible: true },
    evaluate: ({ domain, dmarc, dmarcSource }) => {
      if (!domain || dmarc === null) return unknown('unknown');
      if (dmarc.length === 0) {
        return {
          status: 'fail',
          message: 'missing',
          values: { domain },
          impact: { riskReduction: 12 },
        };
      }
      if (dmarc.length > 1) {
        return {
          status: 'fail',
          message: 'multiple',
          values: { domain: dmarcSource ?? domain, count: dmarc.length },
          observed: dmarc.join(' | '),
          impact: { riskReduction: 12 },
        };
      }
      const record = dmarc[0];
      const inherited = dmarcSource !== null && dmarcSource !== domain;
      // A parent domain's record governs subdomains through sp=, falling back to p=.
      const policy = (inherited ? dmarcTag(record, 'sp') : null) ?? dmarcTag(record, 'p');
      const source = { inherited: inherited ? 'yes' : 'no', source: dmarcSource ?? '' };
      if (policy === 'quarantine' || policy === 'reject') {
        return { status: 'pass', message: 'enforced', values: { ...source, policy }, observed: record };
      }
      return {
        status: 'warn',
        message: policy === 'none' ? 'monitoring' : 'invalid',
        values: source,
        observed: record,
        impact: { riskReduction: 6 },
      };
    },
  },
];
