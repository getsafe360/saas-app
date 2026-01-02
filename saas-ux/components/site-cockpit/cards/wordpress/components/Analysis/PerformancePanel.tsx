// components/site-cockpit/cards/wordpress/components/Analysis/PerformancePanel.tsx
"use client";

import { CheckCircle, AlertTriangle } from "lucide-react";

interface PerformanceData {
  objectCache: boolean;
  opcacheEnabled: boolean;
  gzipEnabled: boolean;
  lazyLoadEnabled: boolean;
}

interface PerformancePanelProps {
  performance: PerformanceData;
}

export function PerformancePanel({ performance }: PerformancePanelProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PerformanceMetric
        label="Object Cache"
        value={performance.objectCache}
        recommendation={
          !performance.objectCache ? "Enable for 40% speed boost" : undefined
        }
      />
      <PerformanceMetric label="OPcache" value={performance.opcacheEnabled} />
      <PerformanceMetric
        label="Gzip Compression"
        value={performance.gzipEnabled}
      />
      <PerformanceMetric
        label="Lazy Loading"
        value={performance.lazyLoadEnabled}
      />
    </div>
  );
}

// Performance Metric Component
interface PerformanceMetricProps {
  label: string;
  value: boolean;
  recommendation?: string;
}

function PerformanceMetric({
  label,
  value,
  recommendation,
}: PerformanceMetricProps) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        value
          ? "bg-green-500/5 border-green-500/20"
          : "bg-orange-500/5 border-orange-500/20"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {value ? (
          <CheckCircle className="h-4 w-4 text-green-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-orange-400" />
        )}
      </div>
      <div
        className={`text-sm font-semibold ${
          value ? "text-green-400" : "text-orange-400"
        }`}
      >
        {value ? "Enabled" : "Disabled"}
      </div>
      {recommendation && (
        <div className="text-xs text-gray-500 mt-1">{recommendation}</div>
      )}
    </div>
  );
}
