// saas-ux/components/analyzer/SiteIdentityCard.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Globe, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { WordPressIcon } from "../../icons/WordPress";

type WordPressMeta = {
  version?: string | null;
  jsonApi: boolean | null;
  xmlrpc: boolean | null;
};

type Cms =
  | { type: "wordpress"; signals?: string[]; wp?: WordPressMeta }
  | { type: "unknown" }
  | { type: string; [key: string]: any };

type Props = {
  className?: string;
  domain: string;
  finalUrl: string;
  status: number;
  isHttps: boolean;
  faviconUrl?: string | null;
  siteLang?: string | null; // detected from HTML
  uiLocale: string; // current UI locale (kept for future)
  cms: Cms;
  compact?: boolean; // NEW: hide large screenshot when true
};

export default function SiteIdentityCard({
  className,
  domain,
  finalUrl,
  status,
  isHttps,
  faviconUrl,
  siteLang,
  uiLocale,
  cms,
  compact = false,
}: Props) {
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);

  const StatusIcon =
    status >= 200 && status < 400
      ? CheckCircle2
      : status >= 400 && status < 500
      ? AlertTriangle
      : ShieldCheck;

  const isWP = cms.type === "wordpress";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm bg-white/80 dark:bg-neutral-900/70",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* favicon */}
        <div className="h-9 w-9 rounded-md border bg-white flex items-center justify-center overflow-hidden">
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faviconUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Globe className="h-5 w-5 text-neutral-500" />
          )}
        </div>

        <div className="min-w-0">
          <div className="text-sm text-neutral-500 truncate">{domain}</div>
          <div className="text-base font-semibold truncate">{finalUrl}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
              isHttps
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {isHttps ? "HTTPS" : "HTTP"} • {status}
          </span>

          {siteLang && (
            <span className="rounded-full bg-sky-50 text-sky-700 px-2 py-1 text-xs">
              Detected: {siteLang}
            </span>
          )}

          {isWP && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2 py-1 text-xs">
              <WordPressIcon size={12} />
              WP{cms.wp?.version ? ` ${cms.wp.version}` : ""}
              {cms.wp?.jsonApi ? " • REST" : ""}
              {cms.wp?.xmlrpc ? " • XML-RPC" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
