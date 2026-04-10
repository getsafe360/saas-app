"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  AccessibilityIcon,
  GaugeIcon,
  SearchIcon,
  ShieldCheckIcon,
  FileTextIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSparkyStream } from "@/lib/agent/useSparkyStream";
import { WordPressIcon } from "@/components/icons/WordPress";

function normalizeUrl(input: string): string | null {
  const candidate = /^https?:\/\//i.test(input.trim())
    ? input.trim()
    : `https://${input.trim()}`;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function hostnameFromUrl(input: string): string {
  try {
    return new URL(input).hostname;
  } catch {
    return "your website";
  }
}

export default function DirectAgentStreamCard() {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [stashUrl, setStashUrl] = useState<string | null>(null);
  const [isStashing, setIsStashing] = useState(false);
  const [stashError, setStashError] = useState<string | null>(null);
  const stashedRef = useRef(false);

  const stream = useSparkyStream(activeUrl, locale);
  const { start: startStream } = stream;

  const start = () => {
    const normalized = normalizeUrl(urlInput);
    if (!normalized) return;
    stashedRef.current = false;
    setStashUrl(null);
    setStashError(null);
    setActiveUrl(normalized);
  };

  useEffect(() => {
    if (!activeUrl) return;
    startStream();
  }, [activeUrl, startStream]);

  const sections = useMemo(() => {
    if (!stream.snapshot) return [];
    const baseSections = [
      {
        id: "accessibility",
        label: "Accessibility",
        text: stream.snapshot.sections.accessibility,
        icon: AccessibilityIcon,
        color: "var(--category-accessibility)",
      },
      {
        id: "performance",
        label: "Performance",
        text: stream.snapshot.sections.performance,
        icon: GaugeIcon,
        color: "var(--category-performance)",
      },
      {
        id: "seo",
        label: "SEO & GEO",
        text: stream.snapshot.sections.seoGeo,
        icon: SearchIcon,
        color: "var(--category-seo)",
      },
      {
        id: "content",
        label: "Content",
        text: stream.snapshot.sections.content,
        icon: FileTextIcon,
        color: "var(--category-content)",
      },
      {
        id: "security",
        label: "Security",
        text: stream.snapshot.sections.security,
        icon: ShieldCheckIcon,
        color: "var(--category-security)",
      },
    ];
    if (stream.snapshot.platform === "wordpress") {
      baseSections.push({
        id: "wordpress",
        label: "WordPress",
        text: t("wordpress_card_text"),
        icon: WordPressIcon,
        color: "var(--category-wordpress)",
      });
    }
    return baseSections;
  }, [stream.snapshot, t]);

  const highImpactCount = useMemo(
    () =>
      sections.filter((s) =>
        /missing|no signal|risk|issue|slow|weak/i.test(s.text),
      ).length,
    [sections],
  );

  useEffect(() => {
    if (!stream.snapshot || stashedRef.current) return;
    const snapshot = stream.snapshot;

    const run = async () => {
      setIsStashing(true);
      setStashError(null);

      const payload = {
        url: snapshot.url,
        testId: `sparky-${Date.now()}`,
        categories: sections.map((section) => ({
          id: section.id,
          severity: /missing|no signal|risk|issue|slow|weak/i.test(section.text)
            ? "medium"
            : "low",
          issues: [{ summary: section.text }],
        })),
        summary: snapshot.text,
        platform: snapshot.platform,
        timestamp: snapshot.generatedAt,
      };

      try {
        const response = await fetch("/api/stash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`stash failed (${response.status})`);
        const data = (await response.json()) as {
          stashUrl?: string;
          url?: string;
        };
        const nextUrl = data.stashUrl ?? data.url;
        if (!nextUrl) throw new Error("missing stash url");

        setStashUrl(nextUrl);
        stashedRef.current = true;
      } catch {
        setStashError(
          "Couldn't save this test automatically. Signup still works.",
        );
      } finally {
        setIsStashing(false);
      }
    };

    void run();
  }, [sections, stream.snapshot]);

  const signupRedirect = stashUrl
    ? `/dashboard/welcome?u=${encodeURIComponent(stashUrl)}`
    : null;

  const domain = activeUrl ? hostnameFromUrl(activeUrl) : "your website";
  const lastTimestamp =
    stream.messages[stream.messages.length - 1]?.timestamp ?? "--:--:--";

  return (
    <section className="mx-auto max-w-5xl rounded-2xl border border-cyan-400/30 bg-[#070c17] p-5 shadow-[0_0_40px_rgba(14,165,233,0.15)]">
      <div className="gs-input-submit-combo flex-col sm:flex-row">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com"
          className="h-11 w-full border-white/10 bg-slate-950/80 text-base font-medium text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400/40 focus-visible:ring-1 focus-visible:ring-sky-500/25"
        />
        <Button
          onClick={start}
          disabled={stream.isStreaming}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20 sm:w-auto bg-sky-50 text-sky-700"
        >
          {stream.isStreaming ? t("analyzing") : t("analyze_btn")}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {(stream.messages.length > 0 || stream.snapshot || stream.error) && (
        <div className="mt-4 space-y-4 text-left">
          {/* Terminal */}
          <div className="overflow-hidden rounded-xl border border-cyan-400/25 bg-[#05070d] text-base leading-relaxed text-slate-200">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
              <p>GetSafe 360 AI ANALYSIS ENGINE</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Terminal body */}
            <div className="bg-[#090d14] p-4">
              {/* Live stream messages */}
              <div className="space-y-1 font-mono text-sm">
                {stream.messages.map((message) => (
                  <div
                    key={message.id}
                    className="grid grid-cols-[66px_14px_1fr] gap-2 px-1 py-0.5 text-left"
                  >
                    <span className="text-slate-700">
                      [{message.timestamp ?? "--:--:--"}]
                    </span>
                    <span className="pt-px font-semibold text-emerald-400">
                      {message.level === "SUCCESS" ? "✓" : ""}
                    </span>
                    <span
                      className={
                        message.level === "SUCCESS"
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }
                    >
                      {message.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Snapshot summary — rendered once stream is complete */}
              {stream.snapshot && sections.length > 0 && (
                <div className="mt-1 font-mono text-sm">
                  {/* Static terminal lines */}
                  <div className="grid grid-cols-[66px_14px_1fr] gap-2 px-1 py-0.5">
                    <span className="text-slate-700">[{lastTimestamp}]</span>
                    <span />
                    <span className="text-slate-400">
                      {t("engine_preparing_snapshot")}
                    </span>
                  </div>
                  <div className="grid grid-cols-[66px_14px_1fr] gap-2 px-1 py-0.5">
                    <span className="text-slate-700">[{lastTimestamp}]</span>
                    <span className="pt-px font-semibold text-emerald-400">
                      ✓
                    </span>
                    <span className="text-emerald-300">
                      {t("engine_snapshot_ready", { domain })}
                    </span>
                  </div>

                  {/* Narrative summary */}
                  <div className="mt-4 border-t border-white/5 pt-4 px-1 space-y-3 text-slate-300">
                    <p className="leading-relaxed">
                      {t("engine_identified", {
                        count: sections.length,
                        highImpact: highImpactCount,
                      })}
                    </p>
                    <ol className="ml-1 space-y-1 text-slate-400">
                      {[
                        t("engine_area_1"),
                        t("engine_area_2"),
                        t("engine_area_3"),
                        t("engine_area_4"),
                        t("engine_area_5"),
                      ].map((area, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-600 tabular-nums">
                            {i + 1}.
                          </span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-slate-400">{t("engine_preview_below")}</p>
                    <p className="text-slate-500 text-xs">
                      {t("engine_full_analysis_note")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category cards */}
          {sections.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isWordPress = section.id === "wordpress";
                return (
                  <div
                    key={section.id}
                    style={{ borderLeftColor: section.color }}
                    className={`group relative overflow-hidden rounded-xl border border-white/10 border-l-2 p-4 transition-all hover:border-white/20 ${
                      isWordPress
                        ? "bg-gradient-to-br from-[#090d14] to-[#21759b]/10"
                        : "bg-[#090d14] hover:bg-[#0b1020]"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"
                          style={{ color: section.color }}
                        >
                          <Icon size={16} />
                        </div>
                        <span
                          className="uppercase tracking-[0.12em]"
                          style={{ color: section.color }}
                        >
                          {section.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {section.text}
                    </p>
                    <div
                      className="absolute bottom-0 left-0 h-px w-full"
                      style={{
                        background: `linear-gradient(to right, transparent, ${section.color}50, transparent)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA */}
          {stream.snapshot && (
            <div className="rounded-lg border border-white/10 bg-[#090d14] p-5">
              <p className="text-sm leading-relaxed text-slate-200">
                {t("cta_full_report")}
              </p>
              {isStashing && (
                <p className="mt-2 text-sm text-slate-400">
                  Saving snapshot for onboarding…
                </p>
              )}
              {stashError && (
                <p className="mt-2 text-sm text-amber-200">{stashError}</p>
              )}

              {signupRedirect && (
                <div className="mt-4">
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20">
                        {t("cta_create_account")}
                        <ArrowRightIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <Button
                      onClick={() => router.push(`/${locale}${signupRedirect}`)}
                      className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20"
                    >
                      Continue to dashboard
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </SignedIn>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("cta_subtext")}
                  </p>
                </div>
              )}
            </div>
          )}

          {stream.error && (
            <p className="text-sm text-amber-300">{stream.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
