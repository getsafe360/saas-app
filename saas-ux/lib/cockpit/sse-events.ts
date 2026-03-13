export type CockpitEventType = 'status' | 'progress' | 'category' | 'repair' | 'savings' | 'summary' | 'greeting' | 'error' | 'debug';

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
  greeting?: string;
  platform?: 'wordpress' | 'generic';
  revision?: number;
  timestamp?: string;
  hash?: string;
}

export function mapBackendEvent(
  testId: string,
  eventName: string,
  payload: Record<string, unknown>,
): CockpitEvent | null {
  const normalizedType = String(payload.type ?? eventName ?? '').toLowerCase();

  if (normalizedType === 'log') {
    return { type: 'debug', message: String(payload.message ?? 'backend log') };
  }

  if (normalizedType === 'result') {
    return {
      type: 'summary',
      message: String(payload.summary ?? payload.short_summary ?? 'Analysis complete'),
      greeting: typeof payload.greeting === 'string' ? payload.greeting : undefined,
    };
  }

  if (normalizedType === 'done') {
    return { type: 'status', state: 'completed', message: 'done' };
  }

  if (normalizedType === 'started') {
    return { type: 'status', state: 'in_progress', message: 'started' };
  }

  if (normalizedType === 'progress') {
    return {
      type: 'progress',
      state: 'in_progress',
      progress: Number(payload.progress ?? 0),
      message: typeof payload.message === 'string' ? payload.message : undefined,
    };
  }

  if (normalizedType === 'error') {
    return { type: 'error', message: String(payload.message ?? 'Backend error') };
  }

  if (normalizedType === 'status') {
    const statusValue = String(payload.status ?? payload.message ?? '').toLowerCase();
    if (statusValue === 'done' || statusValue === 'completed') {
      return { type: 'status', state: 'completed', message: 'done' };
    }
    return { type: 'status', state: 'in_progress', message: statusValue || 'started' };
  }

  if (normalizedType === 'debug') {
    return { type: 'debug', message: String(payload.message ?? 'debug event') };
  }

  if (normalizedType === 'greeting') {
    return { type: 'greeting', message: String(payload.greeting ?? payload.message ?? '') };
  }

  if (normalizedType === 'summary') {
    return { type: 'summary', message: String(payload.summary ?? payload.message ?? '') };
  }

  console.debug(`[cockpit-sse] dropped unknown backend event testId=${testId} event=${eventName}`);
  return null;
}
