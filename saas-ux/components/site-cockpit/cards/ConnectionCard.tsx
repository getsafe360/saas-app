// components/site-cockpit/cards/ConnectionCard.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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

// ─── Uptime sparkline ─────────────────────────────────────────────────────────

function UptimeSparkline({ data }: { data: (0 | 1)[] }) {
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
        {upPct}% uptime · 7d
      </span>
    </div>
  );
}

// ─── Code block with copy ─────────────────────────────────────────────────────

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
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
          className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors hover:opacity-80"
          style={{ color: "var(--text-subtle)" }}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
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
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
      style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}
    >
      <Lock className="h-2 w-2" />
      Soon
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ConnectionCardProps {
  siteId?: string;
  siteUrl: string;
  cmsType?: string;
  connectionStatus?: ConnectionStatus;
  lastConnected?: string;
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
}: ConnectionCardProps) {
  const platform = detectPlatform(cmsType);
  const isConnected = connectionStatus === "connected";

  const [step, setStep] = useState<WizardStep>("detect");
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>(
    platform.recommendedMethod,
  );
  const [provision, setProvision] = useState<ProvisionData | null>(null);
  const [isLoadingProvision, setIsLoadingProvision] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
                Site Connection
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Connected — {platform.name}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => void fetchProvision()}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--text-subtle)" }}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div>
            <div style={{ color: "var(--text-subtle)" }}>Platform</div>
            <div style={{ color: "var(--text-primary)" }}>{platform.name}</div>
          </div>
          {lastConnected && (
            <div>
              <div style={{ color: "var(--text-subtle)" }}>Connected since</div>
              <div style={{ color: "var(--text-primary)" }}>
                {new Date(lastConnected).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        <UptimeSparkline data={uptime7d} />
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
            Site Connection
          </div>
          <div className="text-sm font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>
            Connect to enable deep analysis & repair
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
              Detected platform
            </div>
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: "var(--border-default)", background: "var(--background-default)" }}
            >
              <Globe className="h-5 w-5 shrink-0" style={{ color: "var(--text-subtle)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {platform.name}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-subtle)" }}>{siteUrl}</div>
              </div>
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-subtle)" }}>
              Not the right platform?
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
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setStep("method")}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all"
            style={{ background: "var(--color-primary-500, #3b82f6)" }}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 2: Method selection */}
      {step === "method" && (
        <div className="p-5 space-y-3">
          <div className="text-xs font-medium mb-3" style={{ color: "var(--text-subtle)" }}>
            Choose connection method
          </div>

          {/* WordPress Plugin */}
          <button
            onClick={() => { setSelectedMethod("wordpress"); setStep("setup"); }}
            className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
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
                WordPress Plugin
                {platform.id === "wordpress" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-emerald-400 font-medium"
                    style={{ background: "oklch(from var(--category-performance) l c h / 0.12)" }}>
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Deep plugin/theme analysis, health checks, AI repair
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* JS Snippet */}
          <button
            onClick={() => { setSelectedMethod("snippet"); setStep("setup"); }}
            className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
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
                JS Monitoring Snippet
                {platform.id !== "wordpress" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-emerald-400 font-medium"
                    style={{ background: "oklch(from var(--category-performance) l c h / 0.12)" }}>
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Works on any site — paste one tag into &lt;head&gt;
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* API Key */}
          <button
            onClick={() => { setSelectedMethod("apikey"); setStep("setup"); }}
            className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all"
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
                REST API Key
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                For headless or API-driven sites — secure bearer token
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
                OAuth Integration
                <SoonBadge />
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Vercel, Netlify, Cloudflare, GitHub Pages
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep("detect")}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-subtle)" }}
          >
            ← Back
          </button>
        </div>
      )}

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
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-subtle)" }}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WordPress pairing setup ──────────────────────────────────────────────────

