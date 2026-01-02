// saas-ux/components/ui/language-switcher.tsx
"use client";

import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useMemo, useTransition } from "react";
import { LOCALES, type Locale, DEFAULT_LOCALE } from "@/i18n/locales";

type LangOption = {
  code: Locale;
  label: string;
  flag: string;
};

// Keep this list in sync with your public/flags assets and enabled LOCALES
const ALL_LANG: readonly LangOption[] = [
  { code: "en", label: "English", flag: "/flags/us.svg" },
  { code: "de", label: "Deutsch", flag: "/flags/de.svg" },
  { code: "es", label: "Español", flag: "/flags/es.svg" },
  { code: "fr", label: "Français", flag: "/flags/fr.svg" },
  { code: "it", label: "Italiano", flag: "/flags/it.svg" },
  { code: "pt", label: "Português", flag: "/flags/br.svg" },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  // Filter to only enabled locales (in case ALL_LANG has more entries than LOCALES)
  const languages = useMemo(
    () => ALL_LANG.filter((l) => LOCALES.includes(l.code)),
    []
  );

  const active = languages.find((l) => l.code === locale) ?? languages[0];

  /**
   * Build path with new locale, preserving current route
   * Examples:
   *   /en/dashboard/sites → /de/dashboard/sites
   *   /dashboard         → /de/dashboard (if 'en' is default)
   *   /                  → /de (switching from default locale)
   */
  function pathWithLocale(code: Locale): string {
    const re = new RegExp(`^/(?:${LOCALES.join("|")})(?=/|$)`);
    const suffix = pathname.replace(re, "") || "/";
    return code === DEFAULT_LOCALE
      ? suffix
      : `/${code}${suffix === "/" ? "" : suffix}`;
  }

  async function changeLang(code: Locale) {
    if (code === active.code) return;

    startTransition(async () => {
      // Optional: persist user preference to database/cookies
      try {
        await fetch("/api/user/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: code }),
        });
      } catch {
        // Ignore errors; path navigation still applies the locale
      }

      // Navigate to the locale-prefixed route
      await router.replace(pathWithLocale(code));
      router.refresh(); // Pick up new messages immediately
    });
  }

  return (
    <Menu as="div" className="relative inline-block text-left text-xs">
      <Menu.Button
        aria-label="Change language"
        className="flex items-center px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition focus:outline-none"
        disabled={pending}
      >
        <Image
          src={active.flag}
          alt={active.label}
          width={20}
          height={20}
          className="rounded-sm"
        />
        <ChevronDown className="w-4 h-4 ml-1 text-gray-400" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="motion-safe:transition ease-out duration-300"
        enterFrom="opacity-0 translate-y-1 scale-95"
        enterTo="opacity-100 translate-y-0 scale-100"
        leave="motion-safe:transition ease-in duration-200"
        leaveFrom="opacity-100 translate-y-0 scale-100"
        leaveTo="opacity-0 translate-y-1 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-44 origin-top-right rounded-md border border-black/5 bg-white dark:bg-gray-900 shadow-lg focus:outline-none z-50 will-change-transform will-change-opacity">
          {languages
            .filter((l) => l.code !== active.code)
            .map((l) => (
              <Menu.Item key={l.code}>
                {({ focus: isActive }) => (
                  <button
                    type="button"
                    onClick={() => changeLang(l.code)}
                    className={`flex items-center w-full px-2 py-1.5 gap-2 text-left ${
                      isActive ? "bg-gray-100 dark:bg-neutral-800" : ""
                    }`}
                    disabled={pending}
                  >
                    <Image
                      src={l.flag}
                      alt={l.label}
                      width={20}
                      height={20}
                      className="rounded-sm"
                    />
                    <span>{l.label}</span>
                  </button>
                )}
              </Menu.Item>
            ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
