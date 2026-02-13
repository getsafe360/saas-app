//saas-ux/components/ui/footer.tsx
"use client";

import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { SecurePaymentBadge } from "../stripe/stripe-secure-payments";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className=" border-t border-color-[--border-default] bg-[oklch(from_var(--color-neutral-900)_l_c_h_/_1)] dark:bg-[oklch(from_var(--color-neutral-50)_l_c_h_/_1)] mt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Copyright */}
        <div className="text-gray-600 dark:text-gray-300 text-sm">
          {t("copyright", { year })}
        </div>
        {/* Center: Footer navigation */}
        <nav className="flex gap-6">
          <Link
            href="/support"
            className="hover:underline text-gray-600 dark:text-gray-300 text-sm"
          >
            {t("support")}
          </Link>
          <Link
            href="/terms"
            className="hover:underline text-gray-600 dark:text-gray-300 text-sm"
          >
            {t("terms")}
          </Link>
          <Link
            href="/privacy"
            className="hover:underline text-gray-600 dark:text-gray-300 text-sm"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/contact"
            className="hover:underline text-gray-600 dark:text-gray-300 text-sm"
          >
            {t("contact")}
          </Link>
          <Link
            href="/imprint"
            className="hover:underline text-gray-600 dark:text-gray-300 text-sm"
          >
            {t("imprint")}
          </Link>
        </nav>

        {/* Center-Right: Stripe badge */}
        <div className="flex items-center">
          <SecurePaymentBadge />
        </div>

        {/* Right: Social icons */}
        <div className="flex gap-4">
          <Link
            href="https://github.com/getsafe360"
            target="_blank"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5 text-gray-500 hover:text-sky-600 transition" />
          </Link>
          <Link
            href="https://linkedin.com/company/getsafe360"
            target="_blank"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-5 h-5 text-gray-500 hover:text-sky-600 transition" />
          </Link>
          <Link href="mailto:help@getsafe360.com" aria-label="Email">
            <Mail className="w-5 h-5 text-gray-500 hover:text-sky-600 transition" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
