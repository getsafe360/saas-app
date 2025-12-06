// components/analyzer/display/ReportHero.tsx
"use client";

import ScorePills from "./ScorePills";
import CoPilotDrawer from "./CoPilotDrawer";
import CTA from "@/components/marketing/CTA";
import { ReportHeader } from "./ReportHeader";
import ScreenshotSection from "./ScreenshotSection";
import type { CMSSignature } from "@/components/analyzer/cms/cms-signatures";

type Props = {
  url: string;
  domain: string;
  faviconUrl?: string;
  status?: number;
  isHttps: boolean;
  cms?: CMSSignature | null; // Updated to accept full CMS signature object
  cmsLabel?: string; // Deprecated, kept for backwards compatibility
  siteLang?: string;
  hostIP?: string;
  lastChecked?: Date | string;
  screenshotUrl?: string;
  mobileUrl?: string;
  locale: string;
  pillars: {
    seo: any;
    a11y: any;
    perf: any;
    sec: any;
  };
  quickScores?: {
    seo: number;
    a11y: number;
    perf: number;
    sec: number;
    overall: number;
  };
  isAnalyzing?: boolean;
  children?: React.ReactNode;
};

export default function ReportHero({
  url,
  domain,
  faviconUrl,
  status,
  isHttps,
  cms,
  cmsLabel, // Legacy support
  siteLang,
  hostIP,
  lastChecked,
  screenshotUrl,
  mobileUrl,
  locale,
  pillars,
  quickScores,
  isAnalyzing = false,
  children,
}: Props) {
  // Calculate scores if not provided
  const scores = quickScores ?? {
    seo: calculatePillarScore(pillars.seo),
    a11y: calculatePillarScore(pillars.a11y),
    perf: calculatePillarScore(pillars.perf),
    sec: calculatePillarScore(pillars.sec),
    overall: calculateOverallScore(pillars),
  };

  // Handle CMS display - use new cms object or fallback to legacy cmsLabel
  const cmsDisplay = cms
    ? {
        name: cms.name,
        icon: cms.icon,
        iconEmoji: cms.iconEmoji,
        type: cms.type,
      }
    : cmsLabel
    ? {
        name: cmsLabel,
        iconEmoji: "🔧",
        type: "custom" as const,
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <ReportHeader
        url={url}
        domain={domain}
        faviconUrl={faviconUrl}
        status={status}
        isHttps={isHttps}
        cms={cmsDisplay}
        siteLang={siteLang}
        hostIP={hostIP}
        lastChecked={lastChecked}
        overallScore={scores.overall}
      />

      {/* Screenshot + Intro */}
      <ScreenshotSection
        desktopScreenshotUrl={screenshotUrl ?? ""}
        mobileScreenshotUrl={mobileUrl ?? ""}
        locale={locale}
        isAnalyzing={isAnalyzing}
        url={url}
      />

      {/* Score Pills */}
      <ScorePills scores={scores} counts={pillars} />

      {/* CTA */}
      <div className="mb-8">
        <CTA />
      </div>

      {/* Findings (passed as children) */}
      {children}

      {/* Co-Pilot Drawer */}
      <CoPilotDrawer />
    </div>
  );
}

// Utility functions
function calculatePillarScore(counts: {
  pass: number;
  warn: number;
  crit: number;
}): number {
  const total = counts.pass + counts.warn + counts.crit;
  if (total === 0) return 100;
  return Math.round(((counts.pass + counts.warn * 0.5) / total) * 100);
}

function calculateOverallScore(pillars: Props["pillars"]): number {
  const scores = [
    calculatePillarScore(pillars.seo),
    calculatePillarScore(pillars.a11y),
    calculatePillarScore(pillars.perf),
    calculatePillarScore(pillars.sec),
  ];
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
