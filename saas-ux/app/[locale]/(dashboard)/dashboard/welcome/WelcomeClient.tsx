// app/(dashboard)/dashboard/welcome/WelcomeClient.tsx
"use client";

import { WelcomeHero } from "@/components/onboarding/WelcomeHero";
import { useRouter } from "next/navigation";

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

  const handleViewCockpit = () => {
    // Track analytics here if needed
    console.log("User viewed cockpit from welcome page");
  };

  const handleConnectWordPress = () => {
    // Track analytics here if needed
    console.log("User initiated WordPress connection from welcome page");
  };

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
