// components/site-cockpit/cards/wordpress/WordPressCard.tsx
"use client";

import { CockpitCard } from "../CockpitCard";
import { WordPressIcon } from "@/components/icons/WordPress";
import { useWordPressConnection } from "./hooks/useWordPressConnection";
import { useWordPressPairing } from "./hooks/useWordPressPairing";
import { ConnectionBanner } from "./components/ConnectionStatus/ConnectionBanner";
import { ReconnectionModal } from "./components/ConnectionStatus/ReconnectionModal";
import { NotConnected } from "./components/EmptyStates/NotConnected";
import { NoWordPress } from "./components/EmptyStates/NoWordPress";
import { VersionStatus } from "./components/Analysis/VersionStatus";
import { SecurityOverview } from "./components/Analysis/SecurityOverview";
import { PluginsPanel } from "./components/Analysis/PluginsPanel";
import { ThemePanel } from "./components/Analysis/ThemePanel";
import { PerformancePanel } from "./components/Analysis/PerformancePanel";
import type { WordPressCardProps } from "./types";
import type { WordPressRecommendation as SiteWordPressRecommendation } from "@/types/site-cockpit";

interface VersionStatusProps {
  version: {
    current: string;
    latest: string;
    outdated: boolean;
    daysOld: number;
  };
  recommendations: SiteWordPressRecommendation[];
}

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
  const { wordpress, cms } = data;

  // Custom hooks handle all logic
  const connection = useWordPressConnection(
    initialStatus,
    lastConnected,
    siteId,
    id
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
            <span className="text-gray-400">WordPress</span>
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
            <WordPressIcon size={24} className="text-[#21759B]" />
            <span className="text-blue-400">WordPress Detected</span>
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
          <WordPressIcon size={24} className="text-[#21759B]" />
          <span className="text-blue-400">WordPress Insights</span>
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
      <VersionStatus
        version={wordpress.version}
        recommendations={wordpress.recommendations}
      />
      <SecurityOverview security={wordpress.security} />
      <PluginsPanel plugins={wordpress.plugins} />
      <ThemePanel theme={wordpress.themes} />
      <PerformancePanel performance={wordpress.performanceData} />
    </CockpitCard>
  );
}
