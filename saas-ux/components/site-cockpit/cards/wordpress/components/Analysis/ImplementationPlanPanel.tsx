// components/site-cockpit/cards/wordpress/components/Analysis/ImplementationPlanPanel.tsx
"use client";

export function ImplementationPlanPanel() {
  const steps = [
    "Extend WordPress telemetry mapping for Security, Performance, Stability, SEO/UX, and Red Flags.",
    "Normalize findings into a typed model with severity and default fix-selection logic.",
    "Expose findings in WordPressCard with prechecked critical/high actions.",
    "Wire selected actions to batch remediation APIs and audit logs.",
    "Add scoring weights by category and trend tracking for follow-up scans.",
  ];

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
    >
      <h5 className="text-sm font-semibold text-white mb-3">Implementation Plan</h5>
      <ol className="space-y-2 list-decimal ml-4">
        {steps.map((step) => (
          <li key={step} className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
