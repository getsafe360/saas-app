// components/analyzer/display/ScreenshotSection.tsx
"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import DesktopFrame from "./DesktopFrame";
import MobileFrame from "./MobileFrame";
import StreamingIntroText from "./StreamingIntroText";

type Props = {
  desktopScreenshotUrl: string;
  mobileScreenshotUrl: string;
  locale: string;
  isAnalyzing: boolean;
  url: string;
};

export default function ScreenshotSection({
  desktopScreenshotUrl,
  mobileScreenshotUrl,
  locale,
  isAnalyzing,
  url,
}: Props) {
  const [activeView, setActiveView] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="mb-8">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Screenshots */}
        <div>
          {/* View Toggle */}
          <div className="mb-4 flex justify-center lg:justify-start">
            <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1">
              <button
                onClick={() => setActiveView("desktop")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeView === "desktop"
                    ? "bg-sky-500 text-white"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <Monitor className="h-4 w-4" />
                Desktop
              </button>
              <button
                onClick={() => setActiveView("mobile")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  activeView === "mobile"
                    ? "bg-sky-500 text-white"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <Smartphone className="h-4 w-4" />
                Mobile
              </button>
            </div>
          </div>

          {/* Screenshot Display */}
          <div className="flex justify-center lg:justify-start">
            {activeView === "desktop" ? (
              <DesktopFrame screenshotUrl={desktopScreenshotUrl} url={url} />
            ) : (
              <MobileFrame screenshotUrl={mobileScreenshotUrl} />
            )}
          </div>
        </div>

        {/* Right Column: Streaming Intro */}
        <div className="flex items-center">
          <StreamingIntroText locale={locale} />
        </div>
      </div>
    </div>
  );
}
