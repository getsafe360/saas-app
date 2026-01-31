// components/reports/GenerateReportButton.tsx
"use client";

import { useState } from "react";
import { FileText, Download, Loader2, Crown } from "lucide-react";
import { ReportOptionsModal } from "./ReportOptionsModal";
import type { ReportFormat, ReportScope } from "@/lib/db/schema/reports/generated";

interface GenerateReportButtonProps {
  siteId: string;
  siteName: string;
  disabled?: boolean;
  planName?: "free" | "pro" | "agency";
  onReportGenerated?: (report: {
    id: string;
    downloadUrl: string;
    format: ReportFormat;
  }) => void;
}

export function GenerateReportButton({
  siteId,
  siteName,
  disabled = false,
  planName = "free",
  onReportGenerated,
}: GenerateReportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAgencyPlan = planName === "agency";

  const handleGenerateReport = async (options: {
    format: ReportFormat;
    scope: ReportScope;
    title?: string;
  }) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${siteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.upgradeRequired) {
          setError("Report generation requires Agency plan");
          return;
        }
        throw new Error(data.error || "Failed to generate report");
      }

      // Success - close modal and trigger callback
      setIsModalOpen(false);
      if (onReportGenerated && data.report) {
        onReportGenerated({
          id: data.report.id,
          downloadUrl: data.report.downloadUrl,
          format: data.report.format,
        });
      }

      // Auto-download the report
      if (data.report?.downloadUrl) {
        const link = document.createElement("a");
        link.href = data.report.downloadUrl;
        link.download = data.report.filename || "report";
        link.click();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Non-Agency users see upgrade CTA
  if (!isAgencyPlan) {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 hover:from-amber-500/30 hover:to-orange-500/30 transition-all"
      >
        <Crown className="h-4 w-4" />
        <span className="text-sm font-medium">Generate Report</span>
        <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded">
          Agency
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled || isGenerating}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            <span>Generate Report</span>
          </>
        )}
      </button>

      <ReportOptionsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
        }}
        siteName={siteName}
        isGenerating={isGenerating}
        error={error}
        onGenerate={handleGenerateReport}
        isAgencyPlan={isAgencyPlan}
      />
    </>
  );
}
