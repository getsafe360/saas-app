// saas-ux/components/marketing/CTA.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { Link } from "@/navigation";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { useTestResultSafe } from "@/contexts/TestResultContext";
import { saveTestResults, backupToSessionStorage } from "@/lib/stash/saveTestResults";

/**
 * CTA component
 * - Context-aware: shows different messaging based on test completion
 * - Stashes test results before redirecting to signup
 * - Matches the new InfoBoxes card aesthetic
 * - i18n via "ctaRoot" namespace (see keys below)
 * - Uses background layering to create a rotating gradient BORDER only
 * (no bleed through the semi-transparent center)
 */
export default function CTA() {
  const t = useTranslations("ctaRoot");
  const testContext = useTestResultSafe();
  const [isStashing, setIsStashing] = useState(false);

  // Check if a test has been completed
  const hasTest = testContext?.hasCompletedTest ?? false;
  const quickWinsCount = testContext?.quickWinsCount ?? 0;
  const overallScore = testContext?.overallScore ?? 0;

  // Handle signup with test result stashing
  const handleSignupClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasTest || !testContext?.testResult) {
      // No test completed, proceed with normal signup
      return;
    }

    // Prevent default to handle stashing first
    e.preventDefault();
    e.stopPropagation();

    setIsStashing(true);

    try {
      // Save to blob storage
      const stashResult = await saveTestResults(testContext.testResult);

      // Also backup to sessionStorage as fallback
      backupToSessionStorage(testContext.testResult);

      // Build redirect URL with stash parameter
      let redirectUrl = "/dashboard/welcome";
      if (stashResult?.stashUrl) {
        redirectUrl += `?u=${encodeURIComponent(stashResult.stashUrl)}`;
      }

      // Trigger Clerk signup with custom redirect
      const signUpButton = document.querySelector(
        '[data-clerk-sign-up-button="true"]'
      ) as HTMLButtonElement;
      if (signUpButton) {
        // Store redirect URL for after signup
        sessionStorage.setItem("getsafe360_after_signup_url", redirectUrl);
        signUpButton.click();
      }
    } catch (error) {
      console.error("Failed to stash test results:", error);
      // Continue with signup anyway
    } finally {
      setIsStashing(false);
    }
  };

  // Dynamic messaging based on test state
  const getCtaContent = () => {
    if (!hasTest) {
      return {
        headline: t("headline"),
        support: t("support"),
        buttonText: t("primary"),
        icon: <ArrowRight className="size-4" />,
        highlight: false,
      };
    }

    if (quickWinsCount > 0) {
      return {
        headline: "Save These Results & Get Your Quick Wins",
        support: `We found ${quickWinsCount} quick wins that could boost your score. Sign up to see the full report and start fixing issues instantly.`,
        buttonText: isStashing
          ? "Saving results..."
          : `Unlock ${quickWinsCount} Quick Wins`,
        icon: isStashing ? null : <Zap className="size-4" />,
        highlight: true,
      };
    }

    return {
      headline: "Save Your Analysis & Access Full Report",
      support: `Your site scored ${overallScore}/100. Create a free account to access detailed recommendations, security checks, and more.`,
      buttonText: isStashing ? "Saving results..." : "Save & View Full Report",
      icon: isStashing ? null : <Sparkles className="size-4" />,
      highlight: true,
    };
  };

  const ctaContent = getCtaContent();

  return (
    <section className="mx-auto max-w-4xl px-3 sm:px-5 lg:px-6 my-8">
      {/* CTA card */}
      <div
        className={
          ctaContent.highlight
            ? "cta-effect cta-green rounded-2xl transition duration-500 ease-in-out"
            : "cta-effect cta-sky rounded-2xl transition duration-500 ease-in-out"
        }
      >
        <div
          className={`rounded-2xl border ${
            ctaContent.highlight
              ? "border-green-500/40 dark:border-green-400/30"
              : "border-teal-500/40 dark:border-teal-400/30"
          }
                bg-white/70 dark:bg-white/[0.04] backdrop-blur supports-[backdrop-filter]:bg-white/60
                p-8 sm:p-10 lg:p-12 shadow-sm relative z-10`}
        >
          <h2 className="text-4xl font-semibold tracking text-slate-900 dark:text-slate-100 text-center">
            {ctaContent.headline}
          </h2>
          <p className="mt-3 text-center text-slate-700 dark:text-slate-300">
            {ctaContent.support}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <SignedOut>
              <SignUpButton mode="modal">
                <button
                  data-clerk-sign-up-button="true"
                  onClick={hasTest ? handleSignupClick : undefined}
                  disabled={isStashing}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-lg font-semibold ring-1 transition-all ${
                    ctaContent.highlight
                      ? "ring-green-600/30 dark:ring-green-400/30 bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 shadow-lg hover:shadow-xl"
                      : "ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20"
                  } ${isStashing ? "opacity-75 cursor-wait" : ""}`}
                >
                  {ctaContent.buttonText}
                  {ctaContent.icon}
                </button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full px-5 py-2.5 text-medium font-semibold ring-1 ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20 transition"
              >
                {t("signedInCta")}
              </Link>
            </SignedIn>
          </div>

          <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
            {hasTest
              ? "Free account • No credit card required • Results saved instantly"
              : t("microcopy")}
          </p>
        </div>
      </div>
    </section>
  );
}
