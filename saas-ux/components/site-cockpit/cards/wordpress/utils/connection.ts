// components/site-cockpit/cards/wordpress/utils/connection.ts

import type { ConnectionStatus } from "../types";

/**
 * Determines if a connection is healthy based on last seen timestamp
 */
export function isConnectionHealthy(
  lastSeen: Date | undefined,
  maxHoursSinceLastSeen: number = 24
): boolean {
  if (!lastSeen) return false;

  const hoursSinceLastSeen =
    (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastSeen <= maxHoursSinceLastSeen;
}

/**
 * Calculates hours since last connection
 */
export function getHoursSinceLastConnection(lastSeen: Date | undefined): number {
  if (!lastSeen) return Infinity;

  return (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
}

/**
 * Gets a human-readable time since last connection
 */
export function getTimeSinceLastConnection(lastSeen: Date | undefined): string {
  if (!lastSeen) return "Never";

  const hours = getHoursSinceLastConnection(lastSeen);

  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }

  if (hours < 24) {
    const roundedHours = Math.floor(hours);
    return `${roundedHours} hour${roundedHours !== 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

/**
 * Determines if site needs initial pairing vs reconnection
 */
export function needsInitialPairing(
  hasWordPressData: boolean,
  hasSiteId: boolean
): boolean {
  return !hasWordPressData || !hasSiteId;
}

/**
 * Gets connection status display text
 */
export function getConnectionStatusText(status: ConnectionStatus): string {
  const statusMap: Record<ConnectionStatus, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    reconnecting: "Reconnecting",
    error: "Connection Error",
    pending: "Pending",
  };

  return statusMap[status] || "Unknown";
}

/**
 * Gets connection status color theme
 */
export function getConnectionStatusColor(status: ConnectionStatus): {
  bg: string;
  border: string;
  text: string;
} {
  const colorMap: Record<ConnectionStatus, { bg: string; border: string; text: string }> = {
    connected: {
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      text: "text-green-400",
    },
    disconnected: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      text: "text-orange-400",
    },
    reconnecting: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400",
    },
    pending: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      text: "text-yellow-400",
    },
  };

  return colorMap[status] || colorMap.pending;
}

/**
 * Calculates next retry time
 */
export function getNextRetryTime(
  retryCount: number,
  baseDelayMinutes: number = 5
): Date {
  // Exponential backoff: 5min, 10min, 20min
  const delayMinutes = baseDelayMinutes * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

/**
 * Checks if max retries reached
 */
export function hasReachedMaxRetries(retryCount: number, maxRetries: number = 3): boolean {
  return retryCount >= maxRetries;
}

/**
 * Gets retry countdown text
 */
export function getRetryCountdownText(nextRetry: Date | undefined): string {
  if (!nextRetry) return "";

  const minutesUntilRetry = Math.ceil(
    (nextRetry.getTime() - Date.now()) / 1000 / 60
  );

  if (minutesUntilRetry <= 0) return "Retrying now...";
  if (minutesUntilRetry === 1) return "Auto-retry in 1 minute";

  return `Auto-retry in ${minutesUntilRetry} minutes`;
}

/**
 * Formats WordPress API endpoint URL
 */
export function getWordPressApiUrl(siteUrl: string, endpoint: string = "status"): string {
  const cleanUrl = siteUrl.replace(/\/$/, ""); // Remove trailing slash
  return `${cleanUrl}/wp-json/getsafe360/v1/${endpoint}`;
}

/**
 * Validates WordPress site URL
 */
export function isValidWordPressSiteUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitizes WordPress site URL
 */
export function sanitizeWordPressSiteUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Remove trailing slash, query params, and hash
    return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}