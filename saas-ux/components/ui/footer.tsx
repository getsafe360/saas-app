"use client";

import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";
import { useTranslations } from 'next-intl';
export function Footer() {
    const t = useTranslations('footer');
    const year = new Date().getFullYear();
    return (
        <footer className="border-t dark:bg-[#080B0E] dark:border-[#1b2430] mt-2">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Left: Copyright */}
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                    {t("copyright", { year })}
                </div>
                {/* Center: Footer navigation */}
                <nav className="flex gap-6">
                    <Link href="/privacy" className="hover:underline text-gray-600 dark:text-gray-300 text-sm">
                        {t('privacy')}
                    </Link>
                    <Link href="/terms" className="hover:underline text-gray-600 dark:text-gray-300 text-sm">
                        {t('terms')}
                    </Link>
                    <Link href="/contact" className="hover:underline text-gray-600 dark:text-gray-300 text-sm">
                        {t('contact')}
                    </Link>
                </nav>
                {/* Right: Social icons */}
                <div className="flex gap-4">
                    <Link href="https://github.com/getsafe360" target="_blank" aria-label="GitHub">
                        <Github className="w-5 h-5 text-gray-500 hover:text-sky-600 transition" />
                    </Link>
                    <Link href="https://linkedin.com/company/getsafe360" target="_blank" aria-label="LinkedIn">
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
