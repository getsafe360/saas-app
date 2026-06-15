// components/site-cockpit/cards/wordpress/hooks/useWordPressPairing.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { PairingStatus, UseWordPressPairingReturn } from '../types';

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120; // 5 minutes at 2.5 s/poll

function mapErrorMessage(raw: string): string {
  if (raw.includes('429') || raw.toLowerCase().includes('too many'))
    return 'Too many attempts → wait 10 minutes and try again';
  if (raw.includes('503') || raw.toLowerCase().includes('busy'))
    return 'Service temporarily unavailable → retry in a moment';
  if (raw.toLowerCase().includes('domain not allowed'))
    return 'Domain not allowed in this environment';
  if (raw.toLowerCase().includes('enter a valid'))
    return 'Enter a valid site URL (include https://)';
  return raw || 'Error generating code → try again';
}

export function useWordPressPairing(siteUrl: string, siteId?: string): UseWordPressPairingReturn {
  const [showPairingFlow, setShowPairingFlow] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('idle');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairingMessage, setPairingMessage] = useState('');
  const [pluginDetected, setPluginDetected] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const startPairing = useCallback(async () => {
    if (pairingStatus === 'generating' || pairingStatus === 'waiting') return;

    try {
      stopPolling();
      setPairingStatus('generating');
      setPairCode(null);
      setPluginDetected(null);

      const res = await fetch('/api/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, siteId }),
      });

      let responseData: Record<string, any> = {};
      try {
        responseData = await res.json();
      } catch {
        throw new Error('Server returned an invalid response → try again');
      }

      if (!res.ok) {
        throw new Error(responseData.error || `Connection failed (${res.status}) → try again`);
      }

      const detected: boolean | null =
        typeof responseData.pluginDetected === 'boolean' ? responseData.pluginDetected : null;
      setPluginDetected(detected);
      setPairCode(responseData.pairCode);
      setPairingMessage(
        detected === true
          ? 'Plugin detected — open WordPress Admin → GetSafe 360 → paste the code'
          : detected === false
          ? 'Plugin not detected — install the GetSafe 360 plugin first, then paste the code'
          : 'Open WordPress Admin → GetSafe 360 → paste the code',
      );
      setPairingStatus('ready');
    } catch (e: any) {
      setPairingMessage(mapErrorMessage(e.message || ''));
      setPairingStatus('error');
    }
  }, [siteUrl, siteId, pairingStatus]);

  async function checkPairingOnce(code: string): Promise<{ used: boolean; siteId?: string; expired?: boolean }> {
    const res = await fetch(`/api/connect/check?pairCode=${encodeURIComponent(code)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check failed');
    return data;
  }

  async function checkConnectionStatusOnce(id: string): Promise<boolean> {
    const res = await fetch(`/api/sites/${id}/reconnect`, { method: 'GET', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return false;
    return data?.data?.status === 'connected';
  }

  const copyToClipboard = async () => {
    if (!pairCode) return;
    await navigator.clipboard.writeText(pairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Start pairing as soon as the flow is opened
  useEffect(() => {
    if (showPairingFlow && pairingStatus === 'idle') {
      startPairing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPairingFlow, pairingStatus]);

  // Poll for handshake completion once code is ready
  useEffect(() => {
    if (pairingStatus !== 'ready' || !pairCode) return;

    setPairingStatus('waiting');
    setPairingMessage('Waiting for plugin confirmation…');
    pollAttemptsRef.current = 0;

    // Check every ~25 seconds (every 10 polls) whether DB already shows connected
    const DB_FALLBACK_EVERY = 10;

    pollRef.current = window.setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const data = await checkPairingOnce(pairCode);

        if (data.used) {
          stopPolling();
          setPluginDetected(true);
          setPairingStatus('connected');
          setPairingMessage('Connection established — syncing dashboard…');
          // Hard reload after brief success display so client state resets cleanly
          // and the cockpit re-renders with the new connected status from the DB.
          setTimeout(() => { window.location.reload(); }, 1500);
          return;
        }

        if (data.expired) {
          stopPolling();
          setPairingStatus('error');
          setPairingMessage('Code expired (10 min limit) → generate a new one');
          return;
        }

        // Fallback: check DB connection status periodically in case the
        // plugin already connected via a previous session's pairing code
        if (siteId && pollAttemptsRef.current % DB_FALLBACK_EVERY === 0) {
          const isDbConnected = await checkConnectionStatusOnce(siteId).catch(() => false);
          if (isDbConnected) {
            stopPolling();
            setPluginDetected(true);
            setPairingStatus('connected');
            setPairingMessage('Connection established — syncing dashboard…');
            setTimeout(() => { window.location.reload(); }, 1500);
            return;
          }
        }

        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          setPairingStatus('error');
          setPairingMessage('No confirmation received — paste the code in WordPress and try again');
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_INTERVAL_MS);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingStatus, pairCode, siteId]);

  return {
    showPairingFlow,
    setShowPairingFlow,
    pairingStatus,
    pairCode,
    pairingMessage,
    pluginDetected,
    copied,
    copyToClipboard,
    startPairing,
  };
}
