// components/site-cockpit/cards/wordpress/hooks/useWordPressPairing.ts
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PairingStatus, UseWordPressPairingReturn } from '../types';

export function useWordPressPairing(siteUrl: string, siteId?: string): UseWordPressPairingReturn {
  const router = useRouter();
  
  const [showPairingFlow, setShowPairingFlow] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>("idle");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairingMessage, setPairingMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollAttemptsRef = useRef(0);

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startPairing() {
    // Guard clause
    if (pairingStatus === "generating" || pairingStatus === "waiting") {
      console.log("⚠️ Pairing already in progress, skipping");
      return;
    }

    try {
      console.log("🚀 Starting pairing process");
      setPairingStatus("generating");

      const res = await fetch("/api/connect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, siteId }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || "Failed to generate pairing code");
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
      console.error("❌ Pairing error:", e);
      setPairingMessage(e.message || "Error generating code");
      setPairingStatus("error");
    }
  }

  async function checkPairingOnce(code: string): Promise<{ used: boolean; siteId?: string; expired?: boolean }> {
    const res = await fetch(`/api/connect/check?pairCode=${encodeURIComponent(code)}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Check failed");
    return data;
  }


  async function checkConnectionStatusOnce(id: string): Promise<boolean> {
    const res = await fetch(`/api/sites/${id}/reconnect`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return false;

    return data?.data?.status === "connected";
  }

  const copyToClipboard = async () => {
    if (!pairCode) return;
    await navigator.clipboard.writeText(pairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger pairing when flow is shown
  useEffect(() => {
    if (showPairingFlow && pairingStatus === "idle") {
      console.log("📍 Triggering startPairing from useEffect");
      startPairing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPairingFlow, pairingStatus]);

  // Poll for pairing completion
  useEffect(() => {
    if (pairingStatus !== "ready" || !pairCode) return;

    setPairingStatus("waiting");
    setPairingMessage("Waiting for plugin confirmation...");
    pollAttemptsRef.current = 0;

    pollRef.current = window.setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const data = await checkPairingOnce(pairCode);
        if (data.used) {
          stopPolling();
          setPairingStatus("connected");
          setPairingMessage("Connection established. Syncing dashboard...");
          router.refresh();
          return;
        }

        if (data.expired) {
          stopPolling();
          setPairingStatus("error");
          setPairingMessage("Pairing code expired. Generate a new code and try again.");
          return;
        }

        if (pollAttemptsRef.current >= 48) {
          if (siteId) {
            const isConnected = await checkConnectionStatusOnce(siteId).catch(() => false);
            if (isConnected) {
              stopPolling();
              setPairingStatus("connected");
              setPairingMessage("Connection established. Syncing dashboard...");
              router.refresh();
              return;
            }
          }

          stopPolling();
          setPairingStatus("error");
          setPairingMessage("No confirmation received yet. Please retry or generate a new pairing code.");
        }
      } catch {
        // ignore transient errors
      }
    }, 2500);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingStatus, pairCode, router, siteId]);

  return {
    showPairingFlow,
    setShowPairingFlow,
    pairingStatus,
    pairCode,
    pairingMessage,
    copied,
    copyToClipboard,
    startPairing,
  };
}
