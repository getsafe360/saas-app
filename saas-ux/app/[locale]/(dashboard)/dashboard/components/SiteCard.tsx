// app/[locale]/(dashboard)/dashboard/components/SiteCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, ArrowRight, AlertCircle, CheckCircle, Clock, Loader2, Trash2 } from "lucide-react";
import { CMSIcon } from "@/components/ui/cms-icon";
import { getCMSIcon } from "@/lib/cms-icons";
import { formatDistanceToNow } from "date-fns";

interface SiteCardProps {
  site: {
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
  };
  onRemove?: (siteId: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  if (score >= 70) return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
  if (score >= 50) return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
  return "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return "🟢";
  if (score >= 70) return "🟡";
  if (score >= 50) return "🟠";
  return "🔴";
}

export function SiteCard({ site, onRemove }: SiteCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenCockpit = () => {
    setIsLoading(true);
    router.push(`/dashboard/sites/${site.id}/cockpit`);
  };

  const scoreColor = getScoreColor(site.overallScore);
  const scoreEmoji = getScoreEmoji(site.overallScore);
  const cmsIconData = getCMSIcon(site.cms);

  let timeAgo = "Unknown";
  try {
    timeAgo = formatDistanceToNow(new Date(site.lastUpdated), { addSuffix: true });
  } catch (e) {
    // Ignore date parsing errors
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        {/* Site Header */}
        <div className="flex items-start gap-3 mb-4">
          {/* Favicon or Globe Icon - Enhanced with white background and subtle shadow */}
          <div className="flex-shrink-0 relative">
            {site.faviconUrl ? (
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center p-1.5">
                <img
                  src={site.faviconUrl}
                  alt={site.domain}
                  className="w-full h-full object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement?.querySelector(".favicon-fallback")?.classList.remove("hidden");
                  }}
                />
                <Globe className="favicon-fallback hidden w-5 h-5 text-slate-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                <Globe className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </div>

          {/* Domain and URL */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {site.domain}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {site.url}
            </p>
          </div>
        </div>

        {/* Score Badge */}
        <div className="flex items-center justify-between mb-4">
          <Badge className={`px-3 py-1 text-sm font-semibold border ${scoreColor}`}>
            {scoreEmoji} Score: {site.overallScore}/100
          </Badge>

          {/* CMS Badge with Icon */}
          {site.cms && (
            <Badge
              variant="outline"
              className="text-xs flex items-center gap-1.5 px-2.5 py-1"
            >
              <CMSIcon cms={site.cms} size={14} showFallback={false} />
              <span>{cmsIconData?.name || site.cms.charAt(0).toUpperCase() + site.cms.slice(1)}</span>
            </Badge>
          )}
        </div>

        {/* Issue Count */}
        {site.findingCount > 0 && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-slate-700 dark:text-slate-300">
              {site.findingCount} {site.findingCount === 1 ? "issue" : "issues"} found
            </span>
          </div>
        )}

        {site.findingCount === 0 && site.overallScore > 0 && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-slate-700 dark:text-slate-300">
              No issues found
            </span>
          </div>
        )}

        {/* Status and Timestamp */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated {timeAgo}</span>
          </div>

          {site.connectionStatus === "connected" ? (
            <span className="text-green-600 dark:text-green-400">● Connected</span>
          ) : (
            <span className="text-slate-400">○ Disconnected</span>
          )}
        </div>

        {/* Action Button - Solid Blue with Subtle Glow */}
        <Button
          onClick={handleOpenCockpit}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Opening...
            </>
          ) : (
            <>
              Open Cockpit
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        {/* Remove Site Link */}
        {onRemove && (
          <button
            onClick={() => onRemove(site.id)}
            className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors w-full"
          >
            <Trash2 className="w-3 h-3" />
            Remove site
          </button>
        )}
      </CardContent>
    </Card>
  );
}

