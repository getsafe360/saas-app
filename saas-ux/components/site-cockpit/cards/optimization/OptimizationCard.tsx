// components/site-cockpit/cards/optimization/OptimizationCard.tsx
"use client";

import { useState } from "react";
import { CockpitCard } from "../CockpitCard";
import { Zap, TrendingUp } from "lucide-react";
import { useOptimizationData } from "./hooks/useOptimizationData";
import { useBackupSystem } from "./hooks/useBackupSystem";
import { BeforeAfterComparison } from "./components/Summary/BeforeAfterComparison";
import { SavingsDisplay } from "./components/Summary/SavingsDisplay";
import { QuickWinCard } from "./components/QuickWins/QuickWinCard";
import { BackupButton } from "./components/Backup/BackupButton";
import { PerformanceChart } from "./components/Charts/PerformanceChart";
import { PreFlightCheckModal } from "./components/PreFlight";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import type {
  OptimizationCardProps,
  ConnectionInfo,
  BackupInfo,
} from "./types";
import type { PreFlightResult } from "./components/PreFlight/types";

export function OptimizationCard({
  id,
  data,
  minimized,
  onToggleMinimize,
  editable,
  siteId,
  siteName,
  planName = "free",
  connection,
}: OptimizationCardProps) {
  const [showBackupSection, setShowBackupSection] = useState(false);
  const [showPreFlight, setShowPreFlight] = useState(false);
  const [preFlightResult, setPreFlightResult] = useState<PreFlightResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Get optimization data
  const optimizationData = useOptimizationData(data, siteId);

  // Default connection if not provided
  const connectionInfo: ConnectionInfo = connection || {
    method: siteId ? "wordpress" : "none",
    status: siteId ? "connected" : "disconnected",
    wordpress: siteId
      ? {
          siteId,
          pluginVersion: "1.0.0",
        }
      : undefined,
  };

  // Backup system
  const backupSystem = useBackupSystem(siteId || "", connectionInfo);

  // Handle backup creation
  const handleBackupCreated = (backup: BackupInfo) => {
    console.log("Backup created:", backup);
    setShowBackupSection(false);
  };

  // Handle optimization
  const handleOptimize = async (quickWinId: string) => {
    console.log("Optimizing:", quickWinId);

    try {
      const response = await fetch(
        `/api/sites/${siteId}/optimize/${quickWinId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error("Optimization failed");
      }

      // Refresh optimization data
      await optimizationData.refresh();
    } catch (error) {
      console.error("Optimization error:", error);
      throw error;
    }
  };

  if (optimizationData.isLoading) {
    return (
      <CockpitCard
        id={id}
        title={
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <span className="text-blue-400">Performance Optimization</span>
          </div>
        }
        // Type '"optimization"' is not assignable to type 'CategoryType'.ts(2322)
        // CockpitCard.tsx(14, 3): The expected type comes from property 'category' which is declared here on type 'IntrinsicAttributes & CockpitCardProps'
        category="performance"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
        className="lg:col-span-2"
      >
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <div className="mt-4 text-sm text-gray-400">
            Analyzing performance...
          </div>
        </div>
      </CockpitCard>
    );
  }

  if (optimizationData.error) {
    return (
      <CockpitCard
        id={id}
        title={
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-red-400" />
            <span className="text-red-400">Performance Optimization</span>
          </div>
        }
        category="performance"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
        className="lg:col-span-2"
      >
        <div className="p-8 text-center">
          <div className="text-red-400 mb-2">⚠️ Error</div>
          <div className="text-sm text-gray-400">{optimizationData.error}</div>
        </div>
      </CockpitCard>
    );
  }

  const { comparison, savings, quickWins, history } = optimizationData;

  return (
    <CockpitCard
      id={id}
      title={
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-blue-400" />
          <span className="text-blue-400">Performance Optimization</span>
        </div>
      }
      category="performance"
      score={comparison?.before.score}
      grade={comparison?.before.grade}
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
      className="lg:col-span-2"
    >
      {/* Before/After Comparison */}
      {comparison && (
        <BeforeAfterComparison comparison={comparison} animated={true} />
      )}

      {/* Estimated Savings */}
      {savings && <SavingsDisplay savings={savings} monthlyVisits={10000} />}

      {/* Start Optimization CTA */}
      {quickWins.length > 0 && !isOptimizing && (
        <div className="mb-6">
          <button
            onClick={() => setShowPreFlight(true)}
            className="w-full p-4 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 hover:bg-gray-800/70 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gray-700 group-hover:bg-gray-600 transition-colors">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-base font-medium text-white">
                    Run Optimization
                  </div>
                  <div className="text-sm text-gray-400">
                    Verify readiness and optimize your site
                  </div>
                </div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium group-hover:bg-gray-200 transition-colors">
                Start
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Pre-Flight Check Modal */}
      <PreFlightCheckModal
        isOpen={showPreFlight}
        onClose={() => setShowPreFlight(false)}
        onComplete={(result) => setPreFlightResult(result)}
        onProceed={() => {
          setShowPreFlight(false);
          setIsOptimizing(true);
          // TODO: Start actual optimization process
          console.log("Starting optimization with result:", preFlightResult);
        }}
        config={{
          siteId: siteId || "",
          connectionType: connectionInfo.method === "wordpress" ? "wordpress" : "static",
        }}
      />

      {/* Backup Section (shown after pre-flight or manually) */}
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

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Quick Wins ({quickWins.length})
            </h3>
            <div className="text-sm text-gray-400">
              Click to optimize individually
            </div>
          </div>

          <div className="space-y-4">
            {quickWins.map((quickWin) => (
              <QuickWinCard
                key={quickWin.id}
                quickWin={quickWin}
                siteId={siteId || ""}
                connection={connectionInfo}
                backupSystem={backupSystem.backupSystem}
                onOptimize={handleOptimize}
                onBackup={backupSystem.createBackup}
              />
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {comparison && (
        <PerformanceChart history={history} current={comparison.before} />
      )}

      {/* No Optimizations Available */}
      {quickWins.length === 0 && (
        <div className="p-8 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-lg font-semibold text-green-400 mb-2">
            Fully Optimized!
          </div>
          <div className="text-sm text-gray-400">
            Your site is performing at its best. Great job!
          </div>
        </div>
      )}

      {/* Generate Report Section */}
      {siteId && (
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Performance Report
              </h3>
              <p className="text-xs text-gray-400">
                Generate a detailed PDF report for your records or clients
              </p>
            </div>
            <GenerateReportButton
              siteId={siteId}
              siteName={siteName || data?.domain || "Site"}
              planName={planName}
              onReportGenerated={(report) => {
                console.log("Report generated:", report);
              }}
            />
          </div>
        </div>
      )}
    </CockpitCard>
  );
}
