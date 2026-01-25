// app/(dashboard)/dashboard/welcome/WelcomeClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WelcomeHero } from "@/components/onboarding/WelcomeHero";

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

  const handleViewCockpit = () => {
    console.log("[WelcomeClient] Navigating to cockpit for site:", data?.siteId);
    if (data?.siteId) {
      router.push(`/dashboard/sites/${data.siteId}/cockpit`);
    }
  };

  const handleConnectWordPress = () => {
    console.log("[WelcomeClient] Initiating WordPress connection for site:", data?.siteId);
    if (data?.siteId) {
      router.push(`/dashboard/sites/connect?siteId=${data.siteId}`);
    }
  };

  // Render the full WelcomeHero component with confetti and animations
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <WelcomeHero
        url={data?.url || ""}
        domain={data?.domain || "Unknown"}
        faviconUrl={data?.faviconUrl}
        overallScore={data?.overallScore ?? 0}
        categoryScores={data?.categoryScores}
        quickWinsCount={data?.quickWinsCount ?? 0}
        potentialScoreIncrease={data?.potentialScoreIncrease ?? 0}
        quickWins={data?.quickWins || []}
        siteId={data?.siteId || ""}
        onViewCockpit={handleViewCockpit}
        onConnectWordPress={handleConnectWordPress}
        showConfetti={true}
        animated={true}
      />
    </div>
  );
}
