"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils"; // optional: or just inline className joins
import { Loader2 } from "lucide-react";

function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.href;
  } catch {
    return null;
  }
}

export default function UrlAnalyzeForm({
  placeholder = "https://example.com",
  icon,
  onSubmit,
}: {
  placeholder?: string;
  icon?: React.ReactNode;
  onSubmit: (url: string) => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeUrl(value);
    if (!normalized) {
      setError("Please enter a valid URL.");
      return;
    }
    setSubmitting(true);
    try {
      onSubmit(normalized);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur px-3 py-2 shadow-lg focus-within:ring-2 focus-within:ring-sky-500/60"
    >
      <span className="text-slate-300">{icon}</span>
      <input
        type="url"
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
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "rounded-full px-5 py-2 text-sm sm:text-base font-semibold",
          "text-white bg-sky-600 hover:bg-sky-700 hover:cursor-pointer transition duration-300 ease-in-out",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
          </span>
        ) : (
          "Analyze"
        )}
      </button>

      {error && (
        <div className="absolute -bottom-6 left-4 text-xs text-rose-400">
          {error}
        </div>
      )}
    </form>
  );
}
