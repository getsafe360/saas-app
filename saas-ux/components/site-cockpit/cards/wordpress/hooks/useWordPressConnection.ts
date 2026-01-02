// components/site-cockpit/cards/wordpress/hooks/useWordPressConnection.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectionStatus, ConnectionState, UseWordPressConnectionReturn } from '../types';

export function useWordPressConnection(
  initialStatus: ConnectionStatus,
  lastConnected: string | undefined,
  siteId: string | undefined,
  id: string
): UseWordPressConnectionReturn {
  const router = useRouter();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: initialStatus,
    lastSeen: lastConnected ? new Date(lastConnected) : undefined,
    retryCount: 0,
  });
  
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectFlow, setShowReconnectFlow] = useState(false);

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
  }, [connectionState.lastSeen, connectionState.status]);

  // Reconnection handler
  const handleReconnect = async () => {
    setIsReconnecting(true);
    setConnectionState((prev) => ({
      ...prev,
      status: "reconnecting",
      retryCount: (prev.retryCount || 0) + 1,
    }));

    try {
      const response = await fetch(`/api/sites/${id}/reconnect`, {
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
        router.refresh();
      } else {
        throw new Error("Reconnection failed");
      }
    } catch (error) {
      setConnectionState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Connection failed",
        nextRetry: new Date(Date.now() + 5 * 60 * 1000),
      }));
    } finally {
      setIsReconnecting(false);
    }
  };

  // Auto-retry logic
  useEffect(() => {
    if (
      connectionState.status === "error" &&
      connectionState.retryCount &&
      connectionState.retryCount < 3
    ) {
      const retryTimer = setTimeout(() => {
        handleReconnect();
      }, 5 * 60 * 1000);

      return () => clearTimeout(retryTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState.status, connectionState.retryCount]);

  return {
    connectionState,
    isReconnecting,
    showReconnectFlow,
    setShowReconnectFlow,
    handleReconnect,
  };
}