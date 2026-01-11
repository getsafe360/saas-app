// components/onboarding/ShareButtons.tsx
"use client";

import { Share2, Twitter, Linkedin, Link2, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface ShareButtonsProps {
  url: string;
  score: number;
  grade?: string;
  title?: string;
  hashtags?: string[];
}

/**
 * Social sharing buttons for test results
 */
export function ShareButtons({
  url,
  score,
  grade = "A",
  title,
  hashtags = ["WebPerformance", "SiteOptimization"],
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareText = title
    ? `I just analyzed ${url} with GetSafe 360 and got a ${score}/100 (Grade ${grade})! ${title}`
    : `I just analyzed ${url} with GetSafe 360 and got a ${score}/100 (Grade ${grade})! 🚀`;

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}&hashtags=${hashtags.join(",")}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const handleLinkedInShare = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareUrl
    )}`;
    window.open(linkedInUrl, "_blank", "width=600,height=600");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Site Analysis Results",
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.error("Share failed:", error);
      }
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && navigator.share;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <Share2 className="w-4 h-4" />
        <span>Share your results</span>
      </div>

      {/* Share buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Twitter */}
        <button
          onClick={handleTwitterShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-medium text-sm transition-colors"
        >
          <Twitter className="w-4 h-4" />
          <span>Twitter</span>
        </button>

        {/* LinkedIn */}
        <button
          onClick={handleLinkedInShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white font-medium text-sm transition-colors"
        >
          <Linkedin className="w-4 h-4" />
          <span>LinkedIn</span>
        </button>

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
            copied
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        {/* Native Share (mobile) */}
        {canNativeShare && (
          <button
            onClick={handleNativeShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Share your results and help others discover GetSafe 360
      </p>
    </div>
  );
}
