// components/site-cockpit/cards/wordpress/components/ConnectionStatus/ConnectionBanner.tsx
"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock, Unplug } from "lucide-react";
import type { ConnectionState } from "../../types";

interface ConnectionBannerProps {
  connectionState: ConnectionState;
  onReconnect: () => void;
  onPairingSite: () => void;
  onDisconnect: () => void;
  isReconnecting: boolean;
  hasWordPressData: boolean;
  hasSiteId: boolean;
}

export function ConnectionBanner({
  connectionState,
  onReconnect,
  onPairingSite,
  onDisconnect,
  isReconnecting,
  hasWordPressData,
  hasSiteId,
}: ConnectionBannerProps) {
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

        {connectionState.status === "connected" && hasSiteId && (
          <button
            onClick={onDisconnect}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Unplug className="h-4 w-4" />
            Disconnect
          </button>
        )}

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
