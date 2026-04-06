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
  CheckCircle2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSparkyStream } from "@/lib/agent/useSparkyStream";

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
        tone: "border-emerald-400/30 bg-emerald-950/20 text-emerald-100",
      },
      {
        id: "performance",
        label: "Performance",
        text: stream.snapshot.sections.performance,
        icon: GaugeIcon,
        tone: "border-sky-400/30 bg-sky-950/20 text-sky-100",
      },
      {
        id: "seo",
        label: "SEO & GEO",
        text: stream.snapshot.sections.seoGeo,
        icon: SearchIcon,
        tone: "border-violet-400/30 bg-violet-950/20 text-violet-100",
      },
      {
        id: "content",
        label: "Content",
        text: stream.snapshot.sections.content,
        icon: FileTextIcon,
        tone: "border-amber-400/30 bg-amber-950/20 text-amber-100",
      },
      {
        id: "security",
        label: "Security",
        text: stream.snapshot.sections.security,
        icon: ShieldCheckIcon,
        tone: "border-rose-400/30 bg-rose-950/20 text-rose-100",
      },
    ];
    if (stream.snapshot.platform === "wordpress") {
      baseSections.push({
        id: "wordpress",
        label: "WordPress",
        text: t("wordpress_card_text"),
        icon: ShieldCheckIcon,
        tone: "border-blue-400/30 bg-blue-950/20 text-blue-100",
      });
    }
    return baseSections;
  }, [stream.snapshot, t]);

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
      } catch (error) {
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
          <div className="overflow-hidden rounded-xl border border-cyan-400/25 bg-[#05070d] text-base leading-relaxed text-slate-200">
            <div className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
              <p>SPARKY ENGINE v2.5.0</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500/25" />
                <span className="h-2 w-2 rounded-full bg-yellow-500/25" />
                <span className="h-2 w-2 rounded-full bg-emerald-500/35" />
              </div>
            </div>
            <div className="bg-[#090d14] p-4">
              <p className="font-medium text-emerald-200">Sparky</p>
              <p className="mt-2 text-slate-200">
                {stream.snapshot?.greeting ??
                  `${t("sparky_intro_line1")} ${t("sparky_intro_line2", {
                    domain: activeUrl ? hostnameFromUrl(activeUrl) : "your website",
                  })}`}
              </p>
              <div className="mt-3 space-y-1.5 font-mono text-sm text-slate-300">
                {stream.messages.map((message) => (
                  <div
                    key={message.id}
                    className="grid grid-cols-[66px_24px_74px_1fr] gap-2 px-1 py-1 text-left"
                  >
                    <span className="text-slate-500">
                      [{message.timestamp ?? "--:--:--"}]
                    </span>
                    <span className="pt-0.5">
                      {message.level === "SUCCESS" ? (
                        <CheckCircle2Icon className="size-4 text-emerald-400" />
                      ) : (
                        <span className="text-slate-600">·</span>
                      )}
                    </span>
                    <span className="text-cyan-300">
                      [{message.level ?? "INFO"}]
                    </span>
                    <span className="text-left">
                      <span className="text-slate-400">
                        {message.stage ?? "Stream"}:
                      </span>{" "}
                      {message.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {sections.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.id}
                    className={`group relative overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition-all hover:border-white/25 ${section.tone}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                          <Icon className="size-4" />
                        </div>
                        <span className="uppercase tracking-[0.12em]">
                          {section.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {section.text}
                    </p>
                    <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  </div>
                );
              })}
            </div>
          )}

          {stream.snapshot && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-950/20 p-4">
              <p className="text-sm text-emerald-100">
                {t("cta_full_report")}
              </p>
              {isStashing && (
                <p className="mt-2 text-sm text-slate-300">
                  Saving snapshot for onboarding…
                </p>
              )}
              {stashError && (
                <p className="mt-2 text-sm text-amber-200">{stashError}</p>
              )}

              {signupRedirect && (
                <div className="mt-3">
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20">
                        {t("cta_create_account")}
                        <ArrowRightIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <Button
                      onClick={() => router.push(`/${locale}${signupRedirect}`)}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20"
                    >
                      Continue to dashboard
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </SignedIn>
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
