// components/site-cockpit/cards/wordpress/components/Analysis/SecurityOverview.tsx
"use client";

import { Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SecurityData {
  defaultLoginExposed: boolean;
  userEnumerationBlocked: boolean;
  xmlrpcEnabled: boolean;
  wpDebugMode: boolean;
}

interface SecurityOverviewProps {
  security: SecurityData;
}

export function SecurityOverview({ security }: SecurityOverviewProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <SecurityMetric
        label="Login Page"
        icon={Shield}
        status={!security.defaultLoginExposed}
        value={security.defaultLoginExposed ? "Exposed" : "Protected"}
      />
      <SecurityMetric
        label="User Enum"
        icon={Shield}
        status={security.userEnumerationBlocked}
        value={security.userEnumerationBlocked ? "Blocked" : "Vulnerable"}
      />
      <SecurityMetric
        label="XML-RPC"
        icon={Shield}
        status={!security.xmlrpcEnabled}
        value={security.xmlrpcEnabled ? "Enabled" : "Disabled"}
      />
      <SecurityMetric
        label="Debug Mode"
        icon={Shield}
        status={!security.wpDebugMode}
        value={security.wpDebugMode ? "On" : "Off"}
      />
    </div>
  );
}

// Security Metric Component
interface SecurityMetricProps {
  label: string;
  icon: LucideIcon;
  status: boolean;
  value: string;
}

function SecurityMetric({
  label,
  icon: Icon,
  status,
  value,
}: SecurityMetricProps) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        status
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon
          className={`h-4 w-4 ${status ? "text-green-400" : "text-red-400"}`}
        />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div
        className={`text-sm font-semibold ${
          status ? "text-green-400" : "text-red-400"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
