// components/site-cockpit/cards/wordpress/WordPressCard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CockpitCard } from "../CockpitCard";
import { WordPressAIIcon } from "@/components/icons/WordPressAI";
import { useTranslations } from "next-intl";
import { useWordPressConnection } from "./hooks/useWordPressConnection";
import { useWordPressPairing } from "./hooks/useWordPressPairing";
import { ConnectionBanner } from "./components/ConnectionStatus/ConnectionBanner";
import { ReconnectionModal } from "./components/ConnectionStatus/ReconnectionModal";
import { NotConnected } from "./components/EmptyStates/NotConnected";
import { NoWordPress } from "./components/EmptyStates/NoWordPress";
import { VersionStatus } from "./components/Analysis/VersionStatus";
import { SecurityOverview } from "./components/Analysis/SecurityOverview";
import { PluginsPanel } from "./components/Analysis/PluginsPanel";
import { HealthFindingsPanel } from "./components/Analysis/HealthFindingsPanel";
import { ImplementationPlanPanel } from "./components/Analysis/ImplementationPlanPanel";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import type { WordPressCardProps } from "./types";
import type { WordPressHealthFinding } from "@/types/site-cockpit";
export function WordPressCard({
  id,
  data,
  minimized,
  onToggleMinimize,
  editable,
  siteId,
  connectionStatus: initialStatus = "disconnected",
  lastConnected,
}: WordPressCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("SiteCockpit");
  const { wordpress, cms } = data;
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Custom hooks handle all logic
  const connection = useWordPressConnection(
    initialStatus,
    lastConnected,
    siteId,
  );
  const pairing = useWordPressPairing(data.finalUrl, siteId);

  const hasTriggeredPostPairReconnect = useRef(false);

  useEffect(() => {
    if (pairing.pairingStatus !== "connected") {
      hasTriggeredPostPairReconnect.current = false;
      return;
    }

    if (hasTriggeredPostPairReconnect.current) return;
    hasTriggeredPostPairReconnect.current = true;

    connection.setShowReconnectFlow(false);
    void connection.handleReconnect();
  }, [
    pairing.pairingStatus,
    connection.handleReconnect,
    connection.setShowReconnectFlow,
  ]);

  // Not WordPress at all
  if (!wordpress && cms.type !== "wordpress") {
    return (
      <CockpitCard
        id={id}
        title={
          <div className="flex items-center gap-3">
            <WordPressAIIcon size={24} className="h-6 w-6" />
            <span className="text-gray-400">{t("wordpress.notDetected")}</span>
          </div>
        }
        category="wordpress"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
      >
        <NoWordPress siteUrl={data.finalUrl} detectedCMS={cms.type} />
      </CockpitCard>
    );
  }

  // WordPress detected but not connected
  if (!wordpress) {
    return (
      <CockpitCard
        id={id}
        title={
          <div className="flex items-center gap-3">
            <WordPressAIIcon size={24} className="h-6 w-6" />
            <span className="text-[var(--category-wordpress)]">
              {t("wordpress.detected")}
            </span>
          </div>
        }
        category="wordpress"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
      >
        <NotConnected pairing={pairing} version={cms.wp?.version} />
      </CockpitCard>
    );
  }

  // Connected WordPress site - Full insights
  const topRedFlags = useMemo(
    () =>
      (wordpress.healthFindings ?? [])
        .filter(
          (finding) =>
            finding.category === "red-flags" && finding.status !== "pass",
        )
        .slice(0, 5),
    [wordpress.healthFindings],
  );

  const analyzePath = useMemo(() => {
    if (!siteId) return null;

    const fallback = `/dashboard/sites/${siteId}/analyze`;
    if (!pathname) return fallback;

    const cockpitSegment = `/dashboard/sites/${siteId}/cockpit`;
    if (!pathname.includes(cockpitSegment)) return fallback;

    return pathname.replace(cockpitSegment, `/dashboard/sites/${siteId}/analyze`);
  }, [pathname, siteId]);

  const handleOptimize = async (
    selectedFindings: WordPressHealthFinding[],
    options?: { safeMode: boolean },
  ) => {
    if (selectedFindings.length === 0) return;

    if (!siteId || connection.connectionState.status !== "connected") {
      connection.setShowReconnectFlow(true);
      return;
    }

    try {
      setIsOptimizing(true);

      const healthResponse = await fetch(`/api/sites/${siteId}/health`, {
        cache: "no-store",
      });
      const health = await healthResponse.json().catch(() => ({}));
      if (!healthResponse.ok || health.healthy === false) {
        connection.setShowReconnectFlow(true);
        return;
      }

      const response = await fetch(`/api/sites/${siteId}/wordpress/remediate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: "en",
          safeMode: options?.safeMode ?? true,
          findings: selectedFindings.map((finding) => ({
            id: finding.id,
            actionId: finding.remediationActionId,
            title: finding.title,
            severity: finding.severity,
            category: finding.category,
            automationLevel: finding.automationLevel,
            safetyLevel: finding.safetyLevel,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.warn(
          "[WordPressCard] remediation non-OK response",
          response.status,
          body,
        );
        return;
      }

      await response.json().catch(() => null);

      if (analyzePath) {
        router.push(
          `${analyzePath}?source=wordpress-remediate&selected=${selectedFindings.length}`,
        );
      }
    } catch (error) {
      console.error("[WordPressCard] optimize failed", error);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <CockpitCard
      id={id}
      title={
        <div className="flex items-center gap-3">
          <WordPressAIIcon size={24} className="h-6 w-6" />
          <span className="text-[var(--category-wordpress)]">
            {t("wordpress.title")}
          </span>
        </div>
      }
      category="wordpress"
      score={wordpress.score}
      grade={wordpress.grade}
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
    >
      {/* Connection Status Banner */}
      <ConnectionBanner
        connectionState={connection.connectionState}
        onReconnect={() => connection.setShowReconnectFlow(true)}
        onPairingSite={() => {
          pairing.setShowPairingFlow(true);
        }}
        onDisconnect={() => {
          void connection.handleDisconnect();
        }}
        isReconnecting={connection.isReconnecting}
        hasWordPressData={!!wordpress}
        hasSiteId={!!siteId}
      />

      {/* Reconnection Modal */}
      {connection.showReconnectFlow && (
        <ReconnectionModal
          connectionState={connection.connectionState}
          onReconnect={connection.handleReconnect}
          onClose={() => connection.setShowReconnectFlow(false)}
          isReconnecting={connection.isReconnecting}
          siteUrl={data.finalUrl}
          pairing={pairing}
        />
      )}

      {/* WordPress Analysis Panels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--text-subtle)" }}
          >
            {t("wordpress.title")}
          </h4>
          {siteId ? (
            <GenerateReportButton
              siteId={siteId}
              siteName={data.domain}
              planName="agency"
            />
          ) : null}
        </div>
        <div
          className="rounded-lg border p-3 text-xs"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <div style={{ color: "var(--text-subtle)" }}>{t("wordpress.connection.status.title")}</div>
              <div style={{ color: "var(--text-primary)" }}>
                {wordpress.connection?.status ?? "connected"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-subtle)" }}>{t("wordpress.lastAudit")}</div>
              <div style={{ color: "var(--text-primary)" }}>
                {wordpress.connection?.lastAuditAt ?? "Just now"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-subtle)" }}>{t("wordpress.trend")}</div>
              <div
                className={
                  wordpress.trend?.delta && wordpress.trend.delta >= 0
                    ? "text-emerald-300"
                    : "text-red-300"
                }
              >
                {wordpress.trend
                  ? `${wordpress.trend.delta >= 0 ? "+" : ""}${wordpress.trend.delta}`
                  : "0"}
              </div>
            </div>
          </div>
        </div>

        {wordpress.categoryScores && (
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div
              className="text-xs mb-2"
              style={{ color: "var(--text-subtle)" }}
            >
              {t("wordpress.categoryScores")}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {Object.entries(wordpress.categoryScores).map(
                ([category, value]) => (
                  <div
                    key={category}
                    className="rounded-md px-2 py-1"
                    style={{ background: "var(--header-bg)" }}
                  >
                    <div style={{ color: "var(--text-subtle)" }}>
                      {category}
                    </div>
                    <div
                      className={
                        value >= 80
                          ? "text-emerald-300"
                          : value >= 60
                            ? "text-yellow-300"
                            : "text-red-300"
                      }
                    >
                      {value}/100
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {topRedFlags.length > 0 && (
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "rgba(248,113,113,0.45)" }}
          >
            <div className="text-xs mb-2" style={{ color: "var(--status-critical)" }}>{t("wordpress.topRedFlags")}</div>
            <ul className="space-y-1 text-xs">
              {topRedFlags.map((flag) => (
                <li key={flag.id} style={{ color: "var(--status-critical)" }}>
                  • {flag.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        <VersionStatus
          version={wordpress.version}
          recommendations={wordpress.recommendations}
        />
        <SecurityOverview security={wordpress.security} />
        <PluginsPanel plugins={wordpress.plugins} />
        <HealthFindingsPanel
          findings={wordpress.healthFindings ?? []}
          onOptimize={handleOptimize}
          optimizing={isOptimizing}
          currentScore={wordpress.score}
        />
        <ImplementationPlanPanel recommendations={wordpress.recommendations} />
      </div>
    </CockpitCard>
  );
}
