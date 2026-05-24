// components/site-cockpit/cards/wordpress/components/EmptyStates/NotConnected.tsx
"use client";

import type { UseWordPressPairingReturn } from "../../types";

interface NotConnectedProps {
  pairing: UseWordPressPairingReturn;
  version?: string;
}

export function NotConnected({ version }: NotConnectedProps) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
    >
      <div className="text-sm mb-1" style={{ color: "var(--text-subtle)" }}>WordPress Version</div>
      <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {version || "Unknown"}
      </div>
      <div className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
        Deep analysis available after connecting via the Site Connection card above.
      </div>
    </div>
  );
}
