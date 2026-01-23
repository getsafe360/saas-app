'use client';

import { useUser } from "@clerk/clerk-react";
import { useTranslations } from "next-intl";
import { UserButton } from "@clerk/clerk-react";

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
      </div>
    </div>
  );
}
