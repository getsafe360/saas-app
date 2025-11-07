// components/analyzer/cms/types.ts

import type { CMSType, CMSInfo } from '../types';

export type { CMSType, CMSInfo };

export type CMSSignature = {
  type: CMSType;
  indicators: {
    headers?: string[];
    meta?: string[];
    paths?: string[];
    scripts?: string[];
    cookies?: string[];
  };
  checks: (facts: any) => boolean;
  confidence?: number;
};

export type CMSVulnerability = {
  type: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cve?: string;
  affectedVersions?: string;
  fixedIn?: string;
  recommendation: string;
};

export type CMSHealth = {
  isUpToDate: boolean;
  latestVersion?: string;
  currentVersion?: string;
  vulnerabilities: CMSVulnerability[];
  securityIssues: string[];
  performanceIssues: string[];
  recommendations: string[];
};