// components/site-cockpit/cards/wordpress/components/ConnectionStatus/ConnectionBanner.tsx
"use client";

import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock, Unplug } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  onDisconnect,
  hasWordPressData: _hasWordPressData,
  hasSiteId,
  onReconnect: _onReconnect,
  onPairingSite: _onPairingSite,
  isReconnecting: _isReconnecting,
}: ConnectionBannerProps) {
  const t = useTranslations("SiteCockpit.wordpress.connection");
  const locale = useLocale();
  const getStatusConfig = () => {
    switch (connectionState.status) {
      case "connected":
        return {
          icon: Wifi,
          color: "green",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/20",
          textColor: "text-green-400",
          message: t("liveData"),
          showDot: true,
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          color: "blue",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          textColor: "text-blue-400",
          message: t("reconnectingMessage"),
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
            connectionState.errorMessage || t("errorRetry"),
          showDot: false,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "orange",
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-500/20",
          textColor: "text-orange-400",
          message: t("connectionLost"),
          showDot: true,
        };
      case "pending":
        return {
          icon: Clock,
          color: "yellow",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/20",
          textColor: "text-yellow-400",
          message: t("waiting"),
          showDot: true,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

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
                  ? t("connected")
                  : connectionState.status === "reconnecting"
                  ? t("reconnectingStatus")
                  : connectionState.status === "error"
                  ? t("errorStatus")
                  : connectionState.status === "disconnected"
                  ? t("disconnected")
                  : t("pending")}
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-0.5">{config.message}</div>
            {connectionState.lastSeen && (
              <div className="text-xs text-gray-500 mt-1">
                {t("lastUpdated")}{" "}
                {connectionState.lastSeen.toLocaleString(locale, {
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
            {t("disconnect")}
          </button>
        )}

        {(connectionState.status === "error" ||
          connectionState.status === "disconnected") && (
          <a
            href="#connection-card"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("connection-card")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors shrink-0"
          >
            {t("reconnect")} ↑
          </a>
        )}

        {connectionState.status === "reconnecting" && (
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            {t("attempt", { attempt: connectionState.retryCount || 1, total: 3 })}
          </div>
        )}
      </div>

      {/* Auto-retry countdown */}
      {connectionState.nextRetry && connectionState.status === "error" && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          {t("autoRetry", {
            minutes: Math.ceil((connectionState.nextRetry.getTime() - Date.now()) / 1000 / 60),
          })}
        </div>
      )}
    </div>
  );
}
