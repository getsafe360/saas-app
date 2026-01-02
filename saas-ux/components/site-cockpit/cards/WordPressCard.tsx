// components/site-cockpit/cards/WordPressCard.tsx
"use client";

import { CockpitCard } from "./CockpitCard";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Package,
  Palette,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  PlayCircle,
} from "lucide-react";

import type { SiteCockpitResponse } from "@/types/site-cockpit";
import { WordPressIcon } from "../../icons/WordPress";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Connection Status Types
type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error"
  | "pending";

interface ConnectionState {
  status: ConnectionStatus;
  lastSeen?: Date;
  errorMessage?: string;
  retryCount?: number;
  nextRetry?: Date;
}

type PairingStatus =
  | "idle"
  | "generating"
  | "ready"
  | "waiting"
  | "error"
  | "connected";

interface WordPressCardProps {
  id: string;
  data: SiteCockpitResponse;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
  siteId?: string;
  connectionStatus?: ConnectionStatus; // From backend
  lastConnected?: string; // ISO date string
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
  const router = useRouter();
  const [showConnect, setShowConnect] = useState(false);

  // Connection State Management
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: initialStatus,
    lastSeen: lastConnected ? new Date(lastConnected) : undefined,
    retryCount: 0,
  });

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectFlow, setShowReconnectFlow] = useState(false);
  // 🆕 Pairing Code State
  const [showPairingFlow, setShowPairingFlow] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>("idle");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairingMessage, setPairingMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Auto-detect connection issues
  useEffect(() => {
    if (connectionState.lastSeen) {
      const hoursSinceLastSeen =
        (Date.now() - connectionState.lastSeen.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastSeen > 24 && connectionState.status === "connected") {
        setConnectionState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: "No data received in 24+ hours",
        }));
      }
    }
  }, [connectionState.lastSeen]);

  // 🆕 Pairing Code Functions

  function stopPolling() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function startPairing() {
    // 🛡️ GUARD: Prevent duplicate calls
    if (pairingStatus === "generating" || pairingStatus === "waiting") {
      console.log("⚠️ Pairing already in progress, skipping");
      return;
    }
    try {
      setPairingStatus("generating");

      const res = await fetch("/api/connect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: data.finalUrl }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          responseData.error || "Failed to generate pairing code"
        );
      }

      setPairCode(responseData.pairCode);
      setPairingMessage(
        responseData.pluginDetected
          ? "Open WordPress Admin → GetSafe 360 → paste the code"
          : "Install GetSafe 360 plugin, then paste the code"
      );
      setPairingStatus("ready");
      console.log("✅ Pairing code generated successfully");
    } catch (e: any) {
      setPairingMessage(e.message || "Error generating code");
      setPairingStatus("error");
    }
  }

  async function checkPairingOnce(code: string) {
    const res = await fetch(
      `/api/connect/check?pairCode=${encodeURIComponent(code)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Check failed");
    return data as { used: boolean; siteId?: string };
  }

  const copyToClipboard = async () => {
    if (!pairCode) return;
    await navigator.clipboard.writeText(pairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reconnection Handler
  const handleReconnect = async () => {
    setIsReconnecting(true);
    setConnectionState((prev) => ({
      ...prev,
      status: "reconnecting",
      retryCount: (prev.retryCount || 0) + 1,
    }));

    try {
      // Simulate reconnection API call
      const response = await fetch(`/api/sites/${siteId}/reconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setConnectionState({
          status: "connected",
          lastSeen: new Date(),
          retryCount: 0,
        });
        setShowReconnectFlow(false);
      } else {
        throw new Error("Reconnection failed");
      }
    } catch (error) {
      setConnectionState((prev) => ({
        ...prev,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Connection failed",
        nextRetry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      }));
    } finally {
      setIsReconnecting(false);
    }
  };

  // Check if site is connected to GetSafe 360
  const isConnected = connectionState.status === "connected";
  const hasConnectionIssue =
    connectionState.status === "error" ||
    connectionState.status === "disconnected";

  // Determine if site needs pairing or reconnection
  const needsInitialPairing = !siteId || !wordpress; // Never connected
  const needsReconnection = siteId && wordpress && hasConnectionIssue; // Was connected, now broken

  // Show appropriate flow
  if (needsInitialPairing) {
    // Show pairing code generator (inline in card)
    setShowPairingFlow(true);
    startPairing();
  } else if (needsReconnection) {
    // Show 3-step reconnection modal
    setShowReconnectFlow(true);
  }
  // Auto-retry logic
  useEffect(() => {
    if (
      connectionState.status === "error" &&
      connectionState.retryCount &&
      connectionState.retryCount < 3
    ) {
      const retryTimer = setTimeout(() => {
        handleReconnect();
      }, 5 * 60 * 1000); // Retry after 5 minutes

      return () => clearTimeout(retryTimer);
    }
  }, [connectionState.status, connectionState.retryCount]);

  // 🆕 Poll for pairing completion
  useEffect(() => {
    if (pairingStatus !== "ready" || !pairCode) return;

    setPairingStatus("waiting");
    pollRef.current = window.setInterval(async () => {
      try {
        const data = await checkPairingOnce(pairCode);
        if (data.used && data.siteId) {
          stopPolling();
          setPairingStatus("connected");
          setConnectionState({
            status: "connected",
            lastSeen: new Date(),
            retryCount: 0,
          });
          setShowPairingFlow(false);
          router.refresh(); // Refresh to show connected data
        }
      } catch {
        // ignore transient errors
      }
    }, 2500);

    return stopPolling;
  }, [pairingStatus, pairCode, router]);

  if (!wordpress) {
    if (cms.type === "wordpress") {
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
          {!showPairingFlow ? (
            /* Initial Connect CTA */
            <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <LinkIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Connect Your WordPress Site
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Generate a 6-digit pairing code and enter it in the GetSafe
                    360 plugin to unlock deep insights.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPairingFlow(true);
                        startPairing();
                      }}
                      disabled={pairingStatus === "generating"}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <LinkIcon className="h-4 w-4" />
                      {pairingStatus === "generating"
                        ? "Generating..."
                        : "Generate Pairing Code"}
                    </button>
                    <a
                      href="/wp-plugin/getsafe360-connector.zip"
                      download
                      className="px-4 py-2 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Download Plugin
                    </a>
                  </div>
                </div>
              </div>

              {/* 🆕 Pairing Code Display */}
              {showPairingFlow && pairCode && (
                <div className="mt-6 bg-gray-900/60 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">
                        Your Pairing Code
                      </div>
                      <div className="text-xs text-gray-500">
                        {pairingMessage}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowPairingFlow(false);
                          stopPolling();
                          setPairingStatus("idle");
                          setPairCode(null);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <XCircle className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div className="text-5xl font-mono tracking-[0.5em] text-center text-white py-6 mb-4 bg-gray-800/50 rounded-lg">
                    {pairCode}
                  </div>

                  <div className="text-xs text-gray-500 text-center mb-4">
                    Expires in ~10 minutes • Single use only
                  </div>

                  {pairingStatus === "waiting" && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                      <div className="text-sm text-blue-300">
                        Waiting for connection... Enter the code in WordPress
                        admin
                      </div>
                    </div>
                  )}

                  {pairingStatus === "error" && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div className="text-sm text-red-300">
                        {pairingMessage}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-700/50 flex gap-3 text-sm">
                    <a
                      href="/wp-plugin/getsafe360-connector.zip"
                      download
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Download Plugin
                    </a>
                    <span className="text-gray-600">•</span>
                    <a
                      href="/docs/wordpress-connection"
                      target="_blank"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Setup Guide
                    </a>
                  </div>
                </div>
              )}
              {/* What You'll Get */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <div className="font-medium">Plugin & Theme Analysis</div>
                    <div className="text-xs text-gray-500">
                      Detect outdated & vulnerable plugins
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <div className="font-medium">Security Scanning</div>
                    <div className="text-xs text-gray-500">
                      Check login exposure & XML-RPC
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <div className="font-medium">Performance Metrics</div>
                    <div className="text-xs text-gray-500">
                      Object cache & OPcache status
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Pairing Code Display */
            <PairingCodeDisplay
              pairCode={pairCode}
              pairingStatus={pairingStatus}
              pairingMessage={pairingMessage}
              copied={copied}
              onCopy={copyToClipboard}
              onClose={() => {
                setShowPairingFlow(false);
                stopPolling();
                setPairingStatus("idle");
                setPairCode(null);
              }}
            />
          )}

          {/* Basic WP Info */}
          <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
            <div className="text-sm text-gray-400 mb-1">WordPress Version</div>
            <div className="text-lg font-semibold text-white">
              {cms.wp?.version || "Unknown"}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {showPairingFlow
                ? "Waiting for plugin connection..."
                : "Connect for comprehensive analysis"}
            </div>
          </div>
        </CockpitCard>
      );
    }
    return null;
  }

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
      {/* 📊 CONNECTION STATUS ARCHITECTURE */}
      <ConnectionStatusBanner
        connectionState={connectionState}
        onReconnect={() => setShowReconnectFlow(true)}
        onPairingSite={() => {
          setShowPairingFlow(true);
          startPairing();
        }}
        isReconnecting={isReconnecting}
        hasWordPressData={!!wordpress}
        hasSiteId={!!siteId}
      />

      {/* 🔄 RECONNECTION FLOW MODAL */}
      {showReconnectFlow && (
        <ReconnectionFlow
          connectionState={connectionState}
          onReconnect={handleReconnect}
          onClose={() => setShowReconnectFlow(false)}
          isReconnecting={isReconnecting}
          siteUrl={data.finalUrl}
        />
      )}

      {/* Version Status */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-400 mb-1">WordPress Version</div>
            <div className="text-2xl font-bold text-white">
              {wordpress.version.current}
            </div>
          </div>
          {wordpress.version.outdated && (
            <div className="px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-semibold">
              Update Available
            </div>
          )}
        </div>

        {wordpress.version.outdated && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-700/50">
            <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-gray-300 mb-1">
                {wordpress.version.daysOld} days old • Latest:{" "}
                {wordpress.version.latest}
              </div>
              <div className="text-xs text-gray-500">
                {wordpress.recommendations.length} security recommendations
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap">
              Update Now
            </button>
          </div>
        )}
      </div>

      {/* Security Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SecurityMetric
          label="Login Page"
          icon={Shield}
          status={!wordpress.security.defaultLoginExposed}
          value={
            wordpress.security.defaultLoginExposed ? "Exposed" : "Protected"
          }
        />
        <SecurityMetric
          label="User Enum"
          icon={Shield}
          status={wordpress.security.userEnumerationBlocked}
          value={
            wordpress.security.userEnumerationBlocked ? "Blocked" : "Vulnerable"
          }
        />
        <SecurityMetric
          label="XML-RPC"
          icon={Shield}
          status={!wordpress.security.xmlrpcEnabled}
          value={wordpress.security.xmlrpcEnabled ? "Enabled" : "Disabled"}
        />
        <SecurityMetric
          label="Debug Mode"
          icon={Shield}
          status={!wordpress.security.wpDebugMode}
          value={wordpress.security.wpDebugMode ? "On" : "Off"}
        />
      </div>

      {/* Plugins Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            Plugins ({wordpress.plugins.total})
          </h4>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">
              {wordpress.plugins.active} active
            </span>
            {wordpress.plugins.outdated > 0 && (
              <span className="text-orange-400">
                {wordpress.plugins.outdated} outdated
              </span>
            )}
            {wordpress.plugins.vulnerable > 0 && (
              <span className="text-red-400 font-semibold">
                {wordpress.plugins.vulnerable} vulnerable
              </span>
            )}
          </div>
        </div>

        {/* Vulnerable plugins */}
        {wordpress.plugins.list.filter((p) => p.vulnerable).length > 0 && (
          <div className="space-y-2 mb-4">
            {wordpress.plugins.list
              .filter((p) => p.vulnerable)
              .map((plugin) => (
                <div
                  key={plugin.slug}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {plugin.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Current: {plugin.version} → Update to: {plugin.latest}
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors">
                      Fix Now
                    </button>
                  </div>
                  {plugin.vulnerabilities &&
                    plugin.vulnerabilities.length > 0 && (
                      <div className="text-xs text-red-400">
                        {plugin.vulnerabilities[0].description}
                      </div>
                    )}
                </div>
              ))}
          </div>
        )}

        {/* Outdated plugins (non-vulnerable) */}
        {wordpress.plugins.outdated > wordpress.plugins.vulnerable && (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="text-sm text-orange-400">
                {wordpress.plugins.outdated - wordpress.plugins.vulnerable}{" "}
                plugins need updates
              </div>
              <button className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                View All →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Theme */}
      <div className="mb-6 p-4 rounded-xl bg-gray-800/40 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Palette className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {wordpress.themes.active}
              </div>
              <div className="text-xs text-gray-400">
                v{wordpress.themes.version}
                {wordpress.themes.outdated &&
                  ` • Update to ${wordpress.themes.latest}`}
              </div>
            </div>
          </div>
          {wordpress.themes.outdated && (
            <button className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
              Update Theme
            </button>
          )}
        </div>
      </div>

      {/* Performance Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <PerformanceMetric
          label="Object Cache"
          value={wordpress.performanceData.objectCache}
          recommendation={
            !wordpress.performanceData.objectCache
              ? "Enable for 40% speed boost"
              : undefined
          }
        />
        <PerformanceMetric
          label="OPcache"
          value={wordpress.performanceData.opcacheEnabled}
        />
        <PerformanceMetric
          label="Gzip Compression"
          value={wordpress.performanceData.gzipEnabled}
        />
        <PerformanceMetric
          label="Lazy Loading"
          value={wordpress.performanceData.lazyLoadEnabled}
        />
      </div>
    </CockpitCard>
  );
}

// 📊 CONNECTION STATUS BANNER COMPONENT
function ConnectionStatusBanner({
  connectionState,
  onReconnect,
  onPairingSite,
  isReconnecting,
  hasWordPressData,
  hasSiteId,
}: {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onPairingSite: () => void;
  isReconnecting: boolean;
  hasWordPressData: boolean;
  hasSiteId: boolean;
}) {
  const getStatusConfig = () => {
    switch (connectionState.status) {
      case "connected":
        return {
          icon: Wifi,
          color: "green",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/20",
          textColor: "text-green-400",
          message: "Live data from your site",
          showDot: true,
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          color: "blue",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          textColor: "text-blue-400",
          message: "Reconnecting to your site...",
          showDot: false,
          animate: "animate-spin",
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "red",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
          textColor: "text-red-400",
          message:
            connectionState.errorMessage || "Connection error - Click to retry",
          showDot: false,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "orange",
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-500/20",
          textColor: "text-orange-400",
          message: "Connection lost - Click to reconnect",
          showDot: false,
        };
      case "pending":
        return {
          icon: Clock,
          color: "yellow",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/20",
          textColor: "text-yellow-400",
          message: "Waiting for site response...",
          showDot: true,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;
  const needsInitialPairing = !hasWordPressData || !hasSiteId;

  return (
    <div className="mb-4">
      <div
        className={`flex items-center justify-between p-4 rounded-xl ${config.bgColor} border ${config.borderColor}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon
              className={`h-5 w-5 ${config.textColor} ${config.animate || ""}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {config.showDot && (
                <div
                  className={`h-2 w-2 rounded-full bg-${config.color}-400 animate-pulse`}
                />
              )}
              <span className={`font-semibold ${config.textColor}`}>
                {connectionState.status === "connected"
                  ? "Connected"
                  : connectionState.status === "reconnecting"
                  ? "Reconnecting"
                  : connectionState.status === "error"
                  ? "Connection Error"
                  : connectionState.status === "disconnected"
                  ? "Disconnected"
                  : "Pending"}
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-0.5">{config.message}</div>
            {connectionState.lastSeen && (
              <div className="text-xs text-gray-500 mt-1">
                Last updated:{" "}
                {connectionState.lastSeen.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        </div>

        {(connectionState.status === "error" ||
          connectionState.status === "disconnected") && (
          <button
            onClick={needsInitialPairing ? onPairingSite : onReconnect}
            disabled={isReconnecting}
            className={`px-4 py-2 rounded-lg ${
              isReconnecting
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            } text-sm font-semibold transition-colors flex items-center gap-2`}
          >
            <RefreshCw
              className={`h-4 w-4 ${isReconnecting ? "animate-spin" : ""}`}
            />
            {isReconnecting
              ? "Reconnecting..."
              : needsInitialPairing
              ? "Connect Now"
              : "Reconnect"}
          </button>
        )}

        {connectionState.status === "reconnecting" && (
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            Attempt {connectionState.retryCount || 1} of 3
          </div>
        )}
      </div>

      {/* Auto-retry countdown */}
      {connectionState.nextRetry && connectionState.status === "error" && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Auto-retry in{" "}
          {Math.ceil(
            (connectionState.nextRetry.getTime() - Date.now()) / 1000 / 60
          )}{" "}
          minutes
        </div>
      )}
    </div>
  );
}

