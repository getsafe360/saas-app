// components/site-cockpit/cards/optimization/components/Summary/SavingsDisplay.tsx
"use client";

import { DollarSign, TrendingDown, Zap, Server } from "lucide-react";
import type { SavingsDisplayProps } from "../../types";

export function SavingsDisplay({
  savings,
  monthlyVisits = 10000,
}: SavingsDisplayProps) {
  return (
    <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-6 w-6 text-green-400" />
        <h3 className="text-lg font-semibold text-white">Estimated Savings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Page Weight Saved */}
        <SavingMetric
          icon={<TrendingDown className="h-5 w-5 text-blue-400" />}
          label="Data Saved"
          value={savings.pageWeight.display}
          subtext={`${savings.pageWeight.percentage.toFixed(0)}% smaller`}
          color="blue"
        />

        {/* Requests Reduced */}
        <SavingMetric
          icon={<Zap className="h-5 w-5 text-purple-400" />}
          label="Requests Reduced"
          value={savings.requests.absolute.toString()}
          subtext={`${savings.requests.percentage.toFixed(0)}% fewer`}
          color="purple"
        />

        {/* Load Time Saved */}
        <SavingMetric
          icon={<Zap className="h-5 w-5 text-orange-400" />}
          label="Time Saved"
          value={savings.loadTime.display}
          subtext={`${savings.loadTime.percentage.toFixed(0)}% faster`}
          color="orange"
        />

        {/* Bandwidth Saved */}
        <SavingMetric
          icon={<Server className="h-5 w-5 text-green-400" />}
          label="Monthly Bandwidth"
          value={savings.bandwidth.monthly}
          subtext={savings.bandwidth.cost || "Estimated savings"}
          color="green"
        />
      </div>

      {/* Additional Info */}
      <div className="mt-4 pt-4 border-t border-green-500/20">
        <div className="flex items-start gap-2 text-sm text-gray-400">
          <span className="text-green-400">ℹ️</span>
          <p>
            Based on {monthlyVisits.toLocaleString()} monthly visits. Actual
            savings may vary depending on traffic patterns and user behavior.
          </p>
        </div>
      </div>
    </div>
  );
}

interface SavingMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: "blue" | "purple" | "orange" | "green";
}

function SavingMetric({
  icon,
  label,
  value,
  subtext,
  color,
}: SavingMetricProps) {
  const colorClasses = {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      text: "text-purple-400",
    },
    orange: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      text: "text-orange-400",
    },
    green: {
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      text: "text-green-400",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`p-4 rounded-lg ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colors.text} mb-1`}>{value}</div>
      <div className="text-xs text-gray-500">{subtext}</div>
    </div>
  );
}
