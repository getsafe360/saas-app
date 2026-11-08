// components/site-cockpit/cards/wordpress/components/Analysis/SecurityOverview.tsx
"use client";

import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";

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

/** Label key, then value keys for healthy / at-risk (wordpress.security.*). */
const ITEMS = [
  { field: "defaultLoginExposed", healthyWhen: false, label: "loginPage", healthy: "protected", risk: "exposed" },
  { field: "userEnumerationBlocked", healthyWhen: true, label: "userEnum", healthy: "blocked", risk: "vulnerable" },
  { field: "xmlrpcEnabled", healthyWhen: false, label: "xmlrpc", healthy: "disabled", risk: "enabled" },
  { field: "wpDebugMode", healthyWhen: false, label: "debugMode", healthy: "off", risk: "on" },
] as const;

export function SecurityOverview({ security }: SecurityOverviewProps) {
  const t = useTranslations("SiteCockpit");
  const items = ITEMS.map((item) => {
    const state = stateOf(security[item.field], item.healthyWhen);
    return {
      label: t(`wordpress.security.${item.label}`),
      state,
      value:
        state === "unknown"
          ? t("common.unknown")
          : t(`wordpress.security.${state === "healthy" ? item.healthy : item.risk}`),
    };
  });

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <h5 className="text-sm font-semibold text-white mb-3">{t("wordpress.security.checksTitle")}</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
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