// 🔄 RECONNECTION FLOW COMPONENT
function ReconnectionFlow({
  connectionState,
  onReconnect,
  onClose,
  isReconnecting,
  siteUrl,
}: {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onClose: () => void;
  isReconnecting: boolean;
  siteUrl: string;
}) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      id: 1,
      title: "Check Plugin Status",
      description: "Ensure GetSafe 360 Connector is active",
      action: "Verify Plugin",
      icon: Package,
    },
    {
      id: 2,
      title: "Test Connection",
      description: "Attempting to reach your WordPress site",
      action: "Test Now",
      icon: Wifi,
    },
    {
      id: 3,
      title: "Sync Data",
      description: "Retrieving latest site information",
      action: "Sync",
      icon: RefreshCw,
    },
  ];

  const handleStepAction = async (stepId: number) => {
    setStep(stepId);

    if (stepId === 3) {
      // Final step - trigger reconnection
      await onReconnect();
      setTimeout(() => onClose(), 2000);
    } else {
      // Auto-advance to next step
      setTimeout(() => setStep(stepId + 1), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Reconnect WordPress Site
            </h2>
            <p className="text-sm text-gray-400">{siteUrl}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <XCircle className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center flex-1">
                <div
                  className={`flex flex-col items-center ${
                    index < steps.length - 1 ? "w-full" : ""
                  }`}
                >
                  <div
                    className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all ${
                      step >= s.id
                        ? "bg-blue-500 border-blue-500"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    <s.icon
                      className={`h-6 w-6 ${
                        step >= s.id ? "text-white" : "text-gray-500"
                      } ${step === s.id ? "animate-pulse" : ""}`}
                    />
                  </div>
                  <div className="mt-2 text-xs text-center">
                    <div
                      className={`font-semibold ${
                        step >= s.id ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {s.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      step > s.id ? "bg-blue-500" : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step Details */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              {React.createElement(steps[step - 1].icon, {
                className: "h-6 w-6 text-blue-400",
              })}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                {steps[step - 1].title}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {steps[step - 1].description}
              </p>

              {/* Step-specific content */}
              {step === 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">
                      Plugin installed and active
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">API key configured</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-gray-300">
                      Pinging WordPress REST API...
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono bg-gray-900 p-2 rounded">
                    GET {siteUrl}/wp-json/getsafe360/v1/status
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  {isReconnecting ? (
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                      <span className="text-gray-300">
                        Syncing site data...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300">
                        Connection restored!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {step < 3 && (
              <button
                onClick={() => handleStepAction(step)}
                disabled={isReconnecting}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2"
              >
                {steps[step - 1].action}
                <PlayCircle className="h-4 w-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => handleStepAction(3)}
                disabled={isReconnecting}
                className={`px-6 py-2 rounded-lg ${
                  isReconnecting
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-500 text-white"
                } font-semibold transition-colors flex items-center gap-2`}
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {connectionState.errorMessage && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-400 mb-1">
                  Connection Error
                </div>
                <div className="text-xs text-gray-400">
                  {connectionState.errorMessage}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PairingCodeDisplay({
  pairCode,
  pairingStatus,
  pairingMessage,
  copied,
  onCopy,
  onClose,
}: {
  pairCode: string | null;
  pairingStatus: string;
  pairingMessage: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <LinkIcon className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Pairing Code Generated
            </h3>
            <p className="text-sm text-gray-400">{pairingMessage}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <XCircle className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {pairCode && (
        <div className="bg-gray-900/60 rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Your Pairing Code</span>
            <button
              onClick={onCopy}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="text-4xl font-mono tracking-[0.5em] text-center text-white mb-2">
            {pairCode}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Expires in ~10 minutes • Single use only
          </div>
        </div>
      )}

      {pairingStatus === "waiting" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <div className="text-sm text-blue-300">
            Waiting for connection... Enter the code in WordPress admin
          </div>
        </div>
      )}

      {pairingStatus === "error" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="text-sm text-red-300">{pairingMessage}</div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 mb-3">Need help?</div>
        <div className="flex gap-3">
          <a
            href="/wp-plugin/getsafe360-connector.zip"
            download
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Download Plugin
          </a>
          <span className="text-gray-600">•</span>
          <a
            href="/docs/wordpress-connection"
            target="_blank"
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Setup Guide
          </a>
        </div>
      </div>
    </div>
  );
}

function SecurityMetric({
  label,
  icon: Icon,
  status,
  value,
}: {
  label: string;
  icon: any;
  status: boolean;
  value: string;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        status
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon
          className={`h-4 w-4 ${status ? "text-green-400" : "text-red-400"}`}
        />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div
        className={`text-sm font-semibold ${
          status ? "text-green-400" : "text-red-400"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PerformanceMetric({
  label,
  value,
  recommendation,
}: {
  label: string;
  value: boolean;
  recommendation?: string;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        value
          ? "bg-green-500/5 border-green-500/20"
          : "bg-orange-500/5 border-orange-500/20"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {value ? (
          <CheckCircle className="h-4 w-4 text-green-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-orange-400" />
        )}
      </div>
      <div
        className={`text-sm font-semibold ${
          value ? "text-green-400" : "text-orange-400"
        }`}
      >
        {value ? "Enabled" : "Disabled"}
      </div>
      {recommendation && (
        <div className="text-xs text-gray-500 mt-1">{recommendation}</div>
      )}
    </div>
  );
}
function useRef<T>(initialValue: T): React.MutableRefObject<T> {
  return { current: initialValue };
}
