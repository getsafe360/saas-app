// components/reports/ReportOptionsModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Code2,
  Loader2,
  AlertCircle,
  Crown,
  ArrowRight,
  Calendar,
  Share2,
  Lock,
  CheckCircle,
} from "lucide-react";
import type { ReportFormat, ReportScope, ReportStatus } from "@/lib/db/schema/reports/generated";

interface GeneratedReportListItem {
  id: string;
  format: ReportFormat;
  scope: ReportScope;
  status: ReportStatus;
  title: string;
  filename: string;
  downloadUrl?: string | null;
  createdAt: string;
}

interface ReportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteName: string;
  isGenerating: boolean;
  error: string | null;
  onGenerate: (options: {
    format: ReportFormat;
    scope: ReportScope;
    title?: string;
    whiteLabel?: boolean;
  }) => void;
  isAgencyPlan: boolean;
  isProPlan?: boolean;
  proReportsUsed?: number;
  proReportsLimit?: number;
  reportHistory?: GeneratedReportListItem[];
  isHistoryLoading?: boolean;
}

// PDF + Markdown only — HTML removed, CSV replaced with MD
const FORMAT_OPTIONS: {
  value: ReportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    value: "pdf",
    label: "PDF Document",
    description: "Polished client deliverable",
    icon: FileText,
  },
  {
    value: "markdown",
    label: "Markdown",
    description: "Developer-friendly — paste into Notion, GitHub, Jira",
    icon: Code2,
  },
];

function SoonBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
      style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}
    >
      <Lock className="h-2 w-2" />
      Soon
    </span>
  );
}

export function ReportOptionsModal({
  isOpen,
  onClose,
  siteName,
  isGenerating,
  error,
  onGenerate,
  isAgencyPlan,
  isProPlan = false,
  proReportsUsed = 0,
  proReportsLimit = 5,
  reportHistory = [],
  isHistoryLoading = false,
}: ReportOptionsModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("pdf");
  const [customTitle, setCustomTitle] = useState("");
  const [whiteLabel, setWhiteLabel] = useState(isAgencyPlan);

  const canGenerate = isAgencyPlan || (isProPlan && proReportsUsed < proReportsLimit);
  const proQuotaExhausted = isProPlan && !isAgencyPlan && proReportsUsed >= proReportsLimit;

  useEffect(() => {
    if (isOpen) {
      setSelectedFormat("pdf");
      setCustomTitle("");
      setWhiteLabel(isAgencyPlan);
    }
  }, [isOpen, isAgencyPlan]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onGenerate({
      format: selectedFormat,
      scope: "full", // Always full report of current analysis
      title: customTitle || undefined,
      whiteLabel,
    });
  };

  // Upgrade CTA for free plan users
  if (!canGenerate && !proQuotaExhausted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-800 transition-colors z-10">
            <X className="h-5 w-5 text-gray-400" />
          </button>
          <div className="p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Unlock Report Generation</h2>
            <p className="text-gray-400 mb-6">
              Generate professional reports for your clients — PDF &amp; Markdown export included.
            </p>
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Pro plan</h3>
                  <ul className="space-y-1.5 text-sm text-gray-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      5 reports / month — PDF &amp; Markdown
                    </li>
                  </ul>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <h3 className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">Agency plan</h3>
                  <ul className="space-y-1.5 text-sm text-gray-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      Unlimited reports
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      White-label (your logo &amp; colors)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 w-full justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              View plans
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Generate Report</h2>
            <p className="text-sm text-gray-400">{siteName}</p>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-1 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Pro quota warning */}
          {proQuotaExhausted && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <div className="text-sm">
                Monthly quota reached ({proReportsUsed}/{proReportsLimit} reports used).{" "}
                <a href="/pricing" className="underline">Upgrade to Agency</a> for unlimited reports.
              </div>
            </div>
          )}

          {/* Pro quota indicator */}
          {isProPlan && !isAgencyPlan && !proQuotaExhausted && (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-gray-400">Monthly reports</span>
              <span className="text-gray-300 font-medium">{proReportsUsed} / {proReportsLimit} used</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((format) => {
                const Icon = format.icon;
                const isSelected = selectedFormat === format.value;
                return (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value)}
                    disabled={isGenerating || proQuotaExhausted}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-blue-400" : "text-gray-400"}`} />
                      <span className={`text-xs font-semibold ${isSelected ? "text-blue-300" : "text-gray-300"}`}>
                        {format.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{format.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* White-label toggle — Agency only */}
          {isAgencyPlan && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-white font-medium">Agency White-label</div>
                  <div className="text-xs text-gray-500">Remove GetSafe 360 AI branding from the report.</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={whiteLabel}
                  onClick={() => setWhiteLabel((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${whiteLabel ? "bg-emerald-500" : "bg-gray-600"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${whiteLabel ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          )}

          {/* Coming Soon — Report Sharing */}
          <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-400 font-medium flex items-center gap-2">
                    Shareable Report Link
                    <SoonBadge />
                  </div>
                  <div className="text-xs text-gray-600">Public URL — accessible without login for 30 days</div>
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon — Scheduled Reports */}
          <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-400 font-medium flex items-center gap-2">
                    Scheduled Reports
                    <SoonBadge />
                  </div>
                  <div className="text-xs text-gray-600">Auto-generate &amp; email monthly reports to clients</div>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Reports */}
          {reportHistory.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Previous Reports</label>
              <div className="max-h-36 overflow-auto rounded-lg border border-gray-700 bg-gray-800/40">
                <ul className="divide-y divide-gray-700/60">
                  {reportHistory.slice(0, 8).map((report) => (
                    <li key={report.id} className="p-3 text-xs text-gray-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{report.title}</div>
                        <div className="text-gray-500">
                          {report.format.toUpperCase()} · {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {report.downloadUrl ? (
                        <a href={report.downloadUrl} className="text-blue-400 hover:text-blue-300 shrink-0" target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        <span className="text-gray-500 shrink-0">{report.status}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Custom Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Title <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., Q2 2026 Site Audit"
              disabled={isGenerating || proQuotaExhausted}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isGenerating || proQuotaExhausted}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
            ) : (
              <><FileText className="h-4 w-4" />Generate Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
