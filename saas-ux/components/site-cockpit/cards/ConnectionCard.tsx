// components/site-cockpit/cards/ConnectionCard.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Globe,
  Link as LinkIcon,
  Code2,
  Key,
  Check,
  Copy,
  ChevronRight,
  Wifi,
  CheckCircle,
  Clock,
  Lock,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
  X,
  ShieldCheck,
  Wrench,
  Activity,
} from "lucide-react";
import { useWordPressPairing } from "./wordpress/hooks/useWordPressPairing";
import type { ConnectionStatus } from "./wordpress/types";

// ─── Platform config ──────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  recommendedMethod: "wordpress" | "snippet" | "apikey";
}

const PLATFORMS: Platform[] = [
  { id: "wordpress", name: "WordPress", recommendedMethod: "wordpress" },
  { id: "shopify", name: "Shopify", recommendedMethod: "snippet" },
  { id: "webflow", name: "Webflow", recommendedMethod: "snippet" },
  { id: "wix", name: "Wix", recommendedMethod: "snippet" },
  { id: "squarespace", name: "Squarespace", recommendedMethod: "snippet" },
  { id: "drupal", name: "Drupal", recommendedMethod: "snippet" },
  { id: "joomla", name: "Joomla", recommendedMethod: "snippet" },
  { id: "magento", name: "Magento / Adobe Commerce", recommendedMethod: "apikey" },
  { id: "custom", name: "Custom / HTML", recommendedMethod: "snippet" },
  { id: "unknown", name: "Other", recommendedMethod: "snippet" },
];

function detectPlatform(cmsType: string): Platform {
  return PLATFORMS.find((p) => p.id === cmsType.toLowerCase()) ?? PLATFORMS[PLATFORMS.length - 1];
}

/** Platforms whose name is a description rather than a brand. */
const TRANSLATED_PLATFORMS = new Set(["custom", "unknown"]);

type Translator = ReturnType<typeof useTranslations<"SiteCockpit.connection">>;

function platformName(platform: Platform, t: Translator): string {
  return TRANSLATED_PLATFORMS.has(platform.id) ? t(`platforms.${platform.id as "custom" | "unknown"}`) : platform.name;
}

/** Renders `<code>head</code>` in a message as the literal tag <head>. */
const headTag = (chunks: React.ReactNode) => (
  <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--background-default)" }}>
    &lt;{chunks}&gt;
  </code>
);

// ─── Uptime sparkline ─────────────────────────────────────────────────────────

