// components/site-cockpit/cards/wordpress/WordPressCard.tsx
"use client";

import { CockpitCard } from "../CockpitCard";
import { WordPressIcon } from "@/components/icons/WordPress";
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
import type { WordPressCardProps } from "./types";
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
  const t = useTranslations("SiteCockpit");
  const { wordpress, cms } = data;

  // Custom hooks handle all logic
  const connection = useWordPressConnection(
    initialStatus,
    lastConnected,
    siteId,
    id,
  );
  const pairing = useWordPressPairing(data.finalUrl);

  // Not WordPress at all
  if (!wordpress && cms.type !== "wordpress") {
    return (
      <CockpitCard
        id={id}
        title={
          <div className="flex items-center gap-3">
            <WordPressIcon size={24} className="text-gray-500" />
            <span className="text-gray-400">{t("wordpress.notDetected")}</span>
          </div>
        }
        category="wordpress"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
        className="lg:col-span-2"
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
            <WordPressIcon
              size={24}
              className="text-[var(--category-wordpress)]"
            />
            <span className="text-[var(--category-wordpress)]">
              {t("wordpress.detected")}
            </span>
          </div>
        }
        category="wordpress"
        minimized={minimized}
        onToggleMinimize={onToggleMinimize}
        editable={editable}
        className="lg:col-span-2"
      >
        <NotConnected pairing={pairing} version={cms.wp?.version} />
      </CockpitCard>
    );
  }

  // Connected WordPress site - Full insights
  return (
    <CockpitCard
      id={id}
      title={
        <div className="flex items-center gap-3">
          <WordPressIcon
            size={24}
            className="text-[var(--category-wordpress)]"
          />
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
      className="lg:col-span-2"
    >
      {/* Connection Status Banner */}
      <ConnectionBanner
        connectionState={connection.connectionState}
        onReconnect={() => connection.setShowReconnectFlow(true)}
        onPairingSite={() => {
          pairing.setShowPairingFlow(true);
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
        />
      )}

      {/* WordPress Analysis Panels */}
      <div className="space-y-4">
        <VersionStatus
          version={wordpress.version}
          recommendations={wordpress.recommendations}
        />
        <SecurityOverview security={wordpress.security} />
        <PluginsPanel plugins={wordpress.plugins} />
      </div>
    </CockpitCard>
  );
}
