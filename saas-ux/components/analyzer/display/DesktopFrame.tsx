// components/analyzer/display/DesktopFrame.tsx
"use client";

import { useState } from "react";
import ScreenshotFallback from "./ScreenshotFallback";

type Props = {
  screenshotUrl: string;
  lowResUrl?: string;
  url?: string; // Add URL prop
};

export default function DesktopFrame({ screenshotUrl, lowResUrl, url }: Props) {
  const [hasError, setHasError] = useState(false);

  // Extract clean domain from URL
  const displayUrl = url
    ? (() => {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.replace("www.", ""); // Remove www. for cleaner look
        } catch {
          return url;
        }
      })()
    : "example.com";

  return (
    <div className="relative w-full">
      {/* Browser Chrome */}
      <div className="rounded-t-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 rounded bg-neutral-100 dark:bg-neutral-700 px-3 py-1 text-xs text-neutral-500 truncate">
            {displayUrl}
          </div>
        </div>
      </div>

      {/* Screenshot */}
      <div className="relative aspect-[16/10] overflow-hidden rounded-b-xl border-x border-b border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900">
        {hasError ? (
          <ScreenshotFallback />
        ) : (
          <img
            src={screenshotUrl}
            alt="Desktop screenshot"
            className="h-full w-full object-cover object-top"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );
}
