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

export function WelcomeClient({ stashUrl }: { stashUrl: string }) {
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

    async function bootstrapSiteFromStash() {
      try {
        const stashRes = await fetch(stashUrl, { cache: "no-store" });
        if (!stashRes.ok) {
          throw new Error(`Failed to load stash (${stashRes.status})`);
        }

        const stash = (await stashRes.json()) as StashPayload;
        if (!stash?.url) {
          throw new Error("Stash payload is missing URL");
        }

        setStatusText("Creating your site...");

        const createRes = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: stash.url,
            platform: stash.platform || stash.facts?.cms?.type || "unknown",
            initialAnalysis: {
              summary: stash.summary || "Initial analysis imported from signup handoff.",
              categories: stash.categories || [],
              scores: stash.scores,
              findings: stash.findings || [],
              faviconUrl: stash.facts?.faviconUrl,
            },
          }),
        });

        const created = await createRes.json().catch(() => null);
        if (!createRes.ok || !created?.siteId) {
          throw new Error(created?.error || "Failed to create site");
        }

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

    void bootstrapSiteFromStash();

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
            🎉 Awesome! Your site is being prepared
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
