// saas-ux/components/ui/language-switcher.tsx
"use client";

import { Menu } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useMemo, useTransition } from "react";
import { LOCALES } from "@/i18n/locales";

// Map labels/flags; we’ll filter to supported LOCALES to avoid desync
const ALL_LANG = [
  { code: "en", label: "English",   flag: "/flags/us.svg" },
  { code: "de", label: "Deutsch",   flag: "/flags/de.svg" },
  { code: "es", label: "Español",   flag: "/flags/es.svg" },
  { code: "fr", label: "Français",  flag: "/flags/fr.svg" },
  { code: "it", label: "Italiano",  flag: "/flags/it.svg" },
  { code: "nl", label: "Nederlands",flag: "/flags/nl.svg" },
  { code: "pt", label: "Português", flag: "/flags/br.svg" }, // pt-BR flag
] as const;

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const languages = useMemo(
    () => ALL_LANG.filter(l => LOCALES.includes(l.code as any)),
    []
  );
  const active = languages.find(l => l.code === locale) ?? languages[0];

  function setCookie(code: string) {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `NEXT_LOCALE=${code}; Path=/; Max-Age=${maxAge}`;
  }

  function changeLang(code: string) {
    if (code === active.code) return;

    startTransition(async () => {
      // Try server: persist for signed-in users and set cookie
      try {
        const r = await fetch("/api/user/language", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: code }),
        });
        if (!r.ok) {
          // Not signed in or other error → still set cookie client-side
          setCookie(code);
        }
      } catch {
        setCookie(code);
      }

      // Reload to re-hydrate messages in the chosen locale
      window.location.reload();
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

      <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-md border border-black/5 bg-white dark:bg-gray-900 shadow-lg focus:outline-none z-50">
        {languages
          .filter(l => l.code !== active.code)
          .map(l => (
            <Menu.Item key={l.code}>
              {({ active: isActive }) => (
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
    </Menu>
  );
}
