// components/header/Header.tsx
"use client";

import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation"; // locale-aware Link + pathname
import { Logo } from "@/components/ui/logo";
import { BgColorSelector } from "@/components/ui/bg-color-selector";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Menu as MenuIcon, X as CloseIcon } from "lucide-react";
import HeaderAuthCta from "@/components/header/HeaderAuthCta.client";

function NavLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={[
        "px-2 py-1 rounded transition-colors",
        "hover:text-sky-600 hover:bg-black/[0.03] dark:hover:bg-white/5",
        active ? "text-sky-600" : "text-slate-800 dark:text-slate-200",
        "uppercase tracking-wide text-sm font-light",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const mobilePanelId = "mobile-nav";

  const items = useMemo(
    () =>
      [
        { href: "/pricing", label: t("pricing") },
        { href: "/faq", label: t("faq") },
        { href: "/dashboard", label: t("dashboard") },
      ] as const,
    [t]
  );

  return (
    <>
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[999] focus:px-3 focus:py-2 focus:rounded-md focus:bg-sky-600 focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-[#1b2430] bg-white/70 dark:bg-[#080B0E]/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Left: Logo */}
            <Link title="GetSafe 360" href="/" className="flex items-center min-w-0">
              <Logo size={32} />
              <span className="ml-2 text-xl font-medium text-slate-900 dark:text-slate-100 subpixel-antialiased">
                Get<span className="ml-0.5">Safe</span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 133 134"
                className="ml-1 h-[12px] w-[12px] -mt-2.5 text-current opacity-80"
              >
                <path
                  fill="currentColor"
                  d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67"
                />
              </svg>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2" aria-label="Primary navigation">
              {items.map((it) => (
                <NavLink key={it.href} href={it.href} label={it.label} />
              ))}

              <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/10" />

              <BgColorSelector />
              <LanguageSwitcher />

              <Suspense fallback={<div className="h-9 w-9" />}>
                <SignedIn>
                  <UserButton />
                </SignedIn>

                {/* Uses Nav.createFreeAccount / Nav.signIn / Nav.signOut internally */}
                <HeaderAuthCta t={t} />
              </Suspense>
            </nav>

            {/* Mobile toggles */}
            <div className="md:hidden flex items-center gap-2">
              <LanguageSwitcher />
              <button
                aria-controls={mobilePanelId}
                aria-expanded={open}
                aria-label={open ? t("closeMenu") : t("openMenu")}
                className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 dark:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/10 transition"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile panel */}
        {open && (
          <div
            id={mobilePanelId}
            className="md:hidden border-t border-slate-200/70 dark:border-[#1b2430] bg-white dark:bg-[#080B0E]"
          >
            <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
              {items.map((it) => (
                <NavLink
                  key={it.href}
                  href={it.href}
                  label={it.label}
                  onClick={() => setOpen(false)}
                />
              ))}
              <div className="my-2 h-px bg-slate-200 dark:bg-white/10" />
              <div className="flex items-center justify-between">
                <BgColorSelector />
                <Suspense fallback={<div className="h-9 w-9" />}>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>

                  <HeaderAuthCta t={t} />
                </Suspense>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
