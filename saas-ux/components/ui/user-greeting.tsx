'use client';

import { useUser } from "@clerk/clerk-react";
import { useTranslations } from "next-intl";
import { UserButton } from "@clerk/clerk-react";

const PLAN_COLORS: Record<string, string> = {
  free:     "text-gray-400",
  pro:      "text-sky-500",
  agent:    "text-violet-500",
  agency:   "text-violet-500",
  business: "text-amber-500",
  admin:    "text-rose-500",
};

export function UserGreeting({ className = "", planName }: { className?: string; planName?: string }) {
  const t = useTranslations("dashboard");
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  // Prefer name, fallback to username/email/anon
  const name =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    null;

  const planColor = planName ? (PLAN_COLORS[planName] ?? "text-gray-400") : "";
  const planLabel = planName
    ? planName.charAt(0).toUpperCase() + planName.slice(1) + " Plan"
    : null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-10 h-10"
          }
        }}
      />
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {name
            ? t("greeting", { name })
            : t("greeting_anon")
          }
        </p>
        {user?.primaryEmailAddress?.emailAddress && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {user.primaryEmailAddress.emailAddress}
          </p>
        )}
        {planLabel && (
          <p className={`text-xs font-medium ${planColor}`}>
            {planLabel}
          </p>
        )}
      </div>
    </div>
  );
}
