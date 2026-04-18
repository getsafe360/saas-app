"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StashPayload = {
  url?: string;
  platform?: string;
  summary?: string;
  categories?: unknown[];
  findings?: unknown[];
  facts?: { cms?: { type?: string }; faviconUrl?: string } | null;
  scores?: { overall?: number; seo?: number; a11y?: number; perf?: number; sec?: number };
};

// Shape written by backupToSessionStorage() in saveTestResults.ts
type SessionBackup = {
  url?: string;
  scores?: { overall?: number; seo?: number; a11y?: number; perf?: number; sec?: number };
  faviconUrl?: string;
};

// Shape written by SignupHandoffCapture.tsx
type SignupHandoff = {
  testedUrl?: string;
  testId?: string;
};

function readSessionStash(): { stashUrl: string | null; directPayload: StashPayload | null } {
  try {
    // Preferred: full blob URL stored by saveTestResults after stash upload
    const storedUrl = sessionStorage.getItem("getsafe360_stash_url");
    if (storedUrl) {
      return { stashUrl: storedUrl, directPayload: null };
    }

    // Good fallback: backup written right after analysis completes
    const backupRaw = sessionStorage.getItem("getsafe360_test_backup");
    if (backupRaw) {
      const backup = JSON.parse(backupRaw) as SessionBackup;
      if (backup?.url) {
        return {
          stashUrl: null,
          directPayload: {
            url: backup.url,
            scores: backup.scores,
            facts: backup.faviconUrl ? { faviconUrl: backup.faviconUrl } : null,
          },
        };
      }
    }

    // Last resort: handoff key written by SignupHandoffCapture
    const handoffRaw = sessionStorage.getItem("getsafe360_signup_handoff");
    if (handoffRaw) {
      const handoff = JSON.parse(handoffRaw) as SignupHandoff;
      if (handoff?.testedUrl) {
        return {
          stashUrl: null,
          directPayload: { url: handoff.testedUrl },
        };
      }
    }
  } catch {
    // sessionStorage unavailable (private browsing, etc.)
  }
  return { stashUrl: null, directPayload: null };
}

function clearSessionStash() {
  try {
    sessionStorage.removeItem("getsafe360_stash_url");
    sessionStorage.removeItem("getsafe360_test_backup");
    sessionStorage.removeItem("getsafe360_signup_handoff");
  } catch {
    // ignore
  }
}

export function WelcomeClient({ stashUrl }: { stashUrl: string | null }) {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Loading your test results...");
  const [error, setError] = useState<string | null>(null);

  const loadingSteps = useMemo(
    () => [
      "Loading your test results...",
      "Creating your secure cockpit...",
      "Storing your initial analysis...",
      "Launching your dashboard...",
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    let stepIndex = 0;

    const stepTimer = window.setInterval(() => {
      stepIndex = (stepIndex + 1) % loadingSteps.length;
      setStatusText(loadingSteps[stepIndex]);
    }, 1200);

    async function bootstrapSite() {
      try {
        let payload: StashPayload | null = null;

        // Resolve the stash payload — either from prop URL or sessionStorage
        const effectiveStashUrl = stashUrl ?? (() => {
          const { stashUrl: sessionUrl } = readSessionStash();
          return sessionUrl;
        })();

        if (effectiveStashUrl) {
          const stashRes = await fetch(effectiveStashUrl, { cache: "no-store" });
          if (!stashRes.ok) {
            throw new Error(`Failed to load stash (${stashRes.status})`);
          }
          payload = (await stashRes.json()) as StashPayload;
        } else {
          // No blob URL — use direct session data
          const { directPayload } = readSessionStash();
          payload = directPayload;
        }

        if (!payload?.url) {
          // No test data at all — send to sites list
          if (!cancelled) router.replace("/dashboard/sites?first=1");
          return;
        }

        setStatusText("Creating your site...");

        const createRes = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: payload.url,
            platform: payload.platform || payload.facts?.cms?.type || "unknown",
            initialAnalysis: {
              summary: payload.summary || "Initial analysis imported from signup handoff.",
              categories: payload.categories || [],
              scores: payload.scores,
              findings: payload.findings || [],
              faviconUrl: payload.facts?.faviconUrl,
            },
          }),
        });

        const created = await createRes.json().catch(() => null);
        if (!createRes.ok || !created?.siteId) {
          throw new Error(created?.error || "Failed to create site");
        }

        clearSessionStash();
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (!cancelled) {
          router.replace(`/dashboard/sites/${created.siteId}/cockpit`);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to initialize site from stash");
        }
      } finally {
        window.clearInterval(stepTimer);
      }
    }

    void bootstrapSite();

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
    };
  }, [loadingSteps, router, stashUrl]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              We couldn't finish setup
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard/sites")}>Go to sites</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl border-blue-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Sparkles className="w-5 h-5" />
            Awesome! Your site is being prepared
          </CardTitle>
          <CardDescription>
            We're importing your scan and opening your cockpit in a moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-xl border bg-white/80 dark:bg-slate-900/70 p-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium">{statusText}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
