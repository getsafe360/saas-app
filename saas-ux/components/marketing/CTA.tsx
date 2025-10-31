"use client";

import * as React from "react";
import {useTranslations} from "next-intl";
import {SignedIn, SignedOut, SignUpButton} from "@clerk/nextjs";
import {Link} from "@/navigation";
import {ArrowRight} from "lucide-react";

/**
* CTA component
* - Matches the new InfoBoxes card aesthetic
* - i18n via "ctaRoot" namespace (see keys below)
* - Uses background layering to create a rotating gradient BORDER only
* (no bleed through the semi-transparent center)
*/
export default function CTA() {
const t = useTranslations("ctaRoot");

return (
<section className="mx-auto max-w-4xl px-3 sm:px-5 lg:px-6 my-8">
{/* CTA card */}   
<div className="cta-effect cta-sky rounded-2xl transition duration-500 ease-in-out">
<div className="rounded-2xl border border-teal-500/40 dark:border-teal-400/30
                bg-white/70 dark:bg-white/[0.04] backdrop-blur supports-[backdrop-filter]:bg-white/60
                p-8 sm:p-10 lg:p-12 shadow-sm relative z-10">
<h2 className="text-4xl font-semibold tracking text-slate-900 dark:text-slate-100 text-center">
{t("headline")}
</h2>
<p className="mt-3 text-center text-slate-700 dark:text-slate-300">
{t("support")}
</p>

<div className="mt-6 flex items-center justify-center gap-3">
<SignedOut>
<SignUpButton mode="modal">
    <div className="mt-4 sm:mt-0">
        <a
        href="/"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-lg ring-1 ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20 transition"
        >
        {t("primary")} <ArrowRight className="size-4" />
        </a>
    </div>
</SignUpButton>
</SignedOut>

<SignedIn>
<Link
href="/dashboard"
className="inline-flex items-center rounded-full px-5 py-2.5 text-medium font-semibold ring-1 ring-sky-600/30 dark:ring-sky-400/30 bg-sky-50 dark:bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-400/20 transition"
>
{t("signedInCta")}
</Link>
</SignedIn>
</div>

<p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
{t("microcopy")}
</p>
</div>
</div>
</section>
);
}