function WordPressSetup({ pairing }: { pairing: ReturnType<typeof useWordPressPairing> }) {
  const isGenerating = pairing.pairingStatus === "generating";
  const hasCode = !!pairing.pairCode;
  const isWaiting = pairing.pairingStatus === "waiting";
  const isError = pairing.pairingStatus === "error";
  const isConnected = pairing.pairingStatus === "connected";

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        WordPress Plugin — 3 steps
      </div>

      {/* Steps */}
      <ol className="space-y-3 text-sm">
        {[
          {
            n: 1,
            title: "Download & install plugin",
            action: (
              <a
                href="/wp-plugin/getsafe360-connector.zip"
                download
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{
                  background: "var(--background-default)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-subtle)",
                }}
              >
                <ExternalLink className="h-3 w-3" />
                Download Plugin
              </a>
            ),
          },
          {
            n: 2,
            title: "Generate your pairing code",
            action: !hasCode ? (
              <button
                onClick={() => pairing.setShowPairingFlow(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--color-primary-500, #3b82f6)" }}
              >
                {isGenerating ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
                ) : (
                  <><LinkIcon className="h-3 w-3" />Generate Code</>
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
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ color: "var(--text-subtle)", background: "var(--header-bg)" }}
                  >
                    {pairing.copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {pairing.copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                  Expires in ~10 min · Single use only
                </div>
              </div>
            ),
          },
          {
            n: 3,
            title: "Paste code in WordPress Admin → GetSafe 360 AI",
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

      {/* Status messages */}
      {isWaiting && (
        <div
          className="flex items-center gap-2 rounded-lg p-3 text-xs"
          style={{ background: "oklch(from var(--color-primary-500, #3b82f6) l c h / 0.1)", border: "1px solid oklch(from var(--color-primary-500, #3b82f6) l c h / 0.25)", color: "var(--color-primary-400, #60a5fa)" }}
        >
          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "currentColor" }} />
          Waiting for plugin confirmation…
        </div>
      )}

      {isError && (
        <div
          className="flex items-center gap-2 rounded-lg p-3 text-xs"
          style={{ background: "oklch(from #ef4444 l c h / 0.1)", border: "1px solid oklch(from #ef4444 l c h / 0.25)", color: "#fca5a5" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {pairing.pairingMessage}
        </div>
      )}

      {isConnected && (
        <div
          className="flex items-center gap-2 rounded-lg p-3 text-xs"
          style={{ background: "oklch(from var(--category-performance) l c h / 0.1)", border: "1px solid oklch(from var(--category-performance) l c h / 0.25)", color: "var(--category-performance)" }}
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          Connection established — syncing dashboard…
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
}: {
  provision: ProvisionData | null;
  isLoading: boolean;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  if (isLoading || !provision) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-subtle)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Generating snippet…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        JS Monitoring Snippet — works on any platform
      </div>

      <ol className="space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>1</span>
          <div className="flex-1 space-y-2">
            <div style={{ color: "var(--text-primary)" }}>Copy this snippet</div>
            <CodeBlock code={provision.snippet} />
          </div>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>2</span>
          <div style={{ color: "var(--text-primary)" }}>
            Paste it inside the <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--background-default)" }}>&lt;head&gt;</code> of every page — or use your tag manager
          </div>
        </li>
        <li className="flex gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
            style={{ background: "var(--border-default)", color: "var(--text-subtle)" }}>3</span>
          <div style={{ color: "var(--text-primary)" }}>Return here — connection will confirm automatically</div>
        </li>
      </ol>

      <div
        className="rounded-lg p-3 text-xs space-y-1"
        style={{ background: "var(--background-default)", border: "1px solid var(--border-default)", color: "var(--text-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Read-only monitoring — no server access required
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-emerald-400" />
          Tracks performance, errors, and uptime
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
  if (isLoading || !provision) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-subtle)" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Generating API key…</span>
      </div>
    );
  }

  const curlExample = `curl -X GET https://api.getsafe360.com/v1/scan \\
  -H "Authorization: Bearer ${provision.apiKey}" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>
        REST API Key — for headless &amp; API-driven sites
      </div>

      <div className="space-y-2">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Your API key</div>
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
            {copiedKey === "apikey" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Usage example</div>
        <CodeBlock code={curlExample} language="bash" />
      </div>

      <div
        className="rounded-lg p-3 text-xs space-y-1"
        style={{ background: "var(--background-default)", border: "1px solid var(--border-default)", color: "var(--text-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <Key className="h-3 w-3" />
          Keep this key secret — treat it like a password
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Contact support to rotate your key
        </div>
      </div>
    </div>
  );
}
