// saas-ux/components/analyzer/display/ReportHeader.tsx

import { Badge } from "@/components/ui/badge";
import { Shield, Globe, Server, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ComponentType } from "react";

type CMSDisplay = {
  name: string;
  icon?: string | ComponentType<{ size?: number; className?: string }>;
  iconEmoji?: string;
  type: string;
};

type Props = {
  url: string;
  domain: string;
  faviconUrl?: string;
  status?: number;
  isHttps: boolean;
  cms?: CMSDisplay | null;
  siteLang?: string;
  hostIP?: string;
  lastChecked?: Date | string;
  overallScore: number;
};

export function ReportHeader({
  url,
  domain,
  faviconUrl,
  status,
  isHttps,
  cms,
  siteLang,
  hostIP,
  lastChecked,
  overallScore,
}: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "bg-green-50 dark:bg-green-900/20";
    if (score >= 70) return "bg-yellow-50 dark:bg-yellow-900/20";
    return "bg-red-50 dark:bg-red-900/20";
  };

  // Helper to get CMS-specific color
  const getCMSColor = (type?: string) => {
    const colors: Record<string, string> = {
      wordpress: "text-[#21759B]", // WordPress blue
      shopify: "text-[#95BF47]", // Shopify green
      drupal: "text-[#009CDE]", // Drupal blue
      magento: "text-[#F26322]", // Magento orange
      webflow: "text-[#146EF5]", // Webflow blue
      wix: "text-[#0C6EFC]", // Wix blue
    };
    return type
      ? colors[type] || "text-gray-600 dark:text-gray-400"
      : "text-gray-600 dark:text-gray-400";
  };

  // Helper to render CMS icon
  const renderCMSIcon = () => {
    if (!cms) return null;

    // Check if icon is a React component
    if (cms.icon && typeof cms.icon !== "string") {
      const IconComponent = cms.icon as ComponentType<{
        size?: number;
        className?: string;
      }>;
      return <IconComponent size={16} className={getCMSColor(cms.type)} />;
    }

    // Use emoji from icon field
    if (cms.icon && typeof cms.icon === "string") {
      return <span className="text-sm">{cms.icon}</span>;
    }

    // Fallback to iconEmoji
    if (cms.iconEmoji) {
      return <span className="text-sm">{cms.iconEmoji}</span>;
    }

    return null;
  };

  return (
    <div className="mb-8">
      {/* Site Info Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="rounded-2xl border p-4 shadow-sm bg-white/80 dark:bg-neutral-900/70 flex items-start gap-4 flex-1 min-w-0">
          {/* Favicon */}
          {faviconUrl && (
            <div className="h-9 w-9 rounded-md border bg-white flex items-center justify-center overflow-hidden">
              <img
                src={faviconUrl}
                alt={`${domain} favicon`}
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Site Title & URL */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 truncate">
              {domain}
            </h1>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
            >
              {url}
            </a>
          </div>
        </div>

        {/* Overall Score */}
        <div
          className={`flex-shrink-0 px-6 py-4 rounded-lg ${getScoreBgColor(
            overallScore
          )}`}
        >
          <div className="text-center">
            <div
              className={`text-3xl font-bold ${getScoreColor(overallScore)}`}
            >
              {overallScore}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Overall Score
            </div>
          </div>
        </div>
      </div>

      {/* Meta Information Badges */}
      <div className="flex flex-wrap gap-2">
        {/* HTTPS Status */}
        <Badge
          variant={isHttps ? "default" : "destructive"}
          className="gap-1.5"
        >
          <Shield className="w-3 h-3" />
          {isHttps ? "HTTPS" : "HTTP"}
        </Badge>

        {/* HTTP Status */}
        {status && (
          <Badge
            variant={status === 200 ? "default" : "secondary"}
            className="gap-1.5"
          >
            <Globe className="w-3 h-3" />
            Status {status}
          </Badge>
        )}

        {/* CMS Info with Icon */}
        {cms && (
          <Badge variant="secondary" className="gap-1.5">
            {renderCMSIcon()}
            <span>{cms.name}</span>
          </Badge>
        )}

        {/* Language */}
        {siteLang && (
          <Badge variant="secondary" className="gap-1.5">
            <Globe className="w-3 h-3" />
            {siteLang.toUpperCase()}
          </Badge>
        )}

        {/* Host IP */}
        {hostIP && (
          <Badge variant="secondary" className="gap-1.5">
            <Server className="w-3 h-3" />
            {hostIP}
          </Badge>
        )}

        {/* Last Checked */}
        {lastChecked && (
          <Badge variant="outline" className="gap-1.5">
            <Clock className="w-3 h-3" />
            {typeof lastChecked === "string"
              ? lastChecked
              : formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
          </Badge>
        )}
      </div>
    </div>
  );
}
