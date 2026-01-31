// components/reports/ReportOptionsModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  Globe,
  Zap,
  Shield,
  Search,
  Accessibility,
  Loader2,
  AlertCircle,
  Crown,
  ArrowRight,
} from "lucide-react";
import type { ReportFormat, ReportScope } from "@/lib/db/schema/reports/generated";

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
  }) => void;
  isAgencyPlan: boolean;
}

const FORMAT_OPTIONS: {
  value: ReportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    value: "pdf",
    label: "PDF Document",
    description: "Professional report for clients",
    icon: FileText,
  },
  {
    value: "csv",
    label: "CSV Spreadsheet",
    description: "Data export for analysis",
    icon: FileSpreadsheet,
  },
  {
    value: "html",
    label: "HTML Page",
    description: "Shareable web link",
    icon: Globe,
  },
];

const SCOPE_OPTIONS: {
  value: ReportScope;
  label: string;
  description: string;
  icon: typeof Zap;
}[] = [
  {
    value: "performance",
    label: "Performance",
    description: "Speed, Core Web Vitals, optimization",
    icon: Zap,
  },
  {
    value: "security",
    label: "Security",
    description: "HTTPS, headers, vulnerabilities",
    icon: Shield,
  },
  {
    value: "seo",
    label: "SEO",
    description: "Meta tags, structure, rankings",
    icon: Search,
  },
  {
    value: "accessibility",
    label: "Accessibility",
    description: "WCAG compliance, screen readers",
    icon: Accessibility,
  },
  {
    value: "full",
    label: "Full Report",
    description: "All categories combined",
    icon: FileText,
  },
];

export function ReportOptionsModal({
  isOpen,
  onClose,
  siteName,
  isGenerating,
  error,
  onGenerate,
  isAgencyPlan,
}: ReportOptionsModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("pdf");
  const [selectedScope, setSelectedScope] = useState<ReportScope>("performance");
  const [customTitle, setCustomTitle] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFormat("pdf");
      setSelectedScope("performance");
      setCustomTitle("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onGenerate({
      format: selectedFormat,
      scope: selectedScope,
      title: customTitle || undefined,
    });
  };

  // Upgrade CTA for non-Agency plans
  if (!isAgencyPlan) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-800 transition-colors z-10"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>

          {/* Content */}
          <div className="p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-amber-400" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Upgrade to Agency Plan
            </h2>

            <p className="text-gray-400 mb-6">
              Generate professional white-label reports for your clients with
              PDF, CSV, and HTML export options.
            </p>

            <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-semibold text-amber-400 mb-3">
                Agency Plan includes:
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  PDF, CSV, HTML report generation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  White-label branding (your logo & colors)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  Client-ready professional reports
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  300,000 tokens/month (~150 AI fixes)
                </li>
              </ul>
            </div>

            <a
              href="/pricing"
              className="inline-flex items-center gap-2 w-full justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              Upgrade to Agency
              <ArrowRight className="h-4 w-4" />
            </a>

            <p className="text-sm text-gray-500 mt-4">Starting at €49/month</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Generate Report</h2>
            <p className="text-sm text-gray-400">{siteName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((format) => {
                const Icon = format.icon;
                const isSelected = selectedFormat === format.value;

                return (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value)}
                    disabled={isGenerating}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                    } disabled:opacity-50`}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">{format.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Report Scope
            </label>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((scope) => {
                const Icon = scope.icon;
                const isSelected = selectedScope === scope.value;

                return (
                  <button
                    key={scope.value}
                    onClick={() => setSelectedScope(scope.value)}
                    disabled={isGenerating}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    } disabled:opacity-50`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? "bg-blue-500/20" : "bg-gray-700/50"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isSelected ? "text-blue-400" : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${
                          isSelected ? "text-blue-400" : "text-gray-300"
                        }`}
                      >
                        {scope.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {scope.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Title (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Title{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., Q1 2026 Performance Audit"
              disabled={isGenerating}
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
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
