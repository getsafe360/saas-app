// app/[locale]/(dashboard)/dashboard/components/SiteCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Globe,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { CMSIcon } from "@/components/ui/cms-icon";
import { getCMSIcon } from "@/lib/cms-icons";
import { formatDistanceToNow } from "date-fns";

interface SiteCardProps {
  site: {
    id: string;
    url: string;
    domain: string;
    status: string;
    cms: string | null;
    overallScore: number;
    scores: any;
    findingCount: number;
    lastUpdated: string;
    faviconUrl: string | null;
    connectionStatus: string;
    screenshotUrl: string | null;
  };
  onRemove?: (siteId: string) => void;
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <path
        d="M14.0914 0.721827C14.1534 0.535432 14.4171 0.535433 14.4791 0.721828L14.8291 1.77428C15.0324 2.38523 15.5117 2.8646 16.1227 3.06782L17.1751 3.41791C17.3615 3.47991 17.3615 3.74357 17.1751 3.80557L16.1227 4.15565C15.5117 4.35888 15.0324 4.83825 14.8291 5.4492L14.4791 6.50165C14.4171 6.68804 14.1534 6.68804 14.0914 6.50165L13.7413 5.4492C13.5381 4.83825 13.0587 4.35888 12.4478 4.15565L11.3953 3.80557C11.2089 3.74357 11.2089 3.47991 11.3953 3.41791L12.4478 3.06782C13.0587 2.8646 13.5381 2.38523 13.7413 1.77428L14.0914 0.721827Z"
        fill="currentColor"
      />
      <path
        d="M7.775 2.61733C7.93004 2.15141 8.58899 2.15137 8.74399 2.61733L9.68369 5.44228C10.1511 6.84743 11.2537 7.94995 12.6588 8.41738L15.4837 9.35781C15.9497 9.51282 15.9497 10.1718 15.4837 10.3268L15.1212 10.4469L12.6588 11.2665L12.3988 11.3617C11.1182 11.8732 10.1219 12.9243 9.68369 14.2416L8.86411 16.704L8.74399 17.0666L8.70883 17.1486C8.5215 17.5054 7.99668 17.5055 7.80942 17.1486L7.775 17.0666L6.83457 14.2416C6.39635 12.9243 5.40012 11.8731 4.11948 11.3617L3.85947 11.2665L1.03452 10.3268C0.568551 10.1718 0.568594 9.51286 1.03452 9.35781L1.39633 9.23696L3.85947 8.41738C5.17688 7.97916 6.22869 6.98304 6.74008 5.70229L6.83457 5.44228L7.775 2.61733ZM8.25839 5.91616C7.68028 7.65406 6.36564 9.04128 4.67612 9.71596L4.33335 9.84121L4.32968 9.84194L4.33335 9.84341L4.67612 9.96865C6.36559 10.6434 7.68031 12.0306 8.25839 13.7685L8.25913 13.7714L8.26059 13.7685L8.38584 13.4257C9.06049 11.736 10.4476 10.4215 12.1856 9.84341L12.1886 9.84194L12.1856 9.84121C10.4478 9.26312 9.06055 7.9484 8.38584 6.25893L8.26059 5.91616L8.25913 5.9125L8.25839 5.91616Z"
        fill="currentColor"
      />
    </svg>
  );
}