function UptimeSparkline({ data }: { data: (0 | 1)[] }) {
  const t = useTranslations("SiteCockpit.connection");
  const w = 84;
  const h = 20;
  const gap = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * gap},${v === 1 ? 2 : h - 2}`)
    .join(" ");

  const upPct = Math.round((data.filter(Boolean).length / data.length) * 100);

  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke="var(--text-subtle)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
        {data.map((v, i) => (
          <circle
            key={i}
            cx={i * gap}
            cy={v === 1 ? 2 : h - 2}
            r="2.5"
            fill={v === 1 ? "var(--category-performance)" : "var(--status-critical, #ef4444)"}
          />
        ))}
      </svg>
      <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
        {t("uptime", { percent: upPct })}
      </span>
    </div>
  );
}

// ─── Code block with copy ─────────────────────────────────────────────────────

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
  const t = useTranslations("SiteCockpit.connection");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "var(--background-default)" }}>
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs"
        style={{ borderBottom: "1px solid var(--border-default)", color: "var(--text-subtle)" }}
      >
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors hover:opacity-80 cursor-pointer"
          style={{ color: "var(--text-subtle)" }}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto leading-relaxed" style={{ color: "var(--text-primary)" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Coming soon badge ────────────────────────────────────────────────────────

function SoonBadge() {
  const t = useTranslations("SiteCockpit.connection");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
      style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}
    >
      <Lock className="h-2 w-2" />
      {t("soon")}
    </span>
  );
}

// ─── Why connect? info modal ──────────────────────────────────────────────────

function MiniBenefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-3"
      style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center gap-2" style={{ color: "var(--color-primary-400, #60a5fa)" }}>
        {icon}
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>{text}</p>
    </div>
  );
}

const WITHOUT_CONNECTION = ["external", "perfSeo", "a11y", "headers", "structured"] as const;
const WITH_CONNECTION = ["workflows", "fixes", "diagnostics", "monitoring", "audit"] as const;

function SiteConnectionInfoModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("SiteCockpit.connection");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--header-bg)", border: "1px solid var(--border-default)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--color-primary-500) l c h / 0.12)", color: "var(--color-primary-400, #60a5fa)" }}
            >
              <Info className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("whyConnect")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70 cursor-pointer"
            style={{ color: "var(--text-subtle)" }}
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {t("info.lead")}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-subtle)" }}>
            {t("info.body")}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Without connection */}
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
                {t("info.withoutTitle")}
              </div>
              <ul className="space-y-1.5">
                {WITHOUT_CONNECTION.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-subtle)" }} />
                    {t(`info.without.${item}`)}
                  </li>
                ))}
              </ul>
            </div>

            {/* With connection */}
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "oklch(from var(--color-primary-500) l c h / 0.06)", border: "1px solid oklch(from var(--color-primary-500) l c h / 0.2)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-primary-400, #60a5fa)" }}>
                {t("info.withTitle")}
              </div>
              <ul className="space-y-1.5">
                {WITH_CONNECTION.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-primary-400, #60a5fa)" }} />
                    {t(`info.with.${item}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniBenefit
              icon={<ShieldCheck className="h-4 w-4" />}
              title={t("info.benefits.secure.title")}
              text={t("info.benefits.secure.text")}
            />
            <MiniBenefit
              icon={<Wrench className="h-4 w-4" />}
              title={t("info.benefits.actionable.title")}
              text={t("info.benefits.actionable.text")}
            />
            <MiniBenefit
              icon={<Activity className="h-4 w-4" />}
              title={t("info.benefits.ongoing.title")}
              text={t("info.benefits.ongoing.text")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConnectionCardProps {
  siteId?: string;
  siteUrl: string;
  cmsType?: string;
  connectionStatus?: ConnectionStatus;
  lastConnected?: string;
  wpVersion?: string;
  pluginVersion?: string;
}

type WizardStep = "detect" | "method" | "setup";
type ConnectionMethod = "wordpress" | "snippet" | "apikey";

interface ProvisionData {
  token: string;
  apiKey: string;
  snippet: string;
  uptime7d: (0 | 1)[];
}

export function ConnectionCard({
  siteId,
  siteUrl,
  cmsType = "unknown",
  connectionStatus = "disconnected",
  lastConnected,
  wpVersion,
  pluginVersion,
}: ConnectionCardProps) {
  const t = useTranslations("SiteCockpit.connection");
  const locale = useLocale();
  const platform = detectPlatform(cmsType);
  const platformLabel = platformName(platform, t);
  const [forceWizard, setForceWizard] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Live status can diverge from the server prop when a health check detects a change
  const [liveStatus, setLiveStatus] = useState<ConnectionStatus>(connectionStatus);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // After a hard-reload following WordPress pairing, sessionStorage carries a flag so
  // the banner still appears even though the component mounts already-connected.
  const SESSION_KEY = siteId ? `gs360_just_connected_${siteId}` : null;
  const [justConnected, setJustConnected] = useState(() => {
    if (typeof window === "undefined" || !SESSION_KEY) return false;
    const flag = sessionStorage.getItem(SESSION_KEY);
    if (flag) { sessionStorage.removeItem(SESSION_KEY); return true; }
    return false;
  });

  useEffect(() => {
    if (justConnected) {
      const t = setTimeout(() => setJustConnected(false), 4000);
      return () => clearTimeout(t);
    }
  }, [justConnected]);

  // Keep live status in sync when server-side props update (e.g. after router.refresh)
  useEffect(() => {
    setLiveStatus((prev) => {
      if (connectionStatus === "connected" && prev !== "connected") {
        setJustConnected(true);
      }
      return connectionStatus;
    });
  }, [connectionStatus]);

  const isConnected = liveStatus === "connected" && !forceWizard;

  const [step, setStep] = useState<WizardStep>("detect");
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>(
    platform.recommendedMethod,
  );
  const [provision, setProvision] = useState<ProvisionData | null>(null);
  const [isLoadingProvision, setIsLoadingProvision] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const router = useRouter();
  const pairing = useWordPressPairing(siteUrl, siteId);

  const fetchProvision = useCallback(async () => {
    if (!siteId) return;
    setIsLoadingProvision(true);
    try {
      const res = await fetch(`/api/connect/provision?siteId=${encodeURIComponent(siteId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setProvision(data);
      }
    } catch {
      /* silently fail */
    } finally {
      setIsLoadingProvision(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (step === "setup" && selectedMethod !== "wordpress") {
      void fetchProvision();
    }
  }, [step, selectedMethod, fetchProvision]);

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Connected state ────────────────────────────────────────────────────────
  if (isConnected) {
    const uptime7d = provision?.uptime7d ?? [1, 1, 1, 1, 1, 1, 1];
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
      >
        {justConnected && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4 text-sm font-medium animate-fade-in"
            style={{
              background: "oklch(from var(--category-performance) l c h / 0.12)",
              border: "1px solid oklch(from var(--category-performance) l c h / 0.3)",
              color: "var(--category-performance)",
            }}
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            {t("justConnected")}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: "oklch(from var(--category-performance) l c h / 0.12)",
                color: "var(--category-performance)",
              }}
            >
              <Wifi className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
                {t("title")}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {t("connectedTo", { platform: platformLabel })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!siteId) { void fetchProvision(); return; }
              setIsCheckingHealth(true);
              try {
                if (platform.id === "wordpress") {
                  const res = await fetch(`/api/sites/${siteId}/health`, { cache: "no-store" });
                  if (res.ok) {
                    const data = await res.json() as { healthy?: boolean };
                    if (data.healthy === false) {
                      setLiveStatus("disconnected");
                      setForceWizard(false);
                    }
                  }
                }
              } catch {
                /* ignore transient failures */
              } finally {
                setIsCheckingHealth(false);
              }
              void fetchProvision();
              router.refresh();
            }}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--text-subtle)" }}
            title={t("refresh")}
            aria-label={t("refresh")}
            disabled={isCheckingHealth}
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingHealth ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div>
            <div style={{ color: "var(--text-subtle)" }}>{t("platform")}</div>
            <div style={{ color: "var(--text-primary)" }}>{platformLabel}</div>
          </div>
          {lastConnected && (
            <div>
              <div style={{ color: "var(--text-subtle)" }}>{t("connectedSince")}</div>
              <div style={{ color: "var(--text-primary)" }}>
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(lastConnected))}
              </div>
            </div>
          )}
          {wpVersion && (
            <div>
              <div style={{ color: "var(--text-subtle)" }}>WordPress</div>
              <div style={{ color: "var(--text-primary)" }}>v{wpVersion}</div>
            </div>
          )}
          {pluginVersion && (
            <div>
              <div style={{ color: "var(--text-subtle)" }}>{t("plugin")}</div>
              <div style={{ color: "var(--text-primary)" }}>v{pluginVersion}</div>
            </div>
          )}
        </div>

        <UptimeSparkline data={uptime7d} />

        {/* Re-pair link */}
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
          <button
            onClick={() => {
              setForceWizard(true);
              setStep("method");
            }}
            className="text-xs underline opacity-50 hover:opacity-90 transition-opacity"
            style={{ color: "var(--text-subtle)" }}
          >
            {t("reconnect")}
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--header-bg)", borderColor: "var(--border-default)" }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--background-subtle, var(--header-bg))",
            color: "var(--text-subtle)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Wifi className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
            {t("title")}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {t("tagline")}
            </span>
            <button
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1 text-xs transition-colors cursor-pointer hover:opacity-70 shrink-0"
              style={{ color: "var(--text-primary)" }}
              aria-label={t("whyConnect")}
            >
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("whyConnect")}</span>
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: "var(--text-subtle)" }}>
          {(["detect", "method", "setup"] as WizardStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
              <span
                className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                  step === s ? "text-white" : ""
                }`}
                style={
                  step === s
                    ? { background: "var(--color-primary-500, #3b82f6)" }
                    : {}
                }
              >
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Detect */}
      {step === "detect" && (
        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-medium mb-3" style={{ color: "var(--text-subtle)" }}>
              {t("detect.detected")}
            </div>
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
            >
              <Globe className="h-5 w-5 shrink-0" style={{ color: "var(--text-subtle)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {platformLabel}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-subtle)" }}>{siteUrl}</div>
              </div>
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-subtle)" }}>
              {t("detect.wrong")}
            </div>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
              style={{
                background: "var(--background-default)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
              value={platform.id}
              onChange={(e) => {
                const p = PLATFORMS.find((x) => x.id === e.target.value);
                if (p) setSelectedMethod(p.recommendedMethod);
              }}
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>{platformName(p, t)}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep("method")}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 bg-blue-600 hover:bg-blue-700 active:brightness-95"
            >
              {t("continue")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Method selection */}
      {step === "method" && (
        <div className="p-5 space-y-3">
          <div className="text-xs font-medium mb-3" style={{ color: "var(--text-subtle)" }}>
            {t("method.title")}
          </div>

          {/* WordPress Plugin */}
          <button
            onClick={() => { setSelectedMethod("wordpress"); setStep("setup"); }}
            className="w-full flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all hover:brightness-125"
            style={{
              borderColor: selectedMethod === "wordpress" && platform.id === "wordpress"
                ? "var(--color-primary-500, #3b82f6)"
                : "var(--border-default)",
              background: "var(--background-default)",
            }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--category-wordpress, #3b82f6) l c h / 0.12)", color: "var(--category-wordpress, #60a5fa)" }}
            >
              <Wifi className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                {t("method.wordpress.title")}
                {platform.id === "wordpress" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-emerald-400 font-medium"
                    style={{ background: "oklch(from var(--category-performance) l c h / 0.12)" }}>
                    {t("recommended")}
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                {t("method.wordpress.description")}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* JS Snippet */}
          <button
            onClick={() => { setSelectedMethod("snippet"); setStep("setup"); }}
            className="w-full flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all hover:brightness-125"
            style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--category-performance) l c h / 0.12)", color: "var(--category-performance)" }}
            >
              <Code2 className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                {t("method.snippet.title")}
                {platform.id !== "wordpress" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-emerald-400 font-medium"
                    style={{ background: "oklch(from var(--category-performance) l c h / 0.12)" }}>
                    {t("recommended")}
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                {t.rich("method.snippet.description", { code: headTag })}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* API Key */}
          <button
            onClick={() => { setSelectedMethod("apikey"); setStep("setup"); }}
            className="w-full flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all hover:brightness-125"
            style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "oklch(from var(--category-security) l c h / 0.12)", color: "var(--category-security)" }}
            >
              <Key className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("method.apikey.title")}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                {t("method.apikey.description")}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* OAuth — coming soon */}
          <div
            className="flex items-center gap-3 rounded-xl border p-3 opacity-50 cursor-not-allowed"
            style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}
            >
              <ExternalLink className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-subtle)" }}>
                {t("method.oauth.title")}
                <SoonBadge />
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Vercel, Netlify, Cloudflare, GitHub Pages
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep("detect")}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: "var(--text-subtle)" }}
          >
            ← {t("back")}
          </button>
        </div>
      )}

      {showInfoModal && <SiteConnectionInfoModal onClose={() => setShowInfoModal(false)} />}

      {/* Step 3: Setup */}
      {step === "setup" && (
        <div className="p-5 space-y-4">
          {/* WordPress pairing flow */}
          {selectedMethod === "wordpress" && (
            <WordPressSetup pairing={pairing} />
          )}

          {/* JS Snippet */}
          {selectedMethod === "snippet" && (
            <SnippetSetup
              provision={provision}
              isLoading={isLoadingProvision}
              copiedKey={copiedKey}
              onCopy={handleCopy}
              siteId={siteId}
              onConfirmed={() => router.refresh()}
            />
          )}

          {/* API Key */}
          {selectedMethod === "apikey" && (
            <ApiKeySetup
              provision={provision}
              isLoading={isLoadingProvision}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          )}

          <button
            onClick={() => setStep("method")}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: "var(--text-subtle)" }}
          >
            ← {t("back")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WordPress pairing setup ──────────────────────────────────────────────────

// Secondary action button: same look for Download Plugin, Generate Code and Copy.
const SECONDARY_BTN =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--background-default)] font-medium text-[var(--text-subtle)] transition-colors hover:border-[var(--color-primary-500)] hover:bg-white/10 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50";

