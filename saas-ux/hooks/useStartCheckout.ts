"use client";

import { useCallback, useState } from "react";

import type { CheckoutTarget } from "@/config/billing/catalogue";

/**
 * Starts a server-created Stripe Checkout Session and sends the browser to it.
 * Signed-out visitors are sent to sign-up and brought back to `returnTo`.
 */
export function useStartCheckout(returnTo = "/pricing") {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (target: CheckoutTarget) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
        });

        if (res.status === 401) {
          window.location.assign(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "Checkout failed → Try again in a moment");
        }
        window.location.assign(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed → Try again in a moment");
        setLoading(false);
      }
    },
    [returnTo],
  );

  return { start, loading, error };
}
