'use client';

import { SignedIn, SignedOut, SignUpButton } from "@clerk/clerk-react";
import { UserGreeting } from "@/components/ui/user-greeting";
import { useTranslations } from 'next-intl';
import { PricingTable } from "@/components/ui/pricing-table";

export default function PricingPage() {
  const t = useTranslations('pricing');

  return (
    <main className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[90vh] bg-[--page-bg] transition-colors">
      <div className="max-w-5xl w-full mx-auto">
        {/* Headline Section */}
      <SignedIn>
        <UserGreeting />
      </SignedIn>
        <SignedOut>
        <section className="mb-10">
          <h1 className="tracking-tight text-center mb-4">
            <span className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-sky-500 via-purple-800 to-red-600 bg-clip-text text-transparent">
              {t('headline1')}
            </span>
            <span className="font-extrabold text-6xl text-yellow-600 block">
              {t('headline2')}
            </span>
          </h1>
          <h2 className="text-xl font-semibold sm:text-2xl text-center mb-8">
            {t.rich('subheadline', {
              span: (chunks) => <span className="block font-bold">{chunks}</span>,
            })}
          </h2>
        </section>
        <PricingTable />
        </SignedOut>
      </div>
    </main>
  );
}