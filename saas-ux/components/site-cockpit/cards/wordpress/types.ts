// components/site-cockpit/cards/wordpress/types.ts

import type { SiteCockpitResponse } from "@/types/site-cockpit";

// Connection Status Types
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error"
  | "pending";

export interface ConnectionState {
  status: ConnectionStatus;
  lastSeen?: Date;
  errorMessage?: string;
  retryCount?: number;
  nextRetry?: Date;
}

// Pairing Status Types
export type PairingStatus =
  | "idle"
  | "generating"
  | "ready"
  | "waiting"
  | "error"
  | "connected";

// Component Props
export interface WordPressCardProps {
  id: string;
  data: SiteCockpitResponse;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  editable?: boolean;
  siteId?: string;
  connectionStatus?: ConnectionStatus;
  lastConnected?: string; // ISO date string
}

// Hook Return Types
export interface UseWordPressConnectionReturn {
  connectionState: ConnectionState;
  isReconnecting: boolean;
  showReconnectFlow: boolean;
  setShowReconnectFlow: (show: boolean) => void;
  handleReconnect: () => Promise<void>;
}

export interface UseWordPressPairingReturn {
  showPairingFlow: boolean;
  setShowPairingFlow: (show: boolean) => void;
  pairingStatus: PairingStatus;
  pairCode: string | null;
  pairingMessage: string;
  copied: boolean;
  copyToClipboard: () => Promise<void>;
  startPairing: () => Promise<void>;
}