function PluginDetectedBadge({ detected, version }: { detected: boolean | null; version?: string | null }) {
  const t = useTranslations("SiteCockpit.connection");
  if (detected === null) return null;
  return detected ? (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
      style={{ background: "oklch(from var(--category-performance) l c h / 0.1)", border: "1px solid oklch(from var(--category-performance) l c h / 0.25)", color: "var(--category-performance)" }}
    >
      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
      {version ? t("pairing.detectedVersion", { version }) : t("pairing.detected")}
    </div>
  ) : (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
      style={{ background: "oklch(from #f59e0b l c h / 0.1)", border: "1px solid oklch(from #f59e0b l c h / 0.25)", color: "#fbbf24" }}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {t("pairing.notDetected")}
    </div>
  );
}

function WordPressSetup({ pairing }: { pairing: ReturnType<typeof useWordPressPairing> }) {
  const t = useTranslations("SiteCockpit.connection");
  const isGenerating = pairing.pairingStatus === "generating";
  const hasCode = !!pairing.pairCode;
  const isWaiting = pairing.pairingStatus === "waiting";
  const isError = pairing.pairingStatus === "error";
  const isConnected = pairing.pairingStatus === "connected";

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        {t("pairing.title")}
      </div>

      {/* Steps */}
      <ol className="space-y-3 text-sm">
        {[
          {
            n: 1,
            title: t("pairing.step1"),
            action: (
              <a
                href="/wp-plugin/getsafe360-connector.zip"
                download
                className={`${SECONDARY_BTN} text-xs px-3 py-1.5`}
              >
                <ExternalLink className="h-3 w-3" />
                {t("pairing.download")}
              </a>
            ),
          },
          {
            n: 2,
            title: t("pairing.step2"),
            action: !hasCode ? (
              <button
                onClick={() => pairing.startPairing()}
                disabled={isGenerating}
                className={`${SECONDARY_BTN} text-xs px-3 py-1.5`}
              >
                {isGenerating ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />{t("pairing.generating")}</>
                ) : (
                  <><LinkIcon className="h-3 w-3" />{t("pairing.generate")}</>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
                >
                  <span
                    className="text-3xl font-mono tracking-[0.4em] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {pairing.pairCode}
                  </span>
                  <button
                    onClick={pairing.copyToClipboard}
                    className={`${SECONDARY_BTN} px-2 py-1 text-xs`}
                  >
                    {pairing.copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {pairing.copied ? t("copied") : t("copy")}
                  </button>
                </div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                  {t("pairing.expires")}
                </div>
              </div>
            ),
          },
          {
            n: 3,
            title: t("pairing.step3"),
            action: null,
          },
        ].map(({ n, title, action }) => (
          <li key={n} className="flex gap-3">
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
              style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}
            >
              {n}
            </span>
            <div className="flex-1 space-y-1.5">
              <div style={{ color: "var(--text-primary)" }}>{title}</div>
              {action}
            </div>
          </li>
        ))}
      </ol>

      {/* Plugin detection badge — once connected treat plugin as detected; hide warning when connected */}
      {hasCode && !isConnected && <PluginDetectedBadge detected={isConnected ? true : pairing.pluginDetected} version={pairing.pluginVersion} />}

      {/* Status messages */}
      {isWaiting && (
        <div
          className="flex items-center gap-2 rounded-lg p-3 text-xs"
          style={{ background: "oklch(from var(--color-primary-500, #3b82f6) l c h / 0.1)", border: "1px solid oklch(from var(--color-primary-500, #3b82f6) l c h / 0.25)", color: "var(--color-primary-400, #60a5fa)" }}
        >
          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "currentColor" }} />
          {t("pairing.messages.waiting")}
        </div>
      )}

      {isError && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2 rounded-lg p-3 text-xs"
            style={{ background: "oklch(from #ef4444 l c h / 0.1)", border: "1px solid oklch(from #ef4444 l c h / 0.25)", color: "#fca5a5" }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t(`pairing.messages.${pairing.pairingMessageKey ?? "generic"}`)}
          </div>
          <button
            onClick={() => pairing.startPairing()}
            className={`${SECONDARY_BTN} text-xs px-3 py-1.5`}
          >
            <RefreshCw className="h-3 w-3" />
            {t("pairing.newCode")}
          </button>
        </div>
      )}

      {isConnected && (
        <div
          className="flex items-center gap-2 rounded-lg p-3 text-xs"
          style={{ background: "oklch(from var(--category-performance) l c h / 0.1)", border: "1px solid oklch(from var(--category-performance) l c h / 0.25)", color: "var(--category-performance)" }}
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("pairing.messages.connected")}
        </div>
      )}
    </div>
  );
}

