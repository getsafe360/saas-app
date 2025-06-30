"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { BgColorSelector } from "@/components/ui/bg-color-selector";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton
} from "@clerk/nextjs";

export function Header() {
  return (
      <header className="border-b dark:bg-[#080B0E] dark:border-[#1b2430]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        {/* Logo and App Name */}
        <Link title="GetSafe" href="/" className="flex items-center">
          <Logo size={48} />
            <span className="ml-2 text-base antialiased font-semibold">
                      GetSafe <span className="font-normal text-sm text-blue-950 dark:text-blue-400">360°</span>
            </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-6">
          <Link
            href="/optimizer"
            className="text-sm font-semibold text-sky-600 hover:underline"
          >
            Optimizer
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-semibold text-sky-600 hover:underline"
          >
            Pricing
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-sky-600 hover:underline"
          >
            FAQ
          </Link>
            <BgColorSelector />
            <LanguageSwitcher />
          <Suspense fallback={<div className="h-9" />}>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-sky-600 text-white font-semibold px-4 py-2 rounded-full ml-2">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
