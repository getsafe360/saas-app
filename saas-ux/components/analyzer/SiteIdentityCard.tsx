// saas-ux/components/analyzer/SiteIdentityCard.tsx
"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { cn } from "@/lib/cn";
import { Globe, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { WordPressIcon } from "../icons/WordPress";

type WordPressMeta = {
  version?: string | null;
  jsonApi: boolean | null;
  xmlrpc: boolean | null;
};

type Cms =
  | { type: "wordpress"; signals: string[]; wp: WordPressMeta }
  | { type: "unknown" };

type Props = {
  className?: string;
  domain: string;
  finalUrl: string;
  status: number;
  isHttps: boolean;
  faviconUrl?: string | null;
  siteLang?: string | null; // detected from HTML
  uiLocale: string;         // current UI locale (not used yet, kept for future)
  cms: Cms;
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
}: Props) {
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);

  // lazy-load screenshot when mounted (use DOM Image via window.Image)
  useEffect(() => {
    const url = `/api/screenshot?url=${encodeURIComponent(finalUrl)}`;
    // guard for SSR even though we're in a client component
    if (typeof window === "undefined" || !("Image" in window)) return;

    const img = new window.Image();
    img.onload = () => setScreenshotSrc(url);
    img.onerror = () => setScreenshotSrc(null);
    img.src = url;

    return () => {
      // help GC in some browsers
      img.onload = null as any;
      img.onerror = null as any;
    };
  }, [finalUrl]);

  const StatusIcon =
    status >= 200 && status < 400 ? CheckCircle2 : status >= 400 && status < 500 ? AlertTriangle : ShieldCheck;

  const isWP = cms.type === "wordpress";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm bg-white/80 dark:bg-neutral-900/70", className)}>
      <div className="flex items-center gap-3">
        {/* favicon */}
        <div className="h-9 w-9 rounded-md border bg-white flex items-center justify-center overflow-hidden">
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="" className="h-full w-full object-contain" />
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
              isHttps ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {isHttps ? "HTTPS" : "HTTP"} • {status}
          </span>

          {siteLang && (
            <span className="rounded-full bg-sky-50 text-sky-700 px-2 py-1 text-xs">Detected: {siteLang}</span>
          )}

            {isWP && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2 py-1 text-xs">
                <WordPressIcon size={12} className="text-purple-600" />
                WP{cms.wp.version ? ` ${cms.wp.version}` : ""} {cms.wp.jsonApi ? "• REST" : ""} {cms.wp.xmlrpc ? "• XML-RPC" : ""}
            </span>
            )}
        </div>
      </div>

      {/* screenshot */}
      <div className="mt-3 overflow-hidden rounded-xl border bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-800/40 dark:to-neutral-800/10">
        <div className={cn("aspect-[12/7] w-full", !screenshotSrc && "animate-pulse")}>
          {screenshotSrc ? (
            <div className="relative h-full w-full">
                <NextImage src={screenshotSrc} alt={`${domain} preview`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
            ) : (
            <div className="h-full w-full" />
            )}
        </div>
      </div>

      {/* WordPress note */}
      {isWP && (
        <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">
          <strong>WordPress detected.</strong> We’ll tailor checks and show a WP Toolbox in your control panel. Consider
          hiding version meta, limiting REST exposure, and disabling XML-RPC if unused.
        </div>
      )}
    </div>
  );
}
