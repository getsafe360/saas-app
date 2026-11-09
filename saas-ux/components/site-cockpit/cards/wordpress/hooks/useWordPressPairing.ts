// components/site-cockpit/cards/wordpress/hooks/useWordPressPairing.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { PairingStatus, UseWordPressPairingReturn } from '../types';
import {
  PAIRING_MESSAGES_EN,
  classifyPairingError,
  readyMessageKey,
  type PairingMessageKey,
} from '@/lib/wordpress/pairing-messages';

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120; // 5 minutes at 2.5 s/poll

export function useWordPressPairing(siteUrl: string, siteId?: string): UseWordPressPairingReturn {
  const [showPairingFlow, setShowPairingFlow] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>('idle');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairingMessage, setPairingMessageText] = useState('');
  const [pairingMessageKey, setPairingMessageKey] = useState<PairingMessageKey | null>(null);
  const [pluginDetected, setPluginDetected] = useState<boolean | null>(null);
  const [pluginVersion, setPluginVersion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);

  /** Sets the translatable key; `text` overrides the English text (raw server errors). */
  function setPairingMessage(key: PairingMessageKey, text?: string) {
    setPairingMessageKey(key);
    setPairingMessageText(text ?? PAIRING_MESSAGES_EN[key]);
  }

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
      setPluginVersion(null);

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
      setPluginVersion(typeof responseData.pluginVersion === 'string' ? responseData.pluginVersion : null);
      setPairCode(responseData.pairCode);
      setPairingMessage(readyMessageKey(detected));
      setPairingStatus('ready');
    } catch (e: any) {
      const raw: string = e?.message || '';
      const key = classifyPairingError(raw);
      // Untranslated callers keep seeing the server's own wording for unclassified errors.
      setPairingMessage(key, key === 'generic' && raw ? raw : undefined);
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

  // Poll for handshake completion while a code is outstanding. The effect keys on
  // "polling" rather than the raw status: it moves ready -> waiting itself, and a status
  // dependency would re-run it and clear the interval it just started.
  const polling = (pairingStatus === 'ready' || pairingStatus === 'waiting') && !!pairCode;
  useEffect(() => {
    if (!polling || !pairCode) return;

    setPairingStatus('waiting');
    setPairingMessage('waiting');
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
          setPairingMessage('connected');
          // Signal ConnectionCard to show the "just connected" banner after reload.
          if (siteId) sessionStorage.setItem(`gs360_just_connected_${siteId}`, '1');
          setTimeout(() => { window.location.reload(); }, 1500);
          return;
        }

        if (data.expired) {
          stopPolling();
          setPairingStatus('error');
          setPairingMessage('expired');
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
            setPairingMessage('connected');
            if (siteId) sessionStorage.setItem(`gs360_just_connected_${siteId}`, '1');
            setTimeout(() => { window.location.reload(); }, 1500);
            return;
          }
        }

        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          setPairingStatus('error');
          setPairingMessage('noConfirmation');
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_INTERVAL_MS);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, pairCode, siteId]);

  return {
    showPairingFlow,
    setShowPairingFlow,
    pairingStatus,
    pairCode,
    pairingMessage,
    pairingMessageKey,
    pluginDetected,
    pluginVersion,
    copied,
    copyToClipboard,
    startPairing,
  };
}
