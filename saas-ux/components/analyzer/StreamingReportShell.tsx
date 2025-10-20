// saas-ux/components/analyzer/StreamingReportShell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { SignedOut, SignedIn, SignUpButton } from "@clerk/nextjs";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  autofillUrl?: string; // optional convenience
  locale: string;       // pass current selected language/locale
};

export default function StreamingReportShell({ className, autofillUrl = "", locale }: Props) {
  const t = useTranslations("actions, Nav, intro, errors, input, cta");
  const [url, setUrl] = useState(autofillUrl);
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setErrorMsg(null);

    const u = url.trim();
    if (!u) return;

    setStatus("loading");
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, locale }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Stream chunks into state
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (doneReading) break;
        const chunk = decoder.decode(value, { stream: true });
        setOutput((prev) => prev + chunk);
      }

      setStatus("done");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setStatus("error");
      setErrorMsg(err?.message || t("errors.generic"));
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  return (
    <div className={cn("space-y-4", className)}>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("input.placeholder")}
          className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "streaming"}
          className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {status === "loading" || status === "streaming" ? t("cta.analyzing") : t("cta.analyze")}
        </button>
        {(status === "loading" || status === "streaming") && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            {t("actions.cancel")}
          </button>
        )}
      </form>

      {/* Copilot intro shows immediately while we wait */}
      {(status === "loading" || status === "streaming") && (
        <div className="rounded-2xl border p-4 shadow-sm bg-white/70 dark:bg-neutral-900/70">
          <div className="text-lg font-semibold">{t("intro.title")}</div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {t("intro.body")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  {t ? t('Nav.createFreeAccount') : 'Create free account'}
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <span className="text-xs text-neutral-500">{t("intro.alreadySignedIn")}</span>
            </SignedIn>
          </div>
        </div>
      )}

      {/* Streamed report */}
      {output && (
        <div className="rounded-2xl border p-4 shadow-sm prose prose-sm max-w-none dark:prose-invert">
          <div className="prose dark:prose-invert">
          <ReactMarkdown>{output}</ReactMarkdown>
          </div>
          {/* Inline CTA stays visible post-report for SignedOut users */}
          <div className="mt-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  {t("Nav.createFreeAccount")}
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {t("errors.title")}: {errorMsg}
        </div>
      )}
    </div>
  );
}
