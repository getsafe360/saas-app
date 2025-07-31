'use client';

import { useUser } from "@clerk/clerk-react";
import { useTranslations } from "next-intl";

export function UserGreeting({ className = "" }: { className?: string }) {
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

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {name
          ? t("greeting", { name })
          : t("greeting_anon")
        }
      </p>
    </div>
  );
}
