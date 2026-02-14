// components/site-cockpit/cards/optimization/OptimizationCard.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CockpitCard } from "../CockpitCard";
import { Zap, Loader2 } from "lucide-react";
import { useOptimizationData } from "./hooks/useOptimizationData";
import { useBackupSystem } from "./hooks/useBackupSystem";
import { BeforeAfterComparison } from "./components/Summary/BeforeAfterComparison";
import { SavingsDisplay } from "./components/Summary/SavingsDisplay";
import { BackupButton } from "./components/Backup/BackupButton";
import { PerformanceChart } from "./components/Charts/PerformanceChart";
import { PreFlightCheckModal } from "./components/PreFlight";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import type { OptimizationCardProps, ConnectionInfo, BackupInfo } from "./types";

export function OptimizationCard({ id, data, minimized, onToggleMinimize, editable, siteId, siteName, planName = "agency", connection }: OptimizationCardProps) {
  const t = useTranslations("SiteCockpit");
  const [showBackupSection, setShowBackupSection] = useState(false);
  const [showPreFlight, setShowPreFlight] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizationData = useOptimizationData(data, siteId);

  const connectionInfo: ConnectionInfo = connection || {
    method: siteId ? "wordpress" : "none",
    status: siteId ? "connected" : "disconnected",
    wordpress: siteId ? { siteId, pluginVersion: "1.0.0" } : undefined,
  };

  const backupSystem = useBackupSystem(siteId || "", connectionInfo);

  const handleBackupCreated = (_backup: BackupInfo) => {
    setShowBackupSection(false);
  };

  if (optimizationData.isLoading) {
    return (
      <CockpitCard id={id} title={<div className="flex items-center gap-2"><Zap className="h-5 w-5 text-blue-400" />{t("actions.optimize")}</div>} category="performance" minimized={minimized} onToggleMinimize={onToggleMinimize} editable={editable} className="lg:col-span-2">
        <div className="p-6 text-sm text-gray-400">{t("common.loading")}</div>
      </CockpitCard>
    );
  }

  if (optimizationData.error) {
    return (
      <CockpitCard id={id} title={<div className="flex items-center gap-2"><Zap className="h-5 w-5 text-red-400" />{t("common.error")}</div>} category="performance" minimized={minimized} onToggleMinimize={onToggleMinimize} editable={editable} className="lg:col-span-2">
        <div className="p-6 text-sm text-red-400">{optimizationData.error}</div>
      </CockpitCard>
    );
  }

  const { comparison, savings, history, quickWins } = optimizationData;

  return (
    <CockpitCard
      id={id}
      title={<div className="flex items-center gap-2"><Zap className="h-5 w-5 text-blue-400" />{t("performance.title")} {t("actions.optimize")}</div>}
      category="performance"
      score={comparison?.before.score}
      grade={comparison?.before.grade}
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
      className="lg:col-span-2"
    >
      {comparison && <BeforeAfterComparison comparison={comparison} animated={false} />}
      {savings && <SavingsDisplay savings={savings} monthlyVisits={10000} />}

      <div className="my-4 rounded-xl border border-gray-700/60 p-4 bg-gray-900/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">{t("actions.optimize")}</h3>
            <p className="text-xs text-gray-400">{t("quickWins.count", { count: quickWins.length })}</p>
          </div>
          <button
            onClick={() => setShowPreFlight(true)}
            disabled={isOptimizing}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-60"
          >
            {isOptimizing ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t("common.loading")}</span> : t("actions.optimize")}
          </button>
        </div>
      </div>

      <PreFlightCheckModal
        isOpen={showPreFlight}
        onClose={() => setShowPreFlight(false)}
        onComplete={() => undefined}
        onProceed={() => {
          setShowPreFlight(false);
          setIsOptimizing(true);
          setShowBackupSection(true);
          setTimeout(() => setIsOptimizing(false), 1200);
        }}
        config={{
          siteId: siteId || "",
          connectionType: connectionInfo.method === "wordpress" ? "wordpress" : "static",
        }}
      />

      {showBackupSection && (
        <div className="mb-6">
          <BackupButton
            backupSystem={backupSystem.backupSystem}
            siteId={siteId || ""}
            connection={connectionInfo}
            onBackupCreated={handleBackupCreated}
          />
        </div>
      )}

      {comparison && <PerformanceChart history={history} current={comparison.before} />}

      {siteId && (
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                {t("performance.title")}
              </h3>
              <p className="text-xs text-gray-400">{planName === "agency" ? t("common.enabled") : t("actions.download")}</p>
            </div>
            <GenerateReportButton
              siteId={siteId}
              siteName={siteName || data?.domain || "Site"}
              planName={planName}
            />
          </div>
        </div>
      )}
    </CockpitCard>
  );
}
