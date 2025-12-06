// components/analyzer/findings/types.ts
import type { Finding, Severity, Pillar, PillarScore } from '../types';
export type { Finding, Severity, Pillar };

// PillarColumn component props
export type PillarColumnProps = {
  label: string;
  score?: PillarScore;
  items: Finding[];
  onFixItem?: (finding: Finding) => void;
  isCollapsed?: boolean;
};

// Extended finding display types
export type FindingCardProps = {
  finding: Finding;
  onFix?: (finding: Finding) => void;
  onDismiss?: (finding: Finding) => void;
  isExpanded?: boolean;
};

export type FindingGroup = {
  pillar: Pillar;
  findings: Finding[];
  criticalCount: number;
  warningCount: number;
  minorCount: number;
};

export type FindingFilter = {
  pillars: Pillar[];
  severities: Severity[];
  searchQuery?: string;
};

export type FindingSortOption = 
  | 'severity-desc' 
  | 'severity-asc' 
  | 'pillar' 
  | 'title';