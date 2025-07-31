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
        <Link title="GetSafe" href="/" className="min-w-md flex items-center">
          <Logo size={35} />
            <span className="ml-2 text-xl subpixel-antialiased">Get<span className="ml-0.5">Safe</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 133 134" className="max-w-[12px] max-h-[12px] -mt-2.5">
            <path fill="currentColor" d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67"></path>
            </svg>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-6 text-lg uppercase font-light tracking-wide">
          <Link
            href="/optimizer"
            title="Optimizer"
            className="hover:underline hover:decoration-sky-600"
          >
            Optimizer
          </Link>
          <Link
            href="/pricing"
            className="hover:underline hover:decoration-sky-600"
          >
            Pricing
          </Link>
          <Link
            href="/accessibility"
            title="Accessibility Audit"
            className="hover:underline hover:decoration-sky-600"
          >
            Accessibility
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
