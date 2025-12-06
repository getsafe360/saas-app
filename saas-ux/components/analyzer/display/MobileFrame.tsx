// components/analyzer/display/MobileFrame.tsx
"use client";

import { useState } from "react";
import ScreenshotFallback from "./ScreenshotFallback";

type Props = {
  screenshotUrl: string;
  lowResUrl?: string;
};

export default function MobileFrame({ screenshotUrl, lowResUrl }: Props) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative">
      {/* iPhone Frame */}
      <div className="relative mx-auto w-[300px] rounded-[2.5rem] border-[12px] border-neutral-800 bg-neutral-800 shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-32 -translate-x-1/2 rounded-b-3xl bg-neutral-800" />

        {/* Screen */}
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-white">
          {hasError ? (
            <ScreenshotFallback />
          ) : (
            <img
              src={screenshotUrl}
              alt="Mobile screenshot"
              className="h-full w-full object-cover object-top"
              loading="lazy"
              onError={() => setHasError(true)}
            />
          )}
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/30" />
      </div>
    </div>
  );
}
