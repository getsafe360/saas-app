"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AnalysisPayload from "@/components/analyzer/core/StreamingReportShell";

export default function CTA({ analysis }: { analysis?: typeof AnalysisPayload }) {
  const { openSignUp } = useClerk();
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);

      // If there's no analysis yet: just open sign-up or go to sites if signed in
      if (!analysis) {
        if (isSignedIn) {
          router.push("/dashboard/sites");
          return;
        }
        openSignUp ? openSignUp() : (window.location.href = "/sign-up");
        return;
      }

      // 1) POST analysis to stash endpoint
      const res = await fetch("/api/stash-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "stash failed");

      // 2) Build redirect with BOTH stash key and public blob URL
      const redirect = `/dashboard/welcome?stash=${encodeURIComponent(
        data.stashKey
      )}&u=${encodeURIComponent(data.url)}`;

      // 3) If already signed in → go directly; else open Clerk with redirect
      if (isSignedIn) {
        router.push(redirect);
        return;
      }
      if (openSignUp) {
        openSignUp({
          afterSignUpUrl: redirect,
          afterSignInUrl: redirect,
        });
      } else {
        window.location.href = `/sign-up?redirect_url=${encodeURIComponent(redirect)}`;
      }
    } catch (err) {
      console.error("CTA signup error:", err);
      openSignUp ? openSignUp() : (window.location.href = "/sign-up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-sky-500/20 to-blue-500/20 dark:from-sky-400/10 dark:to-indigo-600/10 border border-sky-500/30 shadow-xl px-8 py-10 text-center">
      <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
        Want a full report & <span className="text-sky-400">instant</span> optimization?
      </h3>
      <p className="mb-6">
        Create your <span className="font-bold">free account</span> today and optimize any website in minutes.
      </p>
      <button
        onClick={handleClick}
        disabled={loading}
        className="button-shine inline-flex items-center gap-2 px-6 py-3 text-lg font-semibold rounded-full bg-sky-600 hover:bg-sky-700 hover:cursor-pointer text-white transition duration-300 ease-in-out shadow-lg disabled:opacity-50"
      >
        {loading ? "Preparing…" : "Create your free account"}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
