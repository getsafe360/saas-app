// components/site-cockpit/cards/wordpress/components/Analysis/SecurityOverview.tsx
"use client";

import { Shield } from "lucide-react";

interface SecurityData {
  defaultLoginExposed: boolean;
  userEnumerationBlocked: boolean;
  xmlrpcEnabled: boolean;
  wpDebugMode: boolean;
}

interface SecurityOverviewProps {
  security: SecurityData;
}

const items = (security: SecurityData) => [
  {
    label: "Login Page",
    healthy: !security.defaultLoginExposed,
    value: security.defaultLoginExposed ? "Exposed" : "Protected",
  },
  {
    label: "User Enumeration",
    healthy: security.userEnumerationBlocked,
    value: security.userEnumerationBlocked ? "Blocked" : "Vulnerable",
  },
  {
    label: "XML-RPC",
    healthy: !security.xmlrpcEnabled,
    value: security.xmlrpcEnabled ? "Enabled" : "Disabled",
  },
  {
    label: "Debug Mode",
    healthy: !security.wpDebugMode,
    value: security.wpDebugMode ? "On" : "Off",
  },
];

export function SecurityOverview({ security }: SecurityOverviewProps) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <h5 className="text-sm font-semibold text-white mb-3">Security Checks</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items(security).map((item) => (
          <div
            key={item.label}
            className="rounded-lg border p-3 flex items-center justify-between"
            style={{
              borderColor: item.healthy
                ? "oklch(from var(--color-success) l c h / 0.35)"
                : "oklch(from var(--color-danger) l c h / 0.35)",
              background: item.healthy
                ? "oklch(from var(--color-success) l c h / 0.08)"
                : "oklch(from var(--color-danger) l c h / 0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <Shield
                className="h-4 w-4"
                style={{ color: item.healthy ? "#34d399" : "#f87171" }}
              />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {item.label}
              </span>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: item.healthy ? "#6ee7b7" : "#fda4af" }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
