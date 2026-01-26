// app/[locale]/(dashboard)/dashboard/DashboardClient.tsx (CLIENT)
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Globe, TrendingUp, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteCard } from "./components/SiteCard";
import { AccountSummary } from "./components/AccountSummary";

interface DashboardData {
  user: {
    id: number;
    name: string;
    email: string;
  };
  team: {
    id: number;
    name: string;
    planName: string;
    tokensRemaining: number;
    tokensIncluded: number;
    tokensUsed: number;
    subscriptionStatus: string;
  } | null;
  sites: Array<{
    id: string;
    url: string;
    domain: string;
    status: string;
    cms: string | null;
    overallScore: number;
    scores: any;
    findingCount: number;
    lastUpdated: string;
    faviconUrl: string | null;
    connectionStatus: string;
  }>;
}

interface DashboardClientProps {
  data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();

  const handleAddWebsite = () => {
    router.push("/");
  };

  const tokensPercentage = data.team
    ? Math.round((data.team.tokensRemaining / data.team.tokensIncluded) * 100)
    : 0;

  return (
    <div className="flex-1 p-4 lg:p-8">
      {/* Hero Section */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("greeting", { name: data.user.name })}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("welcome_headline")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Plan Badge */}
          {data.team && (
            <Badge
              variant="outline"
              className="px-3 py-1 text-sm font-medium border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {data.team.planName === "free" ? "Free Plan" : data.team.planName.toUpperCase()}
            </Badge>
          )}

          {/* Token Balance Badge */}
          {data.team && (
            <Badge
              variant="outline"
              className="px-3 py-1 text-sm font-medium border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
            >
              <Zap className="w-3 h-3 mr-1" />
              {data.team.tokensRemaining.toLocaleString()} / {data.team.tokensIncluded.toLocaleString()}
            </Badge>
          )}

          {/* Add Website Button - Solid Blue with Subtle Glow */}
          <Button
            onClick={handleAddWebsite}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("add_website")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Sites Grid (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sites Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {t("websites")}
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {data.sites.length} {data.sites.length === 1 ? "site" : "sites"}
              </span>
            </div>

            {/* Sites Grid */}
            {data.sites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.sites.map((site) => (
                  <SiteCard key={site.id} site={site} />
                ))}

                {/* Add Website Card - Empty State */}
                <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer group">
                  <CardContent
                    className="flex flex-col items-center justify-center h-full min-h-[200px] p-6"
                    onClick={handleAddWebsite}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                      <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Add New Website
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Analyze another site
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Empty State - No Sites Yet */
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
                <CardContent className="flex flex-col items-center justify-center py-12 px-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <Globe className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    No websites yet
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-sm mb-6">
                    {t("welcome_text")}
                  </p>
                  <Button
                    onClick={handleAddWebsite}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("add_website")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar - Account Summary (1/3 width on desktop) */}
        <div className="space-y-6">
          <AccountSummary team={data.team} />
        </div>
      </div>
    </div>
  );
}
