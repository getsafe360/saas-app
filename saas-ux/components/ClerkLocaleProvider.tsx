"use client";

import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, deDE, frFR, esES, itIT, ptBR } from "@clerk/localizations";

import { locales } from "@/config/i18n";

const clerkLocales = { en: enUS, de: deDE, fr: frFR, es: esES, it: itIT, pt: ptBR };

type Props = { children: React.ReactNode };

export default function ClerkLocaleProvider({ children }: Props) {
  const pathname = usePathname();
  // First path segment is the locale prefix for non-default locales (/de/..., /fr/...).
  // Default locale (en) has no prefix, so fall back to "en".
  const segment = pathname?.split("/")[1] ?? "";
  const locale = (locales as readonly string[]).includes(segment) ? segment : "en";
  const localization = clerkLocales[locale as keyof typeof clerkLocales] ?? enUS;

  return (
    <ClerkProvider
      localization={localization}
      signUpForceRedirectUrl="/dashboard/welcome"
      signUpFallbackRedirectUrl="/dashboard/welcome"
      afterSignUpUrl="/dashboard/welcome"
    >
      {children}
    </ClerkProvider>
  );
}
