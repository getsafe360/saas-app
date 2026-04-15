//saas-ux/components/ui/footer.tsx
"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { SecurePaymentBadge } from "../stripe/stripe-secure-payments";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--footer-bg)] transition-colors duration-300 mt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Copyright */}
        <div className="text-[var(--text-subtle)] text-sm">
          {t("copyright", { year })}
        </div>
        {/* Center: Footer navigation */}
        <nav className="flex gap-6">
          <Link
            href="/support"
            className="hover:underline text-[var(--text-subtle)] text-sm"
          >
            {t("support")}
          </Link>
          <Link
            href="/terms"
            className="hover:underline text-[var(--text-subtle)] text-sm"
          >
            {t("terms")}
          </Link>
          <Link
            href="/privacy"
            className="hover:underline text-[var(--text-subtle)] text-sm"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/contact"
            className="hover:underline text-[var(--text-subtle)] text-sm"
          >
            {t("contact")}
          </Link>
          <Link
            href="/imprint"
            className="hover:underline text-[var(--text-subtle)] text-sm"
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
            <svg
              viewBox="0 0 240 240"
              className="w-5 h-5 fill-[var(--text-subtle)] hover:fill-sky-600 transition"
              style={{ transform: "scaleY(-1)" }}
              role="img"
              aria-label="GitHub"
            >
              <path d="M97 230.1c-30.5-6.8-55.5-23.7-72.7-49.3-30.1-45.1-24.1-105.6 14.3-144.2 11.5-11.6 29-22.8 42.2-27.1 4.9-1.6 5.5-1.6 7.7-.1 2.4 1.6 2.5 2 2.5 13.5v11.8l-8.8-.5c-10.3-.5-18.3 1.3-23.1 5.4-1.7 1.4-5 6.2-7.3 10.6-3.8 7.4-6.6 10.8-14.4 17.7-2.6 2.3-2.7 2.4-.9 3.7 4.3 3.2 13 .1 18.5-6.5 9.6-11.7 13.3-14.8 18.8-16 4.9-1 9.4-.6 16.2 1.4.9.3 2.1 2.4 2.7 4.8.6 2.3 2.2 5.8 3.5 7.7l2.4 3.5-8.1 1.6c-17 3.5-27.5 9.6-34.4 20-6.4 9.6-8.5 17.9-8.6 33.4 0 14.6 1.6 20.6 7.9 28.8 2.8 3.6 3.1 4.7 2.3 6.8-1.5 3.6-1.1 18.8.5 23.4 1.3 3.4 2 4 4.7 4.3 4.5.5 12.9-2.4 21.4-7.2l7.3-4.2 6.4 1.5c9.1 2.1 36.4 2 44.6 0l6.2-1.6 5.8 3.5c7.7 4.6 17.5 8.2 22.4 8.2 3.9 0 3.9-.1 5.5-5.2 1.7-5.9 2-16.6.5-21.7-.8-3-.6-3.9 1.6-6.8 10.9-14.4 12.1-38.3 2.9-57.9-6.2-12.9-19.3-21.9-36.9-25.2l-8.4-1.6 3.1-5.5 3.2-5.6.3-22.3.4-22.3 2.5-1.6c2.3-1.5 2.8-1.5 7.6.2 8 2.7 21.7 10.1 29.2 15.8 44.6 33.4 59 93.3 34.3 143.1-14.5 29.3-41.9 51.8-73.3 60.2-13.7 3.6-39.5 4.4-52.5 1.5z" />
            </svg>
          </Link>
          <Link
            href="https://linkedin.com/company/getsafe360"
            target="_blank"
            aria-label="LinkedIn"
          >
            <svg
              viewBox="0 0 45.959 45.959"
              className="w-[18px] h-[18px] fill-[var(--text-subtle)] hover:fill-sky-600 transition"
              role="img"
              aria-label="LinkedIn"
            >
              <path d="M5.392.492C2.268.492 0 2.647 0 5.614c0 2.966 2.223 5.119 5.284 5.119 1.588 0 2.956-.515 3.957-1.489.96-.935 1.489-2.224 1.488-3.653C10.659 2.589 8.464.492 5.392.492zM7.847 7.811c-.62.603-1.507.922-2.563.922C3.351 8.733 2 7.451 2 5.614c0-1.867 1.363-3.122 3.392-3.122 1.983 0 3.293 1.235 3.338 3.123-.001.862-.314 1.641-.883 2.196zM.959 45.467h8.988V12.422H.959v33.045zm2-31.045h4.988v29.044H2.959V14.422zM33.648 12.422c-4.168 0-6.72 1.439-8.198 2.792l-.281-2.792H15v33.044h9.959V28.099c0-.748.303-2.301.493-2.711 1.203-2.591 2.826-2.591 5.284-2.591 2.831 0 5.223 2.655 5.223 5.797v16.874h10V26.798c0-9.878-6.382-14.376-12.311-14.376zm10.311 31.045h-6V28.593c0-4.227-3.308-7.797-7.223-7.797-2.512 0-5.358 0-7.099 3.75-.359.775-.679 2.632-.679 3.553v15.368H17V14.422h6.36l.408 4.044h1.639l.293-.473c.667-1.074 2.776-3.572 7.948-3.572 4.966 0 10.311 3.872 10.311 12.374v16.672z" />
            </svg>
          </Link>
          <Link href="mailto:help@getsafe360.ai" aria-label="Email">
            <Mail className="w-5 h-5 text-[var(--text-subtle)] hover:text-sky-600 transition" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
