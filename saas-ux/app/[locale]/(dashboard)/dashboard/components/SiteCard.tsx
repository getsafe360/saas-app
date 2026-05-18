// app/[locale]/(dashboard)/dashboard/components/SiteCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { DashboardIcon } from "@/components/icons/DashboardIcon";
import { formatDistanceToNow } from "date-fns";
import { de, es, fr, it, ptBR, enUS } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

const dateFnsLocales: Record<string, DateFnsLocale> = {
  en: enUS,
  de,
  es,
  fr,
  it,
  pt: ptBR,
};

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
  isNew?: boolean;
}

// cx=60, cy=58, r=46 → arc from (14,58) to (106,58), top at (60,12)
// pathLength = π*46 ≈ 144.5
function ScoreGauge({
  score,
  isNew,
  uid,
  newSiteLabel,
  newSitePrompt,
}: {
  score: number;
  isNew: boolean;
  uid: string;
  newSiteLabel: string;
  newSitePrompt: string;
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

  // Needle + pivot reflect score health when analyzed
  const gaugeColor = isNew
    ? "var(--color-neutral-400)"
    : score >= 70
    ? "var(--color-success)"
    : score >= 40
    ? "var(--color-warning)"
    : "var(--color-danger)";

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

        {/* Colored fill — only rendered when score > 0 to avoid red dot artifact at 0 */}
        {!isNew && score > 0 && (
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
          stroke={gaugeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Pivot dot */}
        <circle
          cx={cx}
          cy={cy}
          r="3.5"
          fill={gaugeColor}
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
            {newSiteLabel}
          </text>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fill="var(--text-default)"
              fontSize="18"
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
          {newSitePrompt}
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

export function SiteCard({ site, onRemove, isNew = false }: SiteCardProps) {
  const t = useTranslations("siteCard");
  const router = useRouter();
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [highlight, setHighlight] = useState(isNew);

  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => setHighlight(false), 3000);
    return () => clearTimeout(timer);
  }, [isNew]);

  // A site is analyzed only when real scores exist (overall != null).
  const isAnalyzed = (site.scores as any)?.overall != null;
  const noIssues = isAnalyzed && site.findingCount === 0;
  const cmsIconData = getCMSIcon(site.cms);

  const faviconSrc = faviconError
    ? null
    : site.faviconUrl ||
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(site.url)}&size=32`;

  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(new Date(site.lastUpdated), {
      addSuffix: true,
      locale: dateFnsLocales[locale] ?? enUS,
    });
  } catch {}

  const handleAction = () => {
    setIsLoading(true);
    router.push(`/${locale}/dashboard/sites/${site.id}/cockpit`);
  };

  return (
    <Card
      id={`site-card-${site.id}`}
      className={[
        "group border transition-all duration-200",
        highlight
          ? "border-sky-400 dark:border-sky-400 ring-2 ring-sky-400/40 dark:ring-sky-400/40"
          : "border-blue-200/70 dark:border-blue-800/50 hover:border-blue-400/80 dark:hover:border-blue-500/70",
      ].join(" ")}
    >
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
            {/* Favicon tile — minimal padding so icon fills the space */}
            <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--color-neutral-200)] flex items-center justify-center p-0.5 mt-0.5 overflow-hidden">
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
              {(site.scores as any)?.pageTitle ? (
                <p className="text-[11px] text-[var(--text-subtle)] mt-0.5 leading-snug">
                  {(site.scores as any).pageTitle}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--text-subtle)] mt-0.5 leading-snug">
                  {site.url.replace(/^https?:\/\//, "")}
                </p>
              )}
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
          newSiteLabel={t("new_site_label")}
          newSitePrompt={t("new_site_prompt")}
        />

        {/* ── Pillar mini-score chips (analyzed only) ── */}
        {isAnalyzed && <PillarChips scores={site.scores} />}

        {/* ── Hairline divider ── */}
        <div className="h-px bg-[var(--border-default)] my-4" />

        {/* ── Meta rows: issues · timestamp · CMS · connection ── */}
        <div className="space-y-1.5 mb-4">
          {isAnalyzed && site.findingCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <AlertCircle
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--color-warning)" }}
              />
              <span>
                {t("issues_found", { count: site.findingCount })}
              </span>
            </div>
          )}
          {isAnalyzed && noIssues && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)]">
              <CheckCircle
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--color-success)" }}
              />
              <span>{t("no_issues")}</span>
            </div>
          )}

          {/* Timestamp row — no truncation */}
          <div className="flex items-center gap-1 text-xs text-[var(--text-subtle)]">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{t("updated", { timeAgo })}</span>
          </div>

          {/* CMS + connection on its own line */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
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
                ● {t("connected")}
              </span>
            ) : (
              <span className="text-[var(--text-subtle)]">
                ○ {t("disconnected")}
              </span>
            )}
          </div>
        </div>

        {/* ── Primary CTA: Site-Cockpit ── */}
        <Button
          onClick={handleAction}
          disabled={isLoading}
          variant="site-action"
          size="sm"
          className="w-full max-w-full flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DashboardIcon className="w-4 h-4 flex-shrink-0" />
          )}
          {isLoading
            ? isAnalyzed
              ? t("opening")
              : t("starting")
            : t("site_cockpit")}
        </Button>

        {/* ── Remove link ── */}
        {onRemove && (
          <button
            onClick={() => onRemove(site.id)}
            title={t("remove_site")}
            className="mt-3 flex items-center justify-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--color-danger)] transition-colors w-full cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            {t("remove_site")}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
