// saas-ux/components/analyzer/UrlAnalyzeForm.tsx
"use client";

import React, { useState } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

/**
 * Normalizes user-entered input into a valid HTTPS URL.
 * - Adds https:// if missing
 * - Handles "www.example.com"
 * - Trims whitespace
 */
function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // if it starts with just "www." add https://
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);

    // optionally: force lowercase host
    url.hostname = url.hostname.toLowerCase();

    return url.href;
  } catch {
    return null;
  }
}

type Labels = {
  analyze: string;     // e.g. t('analysis.analyze_btn')
  analyzing: string;   // e.g. t('analysis.analyzing')
  cancel?: string;     // e.g. t('actions.cancel')
  invalidUrl?: string; // e.g. t('analysis.invalid_url') (optional)
};

export default function UrlAnalyzeForm({
  placeholder = "https://example.com",
  icon,
  onSubmit,
  isBusy = false,
  onCancel,
  defaultValue = "",
  labels = {
    analyze: "Analyze",
    analyzing: "Analyzing…",
    cancel: "Cancel",
    invalidUrl: "Please enter a valid URL.",
  },
}: {
  placeholder?: string;
  icon?: React.ReactNode;
  onSubmit: (url: string) => void;
  isBusy?: boolean;
  onCancel?: () => void;
  defaultValue?: string;
  labels?: Labels;
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeUrl(value);
    if (!normalized) {
      setError(labels.invalidUrl || "Please enter a valid URL.");
      return;
    }
    onSubmit(normalized);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur px-3 py-2 shadow-lg focus-within:ring-2 focus-within:ring-sky-500/60"
    >
      {icon ? <span className="text-slate-300">{icon}</span> : null}

      <input
        type="url"
        name="website"
        autoComplete="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          "w-full bg-transparent text-slate-100 placeholder:text-slate-500",
          "outline-none border-none text-base sm:text-lg"
        )}
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isBusy}
          className={cn(
            "rounded-full px-5 py-2 text-sm sm:text-base font-semibold",
            "text-white bg-sky-600 hover:bg-sky-700 hover:cursor-pointer transition duration-300 ease-in-out",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {labels.analyzing}
            </span>
          ) : (
            labels.analyze
          )}
        </button>

        {isBusy && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm sm:text-base font-semibold border border-white/10 text-white/90 hover:bg-white/[0.08] transition duration-300"
          >
            {labels.cancel || "Cancel"}
          </button>
        )}
      </div>

      {error && (
        <div className="absolute -bottom-6 left-4 text-xs text-rose-400">
          {error}
        </div>
      )}
    </form>
  );
}

export { normalizeUrl };
