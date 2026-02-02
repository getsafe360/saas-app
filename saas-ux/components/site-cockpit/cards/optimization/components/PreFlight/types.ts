// components/site-cockpit/cards/optimization/components/PreFlight/types.ts

export type CheckStatus = 'pending' | 'running' | 'success' | 'warning' | 'error';

export interface PreFlightCheck {
  id: string;
  label: string;
  description?: string;
  status: CheckStatus;
  message?: string;
  duration?: number; // ms
}

export interface PreFlightResult {
  checks: PreFlightCheck[];
  canProceed: boolean;
  warnings: string[];
  errors: string[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

export interface PreFlightConfig {
  siteId: string;
  connectionType: 'wordpress' | 'static' | 'none';
  selectedPages?: string[];
  optimizationTypes?: string[];
}

export interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: PreFlightResult) => void;
  onProceed: () => void;
  config: PreFlightConfig;
}

// Default checks to run
export const DEFAULT_CHECKS: Omit<PreFlightCheck, 'status'>[] = [
  {
    id: 'connection',
    label: 'Verifying site connection',
    description: 'Checking if we can reach your site',
  },
  {
    id: 'wordpress',
    label: 'Checking WordPress status',
    description: 'Verifying plugin is active and responsive',
  },
  {
    id: 'backup',
    label: 'Checking backup status',
    description: 'Looking for recent backups',
  },
  {
    id: 'analysis',
    label: 'Analyzing optimization targets',
    description: 'Scanning pages for optimization opportunities',
  },
  {
    id: 'compatibility',
    label: 'Checking compatibility',
    description: 'Ensuring optimizations are safe to apply',
  },
  {
    id: 'queue',
    label: 'Preparing optimization queue',
    description: 'Setting up the optimization pipeline',
  },
];
