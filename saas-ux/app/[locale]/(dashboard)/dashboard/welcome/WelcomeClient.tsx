// app/(dashboard)/dashboard/welcome/WelcomeClient.tsx
"use client";

import { useEffect, useState } from "react";
import { WelcomeHero } from "@/components/onboarding/WelcomeHero";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  useEffect(() => {
    // Ensure client has hydrated before showing confetti
    try {
      console.log("[WelcomeClient] Mounting with data:", data);
      setIsReady(true);
    } catch (err) {
      console.error("[WelcomeClient] Error during mount:", err);
      setError(err instanceof Error ? err.message : "Failed to load welcome page");
    }
  }, [data]);

  const handleViewCockpit = () => {
    // Track analytics here if needed
    console.log("User viewed cockpit from welcome page");
  };

  const handleConnectWordPress = () => {
    // Track analytics here if needed
    console.log("User initiated WordPress connection from welcome page");
  };

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading your results...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Error Loading Welcome Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{error}</p>
            <button
              onClick={() => router.push("/dashboard/sites")}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Go to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <WelcomeHero
        url={data.url}
        domain={data.domain}
        faviconUrl={data.faviconUrl}
        overallScore={data.overallScore}
        categoryScores={data.categoryScores}
        quickWinsCount={data.quickWinsCount}
        potentialScoreIncrease={data.potentialScoreIncrease}
        quickWins={data.quickWins}
        siteId={data.siteId}
        onViewCockpit={handleViewCockpit}
        onConnectWordPress={handleConnectWordPress}
        showConfetti={true}
        animated={true}
      />
    </div>
  );
}
