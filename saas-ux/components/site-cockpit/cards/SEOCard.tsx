// components/site-cockpit/cards/SEOCard.tsx
import { CockpitCard } from "./CockpitCard";
import { CheckCircle, XCircle } from "lucide-react";
import type { SEOData } from "@/types/site-cockpit";

interface SEOCardProps {
  data: SEOData;
}

export function SEOCard({ data }: SEOCardProps) {
  const title = data.meta?.title;
  const description = data.meta?.description;

  return (
    <CockpitCard id="seo" category="seo" title="SEO" score={data.score} grade={data.grade}>
      <div className="space-y-4">
        {title && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title Tag</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{title}</p>
          </div>
        )}

        {description && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Meta Description</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400">Word Count</div>
            <div className="font-medium">{data.content.wordCount}</div>
          </div>
          <div className="rounded-lg border border-slate-700/40 p-2">
            <div className="text-slate-400">Missing Alt</div>
            <div className="font-medium">{data.images.missingAlt}</div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Canonical</span>
            {data.meta.hasCanonical ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Structured data</span>
            {data.structuredData.present ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          </div>
        </div>
      </div>
    </CockpitCard>
  );
}
