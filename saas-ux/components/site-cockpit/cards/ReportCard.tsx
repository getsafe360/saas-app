// components/site-cockpit/cards/ReportCard.tsx
"use client";

import { useState } from "react";
import { FileText, Info, X, CheckCircle, Building2, Clock, DollarSign } from "lucide-react";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";

function ReportInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--header-bg)", border: "1px solid var(--border-default)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--color-primary-500) l c h / 0.12)", color: "var(--color-primary-400, #60a5fa)" }}
            >
              <FileText className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Why generate reports?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--text-subtle)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            The optimization work is valuable — but without documentation, it&apos;s invisible to your clients.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-subtle)" }}>
            Performance Reports let you export a professional audit document from any site analysis in one click.
            Share it with clients, attach it to invoices, or paste it into your project management tool.
            Agencies can white-label the output with their own logo and colors.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
                What&apos;s included
              </div>
              <ul className="space-y-1.5">
                {[
                  "Full site audit snapshot",
                  "Category scores & findings",
                  "Prioritized recommendations",
                  "WordPress health details (if connected)",
                  "PDF or Markdown export",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-subtle)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "oklch(from var(--color-primary-500) l c h / 0.06)",
                border: "1px solid oklch(from var(--color-primary-500) l c h / 0.2)",
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-primary-400, #60a5fa)" }}>
                Agency plan unlocks
              </div>
              <ul className="space-y-1.5">
                {[
                  "Unlimited report generation",
                  "White-label — your logo & colors",
                  "Remove GetSafe 360 AI branding",
                  "Shareable links (coming soon)",
                  "Scheduled monthly reports (coming soon)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle
                      className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      style={{ color: "var(--color-primary-400, #60a5fa)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {([
              {
                icon: <DollarSign className="h-3.5 w-3.5" />,
                title: "Justify billing",
                text: "Send documented work as a deliverable — clients see exactly what was done.",
              },
              {
                icon: <Building2 className="h-3.5 w-3.5" />,
                title: "Look professional",
                text: "White-label reports carry your brand, not ours. Agencies stay front and center.",
              },
              {
                icon: <Clock className="h-3.5 w-3.5" />,
                title: "Save time",
                text: "One click replaces hours of manual report writing every month.",
              },
            ] as const).map(({ icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl p-3"
                style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                    style={{ background: "oklch(from var(--color-primary-500) l c h / 0.10)", color: "var(--color-primary-400, #60a5fa)" }}
                  >
                    {icon}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportCardProps {
  siteId: string;
  siteName: string;
  planName?: "free" | "pro" | "agent" | "agency" | "business";
}

export function ReportCard({ siteId, siteName, planName = "agency" }: ReportCardProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      {showInfoModal && <ReportInfoModal onClose={() => setShowInfoModal(false)} />}

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: "var(--background-subtle, var(--header-bg))",
              color: "var(--text-subtle)",
              border: "1px solid var(--border-default)",
            }}
          >
            <FileText className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
              Performance Reports
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Export client-ready reports — PDF &amp; Markdown with agency white-label.
              </span>
              <button
                onClick={() => setShowInfoModal(true)}
                className="inline-flex items-center gap-1 text-xs transition-colors cursor-pointer hover:opacity-70 shrink-0"
                style={{ color: "var(--text-primary)" }}
                aria-label="Why generate reports?"
              >
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">How it works</span>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              {
                icon: <DollarSign className="h-4 w-4" />,
                title: "Justify billing",
                text: "Send optimization work as a documented deliverable.",
              },
              {
                icon: <Building2 className="h-4 w-4" />,
                title: "White-label ready",
                text: "Agency plan: your logo, your brand, zero GetSafe 360 AI mention.",
              },
              {
                icon: <Clock className="h-4 w-4" />,
                title: "One click",
                text: "Skip manual report writing — export in seconds.",
              },
            ] as const).map(({ icon, title, text }) => (
              <div
                key={title}
                className="flex gap-2.5 rounded-xl p-3"
                style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
              >
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5"
                  style={{ background: "oklch(from var(--color-primary-500) l c h / 0.10)", color: "var(--color-primary-400, #60a5fa)" }}
                >
                  {icon}
                </span>
                <div>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>{text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
              {planName === "free"
                ? "Pro: 5 reports/month · Agency: unlimited + white-label"
                : planName === "pro"
                  ? "5 reports per month included"
                  : "Unlimited reports · White-label enabled"}
            </div>
            <GenerateReportButton siteId={siteId} siteName={siteName} planName={planName} />
          </div>
        </div>
      </div>
    </>
  );
}