// cx=60, cy=58, r=46 → arc from (14,58) to (106,58), top at (60,12)
// pathLength = π*46 ≈ 144.5
function ScoreGauge({
  score,
  isNew,
  uid,
}: {
  score: number;
  isNew: boolean;
  uid: string;
}) {
  const cx = 60,
    cy = 58,
    r = 46;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const pathLength = Math.PI * r;
  const fillDash = (score / 100) * pathLength;

  // score=0 → needle left (π), score=100 → needle right (0)
  const angle = Math.PI * (1 - score / 100);
  const needleLen = 36;
  const needleX = cx + needleLen * Math.cos(angle);
  const needleY = cy - needleLen * Math.sin(angle);

  const gradId = `gg-${uid}`;

  return (
    <div>
      <svg viewBox="0 0 120 68" className="w-full max-w-[196px] mx-auto block">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-danger)" />
            <stop offset="50%" stopColor="var(--color-warning)" />
            <stop offset="100%" stopColor="var(--color-success)" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-neutral-300)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Colored fill up to score position */}
        {!isNew && (
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${fillDash} ${pathLength + 20}`}
          />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={isNew ? "var(--color-neutral-400)" : "var(--text-subtle)"}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Pivot dot */}
        <circle
          cx={cx}
          cy={cy}
          r="3.5"
          fill={isNew ? "var(--color-neutral-400)" : "var(--text-default)"}
        />

        {/* Score text (renders above needle) */}
        {isNew ? (
          <text
            x={cx}
            y={cy - 16}
            textAnchor="middle"
            fill="var(--color-neutral-400)"
            fontSize="8"
            fontWeight="500"
            letterSpacing="1.5"
          >
            NEW SITE
          </text>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fill="var(--text-default)"
              fontSize="22"
              fontWeight="700"
            >
              {score}
            </text>
            <text
              x={cx}
              y={cy - 1}
              textAnchor="middle"
              fill="var(--text-subtle)"
              fontSize="9"
            >
              / 100
            </text>
          </>
        )}
      </svg>

      {isNew && (
        <p className="text-[11px] leading-snug text-[var(--text-subtle)] text-center mt-1 px-3">
          Run your first analysis and auto-optimize
        </p>
      )}
    </div>
  );
}

const PILLARS = [
  { key: "seo", label: "SEO", color: "var(--category-seo)" },
  { key: "performance", label: "Perf", color: "var(--category-performance)" },
  { key: "security", label: "Sec", color: "var(--category-security)" },
  {
    key: "accessibility",
    label: "A11y",
    color: "var(--category-accessibility)",
  },
] as const;

function PillarChips({ scores }: { scores: any }) {
  if (!scores) return null;
  const hasPillar = PILLARS.some((p) => scores[p.key] != null);
  if (!hasPillar) return null;

  return (
    <div className="grid grid-cols-2 gap-1.5 mt-3">
      {PILLARS.map(({ key, label, color }) => {
        const val = scores[key];
        if (val == null) return null;
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border"
            style={{
              borderColor: `oklch(from ${color} l c h / 0.3)`,
              background: `oklch(from ${color} l c h / 0.08)`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="text-[10px] text-[var(--text-subtle)]">
              {label}
            </span>
            <span className="ml-auto text-[10px] font-semibold text-[var(--text-default)]">
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SiteCard({ site, onRemove }: SiteCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // A site is analyzed when lastScores is present (scores != null), even if overall=0
  const isAnalyzed = site.scores != null;
  const cmsIconData = getCMSIcon(site.cms);

  const faviconSrc = faviconError
    ? null
    : site.faviconUrl ||
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.url)}&size=32`;

  let timeAgo = "Unknown";
  try {
    timeAgo = formatDistanceToNow(new Date(site.lastUpdated), {
      addSuffix: true,
    });
  } catch {}

  const handleAction = () => {
    setIsLoading(true);
    router.push(
      isAnalyzed
        ? `/dashboard/sites/${site.id}/cockpit`
        : `/dashboard/sites/${site.id}/analyze`,
    );
  };

  return (
    <Card className="group border border-blue-200/70 dark:border-blue-800/50 hover:border-blue-400/80 dark:hover:border-blue-500/70 hover:shadow-[var(--shadow-md)] transition-all duration-200 bg-[var(--card-bg)]">
      <CardContent className="p-5">
        {/* ── Header: screenshot thumbnail + favicon + domain ── */}
        <div className="flex items-start gap-3 mb-4">
          {/* Screenshot thumbnail */}
          <div className="flex-shrink-0 w-[68px] h-12 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border-default)] bg-[var(--color-neutral-200)]">
            {site.screenshotUrl ? (
              <img
                src={site.screenshotUrl}
                alt=""
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Globe className="w-5 h-5 text-[var(--text-subtle)]" />
              </div>
            )}
          </div>

          {/* Favicon + domain + URL */}
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--color-neutral-200)] flex items-center justify-center p-1 mt-0.5 overflow-hidden">
              {faviconSrc ? (
                <img
                  src={faviconSrc}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Globe className="w-4 h-4 text-[var(--text-subtle)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-[var(--text-default)] truncate leading-tight">
                {site.domain}
              </h3>
              <p className="text-[11px] text-[var(--text-subtle)] truncate mt-0.5">
                {site.url.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Hairline divider ── */}
        <div className="h-px bg-[var(--border-default)] mb-4" />

        {/* ── Score gauge ── */}
        <ScoreGauge
          score={site.overallScore}
          isNew={!isAnalyzed}
          uid={site.id}
        />

        {/* ── Pillar mini-score chips (analyzed only) ── */}
        {isAnalyzed && <PillarChips scores={site.scores} />}

        {/* ── Hairline divider ── */}
        <div className="h-px bg-[var(--border-default)] my-4" />

        {/* ── Meta row: issues · timestamp · CMS · connection ── */}
        <div className="space-y-1.5 mb-4">
          {isAnalyzed && site.findingCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <AlertCircle
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--color-warning)" }}
              />
              <span>
                {site.findingCount}{" "}
                {site.findingCount === 1 ? "issue" : "issues"} found
              </span>
            </div>
          )}
          {isAnalyzed && site.findingCount === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <CheckCircle
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--color-success)" }}
              />
              <span>No issues found</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[var(--text-subtle)]">
            {/* Timestamp */}
            <div className="flex items-center gap-1 min-w-0">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Updated {timeAgo}</span>
            </div>

            {/* CMS + connection */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {site.cms && (
                <span className="flex items-center gap-1">
                  <CMSIcon cms={site.cms} size={12} showFallback={false} />
                  <span className="text-[10px]">
                    {cmsIconData?.name || site.cms}
                  </span>
                </span>
              )}
              {site.connectionStatus === "connected" ? (
                <span style={{ color: "var(--color-success)" }}>
                  ● Connected
                </span>
              ) : (
                <span className="text-[var(--text-subtle)]">
                  ○ Disconnected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Primary CTA: ✨ Auto-Optimize ── */}
        <Button
          onClick={handleAction}
          disabled={isLoading}
          className="w-full font-semibold ring-1 ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20 transition transition-all duration-150 disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <SparkleIcon className="mr-2 h-4 w-4 opacity-90 flex-shrink-0" />
          )}
          {isLoading
            ? isAnalyzed
              ? "Opening…"
              : "Starting…"
            : "Auto-Optimize"}
        </Button>

        {/* ── Remove link ── */}
        {onRemove && (
          <button
            onClick={() => onRemove(site.id)}
            title="Remove this site from your dashboard"
            className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--color-danger)] transition-colors w-full cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Remove site
          </button>
        )}
      </CardContent>
    </Card>
  );
}
