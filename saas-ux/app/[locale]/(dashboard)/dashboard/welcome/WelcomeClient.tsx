// app/(dashboard)/dashboard/welcome/WelcomeClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WelcomeData {
  url: string;
  domain: string;
  faviconUrl?: string;
  overallScore: number;
  categoryScores: {
    performance?: number;
    security?: number;
    seo?: number;
    accessibility?: number;
    wordpress?: number;
  };
  quickWinsCount: number;
  potentialScoreIncrease: number;
  quickWins: Array<{
    title: string;
    impact: "critical" | "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    scoreIncrease?: number;
  }>;
  siteId: string;
}

export function WelcomeClient({ data }: { data: WelcomeData }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mark component as mounted
    setMounted(true);

    console.log("[WelcomeClient] Component mounted");
    console.log("[WelcomeClient] Data received:", {
      hasDomain: !!data?.domain,
      hasUrl: !!data?.url,
      hasSiteId: !!data?.siteId,
      overallScore: data?.overallScore,
      quickWinsCount: data?.quickWinsCount,
      fullData: data
    });

    // Validate data
    if (!data) {
      console.error("[WelcomeClient] No data provided!");
      setError("No welcome data received");
      return;
    }

    if (!data.siteId) {
      console.error("[WelcomeClient] Missing siteId in data!");
      setError("Missing site ID");
      return;
    }

    if (!data.url || !data.domain) {
      console.error("[WelcomeClient] Missing required URL/domain!");
      setError("Missing site information");
      return;
    }

    try {
      console.log("[WelcomeClient] Data validation passed, setting ready state");
      setIsReady(true);
    } catch (err) {
      console.error("[WelcomeClient] Error during mount:", err);
      setError(err instanceof Error ? err.message : "Failed to load welcome page");
    }
  }, [data]);

  // Prevent hydration issues - don't render until client-side mounted
  if (!mounted) {
    return null;
  }

  // Loading state
  if (!isReady && !error) {
    console.log("[WelcomeClient] Rendering loading state");
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Preparing your celebration...
            </CardTitle>
            <CardDescription>
              Loading your site analysis results
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    console.error("[WelcomeClient] Rendering error state:", error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Error Loading Welcome Page
            </CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600 space-y-2">
              <p>We encountered an issue loading your results.</p>
              <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                {error}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => router.push("/dashboard/sites")}
                variant="default"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log("[WelcomeClient] Rendering success state with confetti");

  // TEMPORARY: Simple visible test to verify component renders
  // Once this works, we'll enable WelcomeHero
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="text-6xl">🎉</div>
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Welcome to GetSafe 360!
          </CardTitle>
          <CardDescription className="text-lg">
            Your site analysis is complete
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Site Info */}
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 space-y-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Analyzed Website</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {data?.domain || "Unknown"}
            </div>
            <div className="text-sm text-slate-500 break-all">{data?.url || "No URL"}</div>
          </div>

          {/* Score */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-8 text-center text-white">
            <div className="text-sm font-medium opacity-90 mb-2">Overall Score</div>
            <div className="text-7xl font-bold">{data?.overallScore ?? 0}</div>
            <div className="text-2xl font-semibold mt-2">out of 100</div>
          </div>

          {/* Quick Wins */}
          {data?.quickWinsCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
              <div className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                ✨ {data.quickWinsCount} Quick Wins Available
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Potential score increase: +{data.potentialScoreIncrease} points
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              size="lg"
              className="w-full text-lg h-14 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
              onClick={() => {
                if (data?.siteId) {
                  router.push(`/dashboard/sites/${data.siteId}/cockpit`);
                }
              }}
            >
              View Full Dashboard →
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full text-lg h-14"
              onClick={() => router.push("/dashboard/sites")}
            >
              Go to Sites List
            </Button>
          </div>

          {/* Debug Info */}
          <details className="mt-6 text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              Debug Info (click to expand)
            </summary>
            <pre className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded overflow-auto text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
