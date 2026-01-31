// components/site-cockpit/cards/optimization/types.ts

import type { SiteCockpitResponse } from "@/types/site-cockpit";

// Optimization Categories
export type OptimizationType = 
  | "images"
  | "caching"
  | "compression"
  | "minification"
  | "security-headers"
  | "database"
  | "lazy-loading"
  | "cdn";

export type OptimizationStatus = 
  | "pending"
  | "backing-up"
  | "optimizing"
  | "completed"
  | "failed"
  | "rolled-back";

export type ImpactLevel = "high" | "medium" | "low";
export type EffortLevel = "easy" | "moderate" | "complex";

// Before/After Metrics
export interface PerformanceMetrics {
  score: number;
  grade: string;
  pageWeight: number; // bytes
  requests: number;
  loadTime: number; // seconds
  ttfb: number; // time to first byte
}

export interface OptimizationComparison {
  before: PerformanceMetrics;
  after: PerformanceMetrics;
  potential: PerformanceMetrics; // Estimated after all optimizations
}

// Savings Calculation
export interface Savings {
  pageWeight: {
    absolute: number; // bytes saved
    percentage: number;
    display: string; // "68.4 KB"
  };
  requests: {
    absolute: number;
    percentage: number;
  };
  loadTime: {
    absolute: number; // seconds saved
    percentage: number;
    display: string; // "1.2s"
  };
  bandwidth: {
    monthly: string; // "2.7 GB/month"
    cost?: string; // "$12.50/month" (optional)
  };
}

// Quick Win Item
export interface QuickWin {
  id: string;
  type: OptimizationType;
  title: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  
  current: {
    value: string;
    metric?: string;
    size?: number; // bytes
  };
  
  optimized: {
    value: string;
    metric?: string;
    size?: number; // bytes
  };
  
  savings: {
    percentage: number;
    absolute: string;
    timeImpact?: string; // "0.8s faster"
  };
  
  status: OptimizationStatus;
  requiresBackup: boolean;
  risks: string[];
  
  estimatedTime?: number; // seconds
  compatibility?: {
    wordpress: boolean;
    static: boolean;
    requiresFTP?: boolean;
    requiresSSH?: boolean;
  };
}

// Backup System
export type BackupMethod = "wordpress-plugin" | "checkpoint" | "ftp" | "ssh";

export interface BackupInfo {
  id: string;
  timestamp: Date;
  method: BackupMethod;
  size?: number;
  includes: ("database" | "files" | "plugins" | "themes" | "uploads")[];
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface BackupSystem {
  available: boolean;
  method: BackupMethod;
  plugin?: {
    name: string;
    installed: boolean;
    version?: string;
  };
  lastBackup?: BackupInfo;
  autoBackup: boolean;
}

// Connection Methods
export type ConnectionMethod = "wordpress" | "ftp" | "ssh" | "none";

export interface ConnectionInfo {
  method: ConnectionMethod;
  status: "connected" | "disconnected" | "error";
  
  wordpress?: {
    siteId: string;
    pluginVersion: string;
  };
  
  ftp?: {
    host: string;
    port: number;
    username: string;
    secure: boolean; // SFTP or not
  };
  
  ssh?: {
    host: string;
    port: number;
    username: string;
    keyBased: boolean;
  };
}

// Optimization History
export interface OptimizationHistoryEntry {
  id: string;
  timestamp: Date;
  type: OptimizationType;
  status: OptimizationStatus;
  before: PerformanceMetrics;
  after: PerformanceMetrics;
  backupId?: string;
  error?: string;
}

// Component Props
export interface OptimizationCardProps {
  id: string;
  data: SiteCockpitResponse;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
  siteId?: string;
  siteName?: string;
  planName?: "free" | "pro" | "agency";
  connection?: ConnectionInfo;
}

export interface BeforeAfterComparisonProps {
  comparison: OptimizationComparison;
  animated?: boolean;
}

export interface SavingsDisplayProps {
  savings: Savings;
  monthlyVisits?: number;
}

export interface QuickWinCardProps {
  quickWin: QuickWin;
  siteId: string;
  connection: ConnectionInfo;
  backupSystem: BackupSystem;
  onOptimize: (id: string) => Promise<void>;
  onBackup: () => Promise<BackupInfo>;
}

export interface PerformanceTimelineProps {
  history: OptimizationHistoryEntry[];
  current: PerformanceMetrics;
}

export interface BackupButtonProps {
  backupSystem: BackupSystem;
  siteId: string;
  connection: ConnectionInfo;
  onBackupCreated?: (backup: BackupInfo) => void;
}

// Hook Return Types
export interface UseOptimizationDataReturn {
  comparison: OptimizationComparison;
  savings: Savings;
  quickWins: QuickWin[];
  history: OptimizationHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseBackupSystemReturn {
  backupSystem: BackupSystem;
  isBackingUp: boolean;
  createBackup: () => Promise<BackupInfo>;
  restoreBackup: (backupId: string) => Promise<void>;
  checkBackupPlugin: () => Promise<boolean>;
  installBackupPlugin: () => Promise<boolean>;
}

export interface UseOptimizationActionsReturn {
  optimize: (quickWinId: string) => Promise<void>;
  rollback: (historyId: string) => Promise<void>;
  isOptimizing: boolean;
  currentOperation: OptimizationType | null;
  progress: number; // 0-100
}