// lib/cockpit/useSiteScan.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SiteScanState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "error"; message: string };

const POLL_MS = 2500;
/** A scan normally takes under a minute; give up waiting after this. */
const GIVE_UP_MS = 120_000;

/**
 * Starts a scan for the site and follows it to the end. When it finishes, onDone runs
 * (the cockpit refreshes its server data) and the hook returns to idle.
 * The job id is returned so callers can link to its report.
 */
export function useSiteScan(siteId: string, locale: string, onDone: (jobId: string) => void) {
  const [state, setState] = useState<SiteScanState>({ phase: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const fail = useCallback((message: string) => {
    if (alive.current) setState({ phase: "error", message });
  }, []);

  const start = useCallback(async () => {
    if (state.phase === "running") return;
    setState({ phase: "running" });

    let jobId: string;
    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, locale }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.jobId) {
        return fail(
          res.status === 429
            ? "You have run a lot of scans recently → wait a few minutes and try again."
            : "The scan could not be started → try again.",
        );
      }
      jobId = body.jobId;
    } catch {
      return fail("Connection failed → check your internet and try again.");
    }

    const startedAt = Date.now();
    const poll = async () => {
      if (!alive.current) return;
      if (Date.now() - startedAt > GIVE_UP_MS) {
        return fail("The scan is taking longer than expected → try again in a moment.");
      }
      try {
        const res = await fetch(`/api/scan/status?id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const body = res.ok ? await res.json() : null;
        if (body?.status === "done") {
          if (alive.current) setState({ phase: "idle" });
          onDoneRef.current(jobId);
          return;
        }
        if (body?.status === "error") {
          return fail(body.errorMessage || "The scan could not be completed → try again.");
        }
      } catch {
        /* retry on the next tick */
      }
      timer.current = setTimeout(poll, POLL_MS);
    };
    timer.current = setTimeout(poll, POLL_MS);
  }, [siteId, locale, state.phase, fail]);

  return { state, start };
}
