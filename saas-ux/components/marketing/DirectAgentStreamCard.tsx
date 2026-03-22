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

function normalizeUrl(input: string): string | null {
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
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
    return [
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
  }, [stream.snapshot]);

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
          severity: /missing|no signal|risk|issue|slow|weak/i.test(section.text) ? "medium" : "low",
          issues: [{ summary: section.text }],
        })),
        summary: snapshot.text,
        platform: /wordpress|wp/i.test(snapshot.sections.content) ? "wordpress" : "generic",
        timestamp: snapshot.generatedAt,
      };

      try {
        const response = await fetch("/api/stash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`stash failed (${response.status})`);
        const data = (await response.json()) as { stashUrl?: string; url?: string };
        const nextUrl = data.stashUrl ?? data.url;
        if (!nextUrl) throw new Error("missing stash url");

        setStashUrl(nextUrl);
        stashedRef.current = true;
      } catch (error) {
        setStashError("Couldn't save this test automatically. Signup still works.");
      } finally {
        setIsStashing(false);
      }
    };

    void run();
  }, [sections, stream.snapshot]);

  const signupRedirect = stashUrl ? `/dashboard/welcome?u=${encodeURIComponent(stashUrl)}` : null;

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-slate-900/70 p-5 shadow-2xl">
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
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-base leading-relaxed text-slate-200">
            <p className="font-medium text-emerald-200">Sparky</p>
            <p className="mt-2 text-slate-200">Hi, I&apos;m Sparky. I&apos;ll walk you through what we find in real time.</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              {stream.messages.map((message) => (
                <p key={message.id} className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                  {message.text}
                </p>
              ))}
            </div>
          </div>

          {sections.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.id} className={`rounded-lg border p-3 ${section.tone}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-4" />
                      <span>{section.label}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{section.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {stream.snapshot && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-950/20 p-4">
              <p className="text-sm text-emerald-100">
                Want the full actionable report and automated fixes (including WordPress automation if detected)? Create a free account to unlock the detailed checklist and one-click fixes.
              </p>
              {isStashing && <p className="mt-2 text-sm text-slate-300">Saving snapshot for onboarding…</p>}
              {stashError && <p className="mt-2 text-sm text-amber-200">{stashError}</p>}

              {signupRedirect && (
                <div className="mt-3">
                  <SignedOut>
                    <SignUpButton mode="modal">
                      <Button className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium ring ring-sky-600/30 bg-sky-50 text-sky-700 transition hover:bg-sky-100 hover:shadow-none dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30 dark:hover:bg-sky-400/20">
                        Create a free account
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

          {stream.error && <p className="text-sm text-amber-300">{stream.error}</p>}
        </div>
      )}
    </section>
  );
}
