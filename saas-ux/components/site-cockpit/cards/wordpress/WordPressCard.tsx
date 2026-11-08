// components/site-cockpit/cards/wordpress/WordPressCard.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CockpitCard } from "../CockpitCard";
import { WordPressAIIcon } from "@/components/icons/WordPressAI";
import { useLocale, useTranslations } from "next-intl";
import { useWordPressConnection } from "./hooks/useWordPressConnection";
import { useWordPressPairing } from "./hooks/useWordPressPairing";
import { useFindingText } from "./hooks/useFindingText";
import { NotConnected } from "./components/EmptyStates/NotConnected";
import { NoWordPress } from "./components/EmptyStates/NoWordPress";
import { VersionStatus } from "./components/Analysis/VersionStatus";
import { SecurityOverview } from "./components/Analysis/SecurityOverview";
import { PluginsPanel } from "./components/Analysis/PluginsPanel";
import {
  HealthFindingsPanel,
  type ApplyOutcome,
  type UndoOutcome,
} from "./components/Analysis/HealthFindingsPanel";
import type { RemediationItem } from "@/lib/wordpress/remediation-result";
import type { WordPressCardProps } from "./types";
import type { WordPressHealthFinding } from "@/types/site-cockpit";
import { ConnectionBanner } from "./components/ConnectionStatus/ConnectionBanner";
import { ReconnectionModal } from "./components/ConnectionStatus/ReconnectionModal";
export function WordPressCard({
  id,
  data,
  minimized,
  onToggleMinimize,
  editable,
  siteId,
  connectionStatus: initialStatus = "disconnected",
  lastConnected,
  agentMode = false,
  pluginVersion,
}: WordPressCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("SiteCockpit");
  const locale = useLocale();
  const findingText = useFindingText();
  const { wordpress, cms } = data;

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

  // Hooks stay above the early returns so their order never changes between renders.
  const topRedFlags = useMemo(
    () =>
      (wordpress?.healthFindings ?? [])
        .filter(
          // Only observed problems: an unmeasured integrity check is not evidence of compromise.
          (finding) =>
            finding.category === "red-flags" &&
            (finding.status === "fail" || finding.status === "warning"),
        )
        .slice(0, 5),
    [wordpress?.healthFindings],
  );

  const analyzePath = useMemo(() => {
    if (!siteId) return null;

    const fallback = `/dashboard/sites/${siteId}/analyze`;
    if (!pathname) return fallback;

    const cockpitSegment = `/dashboard/sites/${siteId}/cockpit`;
    if (!pathname.includes(cockpitSegment)) return fallback;

    return pathname.replace(cockpitSegment, `/dashboard/sites/${siteId}/analyze`);
  }, [pathname, siteId]);

  const agentWorkspacePath = useMemo(() => {
    if (!siteId) return null;

    const fallback = `/dashboard/sites/${siteId}/wordpress-agent`;
    if (!pathname) return fallback;

    const cockpitSegment = `/dashboard/sites/${siteId}/cockpit`;
    if (pathname.includes(cockpitSegment)) {
      return pathname.replace(cockpitSegment, `/dashboard/sites/${siteId}/wordpress-agent`);
    }

    return pathname.includes(`/dashboard/sites/${siteId}/wordpress-agent`)
      ? pathname
      : fallback;
  }, [pathname, siteId]);

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

  // WordPress detected but not paired. Any telemetry in `wordpress` is then inferred from the
  // public page, so it is never shown as live data.
  if (!wordpress || connection.connectionState.status !== "connected") {
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
        <NotConnected pairing={pairing} version={cms.wp?.version} pluginVersion={pluginVersion} />
      </CockpitCard>
    );
  }

  const telemetryStatus = wordpress.connection?.status === "degraded"
    ? {
        label: "Saved snapshot",
        detail: "Live pull failed, showing the latest stored telemetry.",
      }
    : {
        label: "Live telemetry",
        detail: "Direct connector data from the current WordPress site.",
      };

  const handleApply = async (
    selectedFindings: WordPressHealthFinding[],
    options: { safeMode: boolean },
  ): Promise<ApplyOutcome> => {
    if (!siteId || connection.connectionState.status !== "connected") {
      connection.setShowReconnectFlow(true);
      return { ok: false, error: "notConnected" };
    }

    try {
      const healthResponse = await fetch(`/api/sites/${siteId}/health`, { cache: "no-store" });
      const health = await healthResponse.json().catch(() => ({}));
      if (!healthResponse.ok || health.healthy === false) {
        connection.setShowReconnectFlow(true);
        return { ok: false, error: "notConnected" };
      }

      const response = await fetch(`/api/sites/${siteId}/wordpress/remediate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          safeMode: options.safeMode,
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
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        if (body?.error === "WORDPRESS_NOT_CONNECTED") {
          connection.setShowReconnectFlow(true);
          return { ok: false, error: "notConnected" };
        }
        console.warn("[WordPressCard] remediation failed", response.status, body?.error);
        return { ok: false, error: "apply" };
      }
      return { ok: true, items: Array.isArray(body.items) ? (body.items as RemediationItem[]) : [] };
    } catch (error) {
      console.error("[WordPressCard] remediation failed", error);
      return { ok: false, error: "apply" };
    }
  };

  const handleUndo = async (runIds: string[]): Promise<UndoOutcome> => {
    if (!siteId) return { ok: false, error: "undo" };
    try {
      const response = await fetch(`/api/sites/${siteId}/wordpress/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionRunIds: runIds }),
      });
      const body = await response.json().catch(() => null);
      if (body?.error === "UNDO_NEWER_CHANGES_FIRST") return { ok: false, error: "undoNewerFirst" };
      const outcomes: Array<{ runId: string; status: string }> = Array.isArray(body?.outcomes) ? body.outcomes : [];
      if (outcomes.length === 0) return { ok: false, error: "undo" };
      return {
        ok: true,
        undoneRunIds: outcomes.filter((o) => o.status === "rolled_back").map((o) => o.runId),
        failedRunIds: outcomes.filter((o) => o.status !== "rolled_back").map((o) => o.runId),
      };
    } catch (error) {
      console.error("[WordPressCard] undo failed", error);
      return { ok: false, error: "undo" };
    }
  };

  const handleRescan = () => {
    if (analyzePath) router.push(`${analyzePath}?source=wordpress-remediate`);
  };

  return (
    <CockpitCard
      id={id}
      title={
        <div className="flex items-center gap-3">
          <WordPressAIIcon size={24} className="h-6 w-6" />
          <span className="text-[var(--category-wordpress)]">
            {agentMode ? "WordPress Optimization Agent" : t("wordpress.title")}
          </span>
        </div>
      }
      category="wordpress"
      score={wordpress.score ?? undefined}
      grade={wordpress.score === null ? undefined : wordpress.grade}
      minimized={minimized}
      onToggleMinimize={onToggleMinimize}
      editable={editable}
    >
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
            {agentMode ? "WordPress Optimization Agent" : t("wordpress.title")}
          </h4>
          {!agentMode && agentWorkspacePath && (
            <button
              type="button"
              onClick={() => router.push(agentWorkspacePath)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              Open Agent Workspace
            </button>
          )}
        </div>

        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border-default)", background: "var(--header-bg)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--category-wordpress)" }}>
                {telemetryStatus.label}
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--text-subtle)" }}>
                {telemetryStatus.detail}
              </div>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs sm:min-w-[280px] sm:grid-cols-3">
              <div className="rounded-md px-2 py-2" style={{ background: "var(--background-default)" }}>
                <div style={{ color: "var(--text-subtle)" }}>Core</div>
                <div className="mt-1 text-sm font-semibold text-white">{wordpress.version.current}</div>
              </div>
              <div className="rounded-md px-2 py-2" style={{ background: "var(--background-default)" }}>
                <div style={{ color: "var(--text-subtle)" }}>Latest</div>
                <div className="mt-1 text-sm font-semibold text-white">{wordpress.version.latest}</div>
              </div>
              <div className="rounded-md px-2 py-2" style={{ background: "var(--background-default)" }}>
                <div style={{ color: "var(--text-subtle)" }}>Plugins</div>
                <div className="mt-1 text-sm font-semibold text-white">{wordpress.plugins.active}</div>
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
                        value === null
                          ? "text-[var(--text-subtle)]"
                          : value >= 80
                            ? "text-emerald-300"
                            : value >= 60
                              ? "text-yellow-300"
                              : "text-red-300"
                      }
                      title={value === null ? "Not measured yet" : undefined}
                    >
                      {value === null ? "—" : `${value}/100`}
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
                  • {findingText.title(flag)}
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
          onApply={handleApply}
          onUndo={handleUndo}
          onRescan={handleRescan}
          currentScore={wordpress.score ?? undefined}
        />
      </div>
    </CockpitCard>
  );
}
