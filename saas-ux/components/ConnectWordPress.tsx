// saas-ux/components/ConnectWordPress.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";

type Status = "idle" | "checking" | "ready" | "waiting" | "error" | "connected";

export default function ConnectWordPress({ defaultUrl = "" }: { defaultUrl?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const initialUrl = defaultUrl || sp.get("url") || "";
  const [url, setUrl] = useState(initialUrl);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const pollRef = useRef<number | null>(null);

  const { isSignedIn, getToken } = useAuth();

  function stopPolling() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function start() {
    try {
      if (!isSignedIn) {
        // Send them to sign-in and come back here afterwards
        const redirectTo = `/dashboard/sites/connect?url=${encodeURIComponent(url.trim())}`;
        router.push(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }

      setStatus("checking");

      // Optional Bearer token (helps if you later protect APIs with Clerk auth middleware);
      // cookies will also be sent via credentials: 'include'
      const token = await getToken().catch(() => null);

      const res = await fetch("/api/connect/start", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ siteUrl: url.trim() })
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        // Not signed in (or server can’t see the session)
        const redirectTo = `/dashboard/sites/connect?url=${encodeURIComponent(url.trim())}`;
        router.push(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to start pairing");
      }

      setPairCode(data.pairCode);
      setMessage(
        data.pluginDetected
          ? "Open your WordPress admin → GetSafe 360 → paste the code to connect."
          : "Install/activate the GetSafe 360 plugin, then paste the code to connect."
      );
      setStatus("ready");
    } catch (e: any) {
      setMessage(e.message || "Error starting pairing");
      setStatus("error");
    }
  }

  async function checkOnce(code: string) {
    const res = await fetch(`/api/connect/check?pairCode=${encodeURIComponent(code)}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Check failed");
    return data as { used: boolean; siteId?: string };
  }

  // Begin polling after code is generated
  useEffect(() => {
    if (status !== "ready" || !pairCode) return;
    setStatus("waiting");
    pollRef.current = window.setInterval(async () => {
      try {
        const data = await checkOnce(pairCode);
        if (data.used && data.siteId) {
          stopPolling();
          setStatus("connected");
          router.push(`/dashboard/sites/${data.siteId}?connected=1`);
        }
      } catch {
        // ignore transient errors
      }
    }, 2500);

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pairCode]);

  const canStart = useMemo(() => /^https?:\/\/[^\s]+$/i.test(url), [url]);

  return (
    <div className="space-y-4">
      {/* Signed-out gate */}
      <SignedOut>
        <div className="rounded-lg border p-4 bg-amber-50 text-amber-800">
          <div className="font-medium mb-2">Sign in required</div>
          <p className="text-sm">
            Please sign in to generate a pairing code for <span className="font-mono">{url || "your site"}</span>.
          </p>
          <div className="mt-3">
            <SignInButton
              mode="modal"
              forceRedirectUrl={`/dashboard/sites/connect?url=${encodeURIComponent(url || '')}`}
              signUpForceRedirectUrl={`/dashboard/sites/connect?url=${encodeURIComponent(url || '')}`}
            >
              <button className="px-4 py-2 rounded bg-blue-600 text-white">Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      {/* Main UI for signed-in users */}
      <SignedIn>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="https://your-site.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            onClick={start}
            disabled={!canStart || status === "checking"}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {status === "checking" ? "Generating…" : "Generate code"}
          </button>
        </div>

        {(status === "ready" || status === "waiting") && (
          <div className="rounded-lg border p-4">
            <div className="text-sm opacity-70 mb-1">{message}</div>
            <div className="text-3xl font-mono tracking-widest">{pairCode}</div>
            <div className="text-xs mt-1 opacity-60">Expires in ~10 minutes • single use</div>

            {/* Correct public path (no "public/" prefix) */}
            <a className="underline text-sm mt-3 inline-block" href="/wp-plugin/getsafe360-connector.zip">
              Download the plugin
            </a>

            {status === "waiting" && (
              <div className="text-sm mt-3">
                Waiting for handshake… this usually takes a few seconds after you click Connect in WordPress.
              </div>
            )}
          </div>
        )}

        {status === "error" && <div className="text-red-600 text-sm">{message}</div>}
      </SignedIn>
    </div>
  );
}