// ─── JS Snippet setup ─────────────────────────────────────────────────────────

function SnippetSetup({
  provision,
  isLoading,
  copiedKey,
  onCopy,
  siteId,
  onConfirmed,
}: {
  provision: ProvisionData | null;
  isLoading: boolean;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  siteId?: string;
  onConfirmed?: () => void;
}) {
  const t = useTranslations("SiteCockpit.connection");
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!siteId) return;
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch("/api/connect/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, method: "snippet" }),
      });
      let data: Record<string, any> = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      onConfirmed?.();
    } catch (e: any) {
      console.warn("[ConnectionCard] snippet confirmation failed:", e?.message);
      setConfirmError(t("snippet.confirmFailed"));
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading || !provision) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-subtle)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("snippet.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        {t("snippet.title")}
      </div>

      <ol className="space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>1</span>
          <div className="flex-1 space-y-2">
            <div style={{ color: "var(--text-primary)" }}>{t("snippet.step1")}</div>
            <CodeBlock code={provision.snippet} />
          </div>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>2</span>
          <div style={{ color: "var(--text-primary)" }}>
            {t.rich("snippet.step2", { code: headTag })}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>3</span>
          <div className="flex-1 space-y-2">
            <div style={{ color: "var(--text-primary)" }}>{t("snippet.step3")}</div>
            {siteId && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--color-primary-500, #3b82f6)" }}
              >
                {isConfirming ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />{t("snippet.confirming")}</>
                ) : (
                  <><CheckCircle className="h-3 w-3" />{t("snippet.confirm")}</>
                )}
              </button>
            )}
            {confirmError && (
              <div
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                style={{ background: "oklch(from #ef4444 l c h / 0.1)", border: "1px solid oklch(from #ef4444 l c h / 0.25)", color: "#fca5a5" }}
              >
                <AlertCircle className="h-3 w-3 shrink-0" />
                {confirmError}
              </div>
            )}
          </div>
        </li>
      </ol>

      <div
        className="rounded-lg p-3 text-xs space-y-1"
        style={{ background: "var(--background-default)", border: "1px solid var(--border-default)", color: "var(--text-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {t("snippet.readOnly")}
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-emerald-400" />
          {t("snippet.tracks")}
        </div>
      </div>
    </div>
  );
}

