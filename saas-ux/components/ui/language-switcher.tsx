// saas-ux/components/ui/language-switcher.tsx
"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import { Fragment, useMemo, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { LOCALES, type Locale, DEFAULT_LOCALE } from "@/i18n/locales";

type LangOption = {
  code: Locale;
  label: string;
  flag: string;
};

const ALL_LANG: readonly LangOption[] = [
  { code: "en", label: "English", flag: "/flags/us.svg" },
  { code: "de", label: "Deutsch", flag: "/flags/de.svg" },
  { code: "es", label: "Español", flag: "/flags/es.svg" },
  { code: "fr", label: "Français", flag: "/flags/fr.svg" },
  { code: "it", label: "Italiano", flag: "/flags/it.svg" },
  { code: "pt", label: "Português", flag: "/flags/br.svg" },
];

function FlagIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="relative block w-5 h-5 overflow-hidden rounded-sm">
      <Image src={src} alt={alt} fill sizes="20px" className="object-cover" />
    </span>
  );
}

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  const languages = useMemo(
    () => ALL_LANG.filter((l) => LOCALES.includes(l.code)),
    []
  );

  const active = languages.find((l) => l.code === locale) ?? languages[0];

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
      try {
        await fetch("/api/user/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: code }),
        });
      } catch {
        // Ignore errors; path navigation still applies the locale
      }

      await router.replace(pathWithLocale(code));
      router.refresh();
    });
  }

  return (
    <Menu as="div" className="relative inline-block text-left text-xs">
      <MenuButton
        aria-label="Change language"
        className="flex items-center gap-1 rounded-sm px-2 py-1 transition-colors text-[var(--text-default)] hover:bg-[var(--card-bg)]/70"
        disabled={pending}
      >
        <FlagIcon src={active.flag} alt={active.label} />
        <ChevronDown className="w-4 h-4 text-[var(--text-subtle)]" />
      </MenuButton>

      <Transition
        as={Fragment}
        enter="motion-safe:transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1 scale-95"
        enterTo="opacity-100 translate-y-0 scale-100"
        leave="motion-safe:transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0 scale-100"
        leaveTo="opacity-0 translate-y-1 scale-95"
      >
        <MenuItems className="absolute right-0 mt-2 w-44 origin-top-right rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg focus:outline-none z-50">
          {languages
            .filter((l) => l.code !== active.code)
            .map((l) => (
              <MenuItem key={l.code}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => changeLang(l.code)}
                    className={`flex items-center w-full px-2 py-1.5 gap-2 text-left transition-colors ${
                      focus
                        ? "bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-[var(--text-default)]"
                    }`}
                    disabled={pending}
                  >
                    <FlagIcon src={l.flag} alt={l.label} />
                    <span>{l.label}</span>
                  </button>
                )}
              </MenuItem>
            ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
