// components/site-cockpit/cards/optimization/index.ts

// Main component
export { OptimizationCard } from "./OptimizationCard";

// Types
export type {
  OptimizationType,
  OptimizationStatus,
  ImpactLevel,
  EffortLevel,
  PerformanceMetrics,
  OptimizationComparison,
  Savings,
  QuickWin,
  BackupMethod,
  BackupInfo,
  BackupSystem,
  ConnectionMethod,
  ConnectionInfo,
  OptimizationHistoryEntry,
  OptimizationCardProps,
  BeforeAfterComparisonProps,
  SavingsDisplayProps,
  QuickWinCardProps,
  PerformanceTimelineProps,
  BackupButtonProps,
  UseOptimizationDataReturn,
  UseBackupSystemReturn,
} from "./types";

// Hooks
export { useOptimizationData } from "./hooks/useOptimizationData";
export { useBackupSystem } from "./hooks/useBackupSystem";

// Components - Summary
export { BeforeAfterComparison } from "./components/Summary/BeforeAfterComparison";
export { SavingsDisplay } from "./components/Summary/SavingsDisplay";

// Components - QuickWins
export { QuickWinCard } from "./components/QuickWins/QuickWinCard";

// Components - Backup
export { BackupButton } from "./components/Backup/BackupButton";

// Components - Charts
export { PerformanceChart } from "./components/Charts/PerformanceChart";

// Utils
export * from "./utils/calculations";