// ─── API Key setup ────────────────────────────────────────────────────────────

function ApiKeySetup({
  provision,
  isLoading,
  copiedKey,
  onCopy,
}: {
  provision: ProvisionData | null;
  isLoading: boolean;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const t = useTranslations("SiteCockpit.connection");
  if (isLoading || !provision) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-subtle)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("apikey.loading")}</span>
      </div>
    );
  }

  const curlExample = `curl -X GET https://api.getsafe360.com/v1/scan \\
  -H "Authorization: Bearer ${provision.apiKey}" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        {t("apikey.title")}
      </div>

      <div className="space-y-2">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("apikey.yourKey")}</div>
        <div
          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
          style={{ background: "var(--background-default)", border: "1px solid var(--border-default)" }}
        >
          <code className="text-xs font-mono truncate flex-1" style={{ color: "var(--text-primary)" }}>
            {provision.apiKey}
          </code>
          <button
            onClick={() => onCopy(provision.apiKey, "apikey")}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs shrink-0 transition-colors"
            style={{ color: "var(--text-subtle)", background: "var(--header-bg)" }}
          >
            {copiedKey === "apikey" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copiedKey === "apikey" ? t("copied") : t("copy")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{t("apikey.usage")}</div>
        <CodeBlock code={curlExample} language="bash" />
      </div>

      <div
        className="rounded-lg p-3 text-xs space-y-1"
        style={{ background: "var(--background-default)", border: "1px solid var(--border-default)", color: "var(--text-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <Key className="h-3 w-3" />
          {t("apikey.secret")}
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          {t("apikey.rotate")}
        </div>
      </div>
    </div>
  );
}
