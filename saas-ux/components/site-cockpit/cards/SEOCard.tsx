// components/site-cockpit/cards/SEOCard.tsx
import { CockpitCard } from "../CockpitCard";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { SEOData } from "@/types/site-cockpit";

interface SEOCardProps {
  data: SEOData;
}

export function SEOCard({ data }: SEOCardProps) {
  const title = (data as any).title as string | undefined;
  const description = (data as any).description as string | undefined;

  return (
    <CockpitCard id="seo" category="seo" title="SEO" score={data.score}>
      {/* Title */}
      {title && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Title Tag
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {title}
          </p>
        </div>
      )}

      {/* Description */}
      {description && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Meta Description
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {description}
          </p>
        </div>
      )}

      {/* Keywords */}
      {(data as any).keywords && (data as any).keywords.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Keywords
          </h4>
          <div className="flex flex-wrap gap-2">
            {(data as any).keywords.slice(0, 5).map((keyword: string) => (
              <span
                key={keyword}
                className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content Quality */}
      {data.content && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Content Analysis
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Word Count
              </span>
              <span className="text-sm font-medium">
                {data.content.wordCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Reading Time
              </span>
              <span className="text-sm font-medium">
                {data.content.readingTime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Language
              </span>
              <span className="text-sm font-medium uppercase">
                {data.content.language}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AI Readiness */}
      {data.aiReadiness && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            AI Readiness
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Overall Score
              </span>
              <span className="text-sm font-medium">
                {data.aiReadiness.score}%
              </span>
            </div>
            {(data.aiReadiness as any).structuredData !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Structured Data
                </span>
                {(data.aiReadiness as any).structuredData ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issues */}
      {(data as any).issues && (data as any).issues.length > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Issues to Fix
          </h4>
          <ul className="space-y-1">
            {(data as any).issues
              .slice(0, 3)
              .map((issue: string, idx: number) => (
                <li
                  key={idx}
                  className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                >
                  <span className="text-orange-500 mt-0.5">•</span>
                  <span>{issue}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </CockpitCard>
  );
}
