export type CockpitEventType = 'status' | 'progress' | 'category' | 'repair' | 'savings' | 'error';

export type CockpitStateValue =
  | 'idle'
  | 'connecting'
  | 'in_progress'
  | 'completed'
  | 'errors_found'
  | 'repairing'
  | 'repaired'
  | 'disconnected';

export interface CockpitCategory {
  id: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  issues?: Array<Record<string, unknown>>;
  tokenCost?: number;
  fixAvailable?: boolean;
}

export interface CockpitSavings {
  score_before: number;
  score_after: number;
  time_saved: string;
  cost_saved: string;
  tokens_used: number;
}

export interface CockpitEvent {
  type: CockpitEventType;
  state?: CockpitStateValue;
  category?: string;
  progress?: number;
  issues?: Array<Record<string, unknown>>;
  savings?: Partial<CockpitSavings>;
  message?: string;
  platform?: 'wordpress' | 'generic';
  revision?: number;
  timestamp?: string;
  hash?: string;
}
