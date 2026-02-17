// components/site-cockpit/cards/wordpress/hooks/useWordPressConnection.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectionStatus, ConnectionState, UseWordPressConnectionReturn } from '../types';

interface ReconnectResponseError {
  error?: {
    message?: string;
    action?: string;
    details?: string;
  };
}

export function useWordPressConnection(
  initialStatus: ConnectionStatus,
  lastConnected: string | undefined,
  siteId: string | undefined,
): UseWordPressConnectionReturn {
  const router = useRouter();

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: initialStatus,
    lastSeen: lastConnected ? new Date(lastConnected) : undefined,
    retryCount: 0,
  });

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnectFlow, setShowReconnectFlow] = useState(false);

  // Keep local UI state synced with server updates after refresh/navigation.
  useEffect(() => {
    setConnectionState((prev) => ({
      ...prev,
      status: initialStatus,
      lastSeen: lastConnected ? new Date(lastConnected) : prev.lastSeen,
      errorMessage: initialStatus === 'connected' ? undefined : prev.errorMessage,
      retryCount: initialStatus === 'connected' ? 0 : prev.retryCount,
    }));

    if (initialStatus === 'connected') {
      setShowReconnectFlow(false);
      setIsReconnecting(false);
    }
  }, [initialStatus, lastConnected]);

  // Auto-detect connection issues
  useEffect(() => {
    if (connectionState.lastSeen) {
      const hoursSinceLastSeen =
        (Date.now() - connectionState.lastSeen.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastSeen > 24 && connectionState.status === 'connected') {
        setConnectionState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'No data received in 24+ hours',
        }));
      }
    }
  }, [connectionState.lastSeen, connectionState.status]);

  const handleReconnect = async () => {
    if (!siteId) {
      setConnectionState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Missing site ID for reconnection',
      }));
      return;
    }

    setIsReconnecting(true);
    setConnectionState((prev) => ({
      ...prev,
      status: 'reconnecting',
      retryCount: (prev.retryCount || 0) + 1,
      errorMessage: undefined,
    }));

    try {
      const response = await fetch(`/api/sites/${siteId}/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setConnectionState({
          status: 'connected',
          lastSeen: new Date(),
          retryCount: 0,
        });
        setShowReconnectFlow(false);
        router.refresh();
      } else {
        const body = (await response
          .json()
          .catch(() => ({}))) as ReconnectResponseError;

        const message = body.error?.message ?? `Reconnection failed (${response.status})`;
        const action = body.error?.action;

        throw new Error(action ? `${message} ${action}` : message);
      }
    } catch (error) {
      setConnectionState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Connection failed',
        nextRetry: new Date(Date.now() + 5 * 60 * 1000),
      }));
    } finally {
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    if (
      connectionState.status === 'error' &&
      connectionState.retryCount &&
      connectionState.retryCount < 3 &&
      !showReconnectFlow
    ) {
      const retryTimer = setTimeout(() => {
        handleReconnect();
      }, 5 * 60 * 1000);

      return () => clearTimeout(retryTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState.status, connectionState.retryCount, showReconnectFlow]);

  return {
    connectionState,
    isReconnecting,
    showReconnectFlow,
    setShowReconnectFlow,
    handleReconnect,
  };
}
