// components/site-cockpit/cards/wordpress/components/Analysis/SecurityOverview.tsx
"use client";

import { Shield } from "lucide-react";

/** null = not observed yet; rendered as "Unknown", never as healthy or failing. */
interface SecurityData {
  defaultLoginExposed: boolean | null;
  userEnumerationBlocked: boolean | null;
  xmlrpcEnabled: boolean | null;
  wpDebugMode: boolean | null;
}

type ItemState = "healthy" | "risk" | "unknown";

function stateOf(observed: boolean | null, healthyWhen: boolean): ItemState {
  if (observed === null) return "unknown";
  return observed === healthyWhen ? "healthy" : "risk";
}

const STATE_STYLE: Record<ItemState, { border: string; bg: string; icon: string; text: string }> = {
  healthy: {
    border: "oklch(from var(--color-success) l c h / 0.35)",
    bg: "oklch(from var(--color-success) l c h / 0.08)",
    icon: "#34d399",
    text: "#6ee7b7",
  },
  risk: {
    border: "oklch(from var(--color-danger) l c h / 0.35)",
    bg: "oklch(from var(--color-danger) l c h / 0.08)",
    icon: "#f87171",
    text: "#fda4af",
  },
  unknown: {
    border: "var(--border-default)",
    bg: "transparent",
    icon: "var(--text-subtle)",
    text: "var(--text-subtle)",
  },
};

interface SecurityOverviewProps {
  security: SecurityData;
}

const items = (security: SecurityData) => {
  const login = stateOf(security.defaultLoginExposed, false);
  const enumeration = stateOf(security.userEnumerationBlocked, true);
  const xmlrpc = stateOf(security.xmlrpcEnabled, false);
  const debug = stateOf(security.wpDebugMode, false);
  return [
    { label: "Login Page", state: login, value: login === "unknown" ? "Unknown" : login === "healthy" ? "Protected" : "Exposed" },
    { label: "User Enumeration", state: enumeration, value: enumeration === "unknown" ? "Unknown" : enumeration === "healthy" ? "Blocked" : "Vulnerable" },
    { label: "XML-RPC", state: xmlrpc, value: xmlrpc === "unknown" ? "Unknown" : xmlrpc === "healthy" ? "Disabled" : "Enabled" },
    { label: "Debug Mode", state: debug, value: debug === "unknown" ? "Unknown" : debug === "healthy" ? "Off" : "On" },
  ];
};

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
              borderColor: STATE_STYLE[item.state].border,
              background: STATE_STYLE[item.state].bg,
            }}
          >
            <div className="flex items-center gap-2">
              <Shield
                className="h-4 w-4"
                style={{ color: STATE_STYLE[item.state].icon }}
              />
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {item.label}
              </span>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: STATE_STYLE[item.state].text }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
