'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignUpButton } from '@clerk/clerk-react';
import { SubmitButton } from '@/components/ui/submit-button';
import { CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { PLANS, TOKEN_PACKS } from '@/lib/plans/config';
import { StripeBuyButton } from '@/components/stripe/stripe-buy-button';

export function PricingCards() {
  const t = useTranslations('plans');

  return (
    <div className="space-y-16">
      {/* Subscription Plans */}
      <div>
        <h2 className="text-3xl font-bold text-center mb-8">{t('subscriptions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <Card className="shadow-lg shadow-green-500/20 dark:bg-[#1f2123] border-[--thin-border] border-green-700 rounded-xl flex flex-col">
            <CardHeader>
              <CardTitle className="text-3xl mb-2">{PLANS.free.displayName}</CardTitle>
              <div className="text-4xl font-bold mb-2">{PLANS.free.priceDisplay}</div>
              <div className="text-muted-foreground text-sm mb-4">
                {t('subscriptions.free.description')}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ul className="mb-6 space-y-3 flex-1">
                {PLANS.free.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="text-green-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto w-full">
                <SignUpButton mode="modal">
                  <SubmitButton variant="green" className="w-full">
                    {t('subscriptions.free.cta')}
                  </SubmitButton>
                </SignUpButton>
              </div>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="shadow-xl shadow-blue-500/30 dark:bg-[#1f2123] border-[--thin-border] border-blue-800 rounded-xl flex flex-col relative transform md:scale-105 z-10">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t('subscriptions.popular')}
            </span>
            <CardHeader className="pt-8">
              <CardTitle className="text-3xl mb-2">{PLANS.pro.displayName}</CardTitle>
              <div className="mb-3">
                <div className="text-4xl font-bold">
                  {PLANS.pro.priceDisplay}
                  <span className="text-lg font-normal text-muted-foreground">/mo</span>
                </div>
              </div>
              <div className="text-muted-foreground text-sm mb-4">
                {t('subscriptions.pro.description')}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ul className="mb-6 space-y-3 flex-1">
                {PLANS.pro.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="text-blue-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto w-full">
                {PLANS.pro.stripeBuyButtonId && (
                  <StripeBuyButton
                    buyButtonId={PLANS.pro.stripeBuyButtonId}
                    className="w-full"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agency Plan */}
          <Card className="shadow-lg shadow-purple-500/20 dark:bg-[#1f2123] border-[--thin-border] border-purple-700 rounded-xl flex flex-col">
            <CardHeader>
              <CardTitle className="text-3xl mb-2">{PLANS.agency.displayName}</CardTitle>
              <div className="mb-3">
                <div className="text-4xl font-bold">
                  {PLANS.agency.priceDisplay}
                  <span className="text-lg font-normal text-muted-foreground">/mo</span>
                </div>
              </div>
              <div className="text-muted-foreground text-sm mb-4">
                {t('subscriptions.agency.description')}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ul className="mb-6 space-y-3 flex-1">
                {PLANS.agency.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="text-purple-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto w-full">
                {PLANS.agency.stripeBuyButtonId && (
                  <StripeBuyButton
                    buyButtonId={PLANS.agency.stripeBuyButtonId}
                    className="w-full"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Token Packs */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-3">{t('tokenPacks.title')}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('tokenPacks.description')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {TOKEN_PACKS.map((pack) => (
            <Card
              key={pack.id}
              className="hover:shadow-lg transition-shadow dark:bg-[#1f2123] border-[--thin-border] rounded-xl"
            >
              <CardHeader>
                <CardTitle className="text-xl mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  {pack.name}
                </CardTitle>
                <div className="text-3xl font-bold">
                  {pack.priceDisplay}
                </div>
                {pack.savingsPercent && (
                  <div className="text-xs text-green-600 dark:text-green-400 font-semibold">
                    Save {pack.savingsPercent}%
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="mb-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {pack.tokens.toLocaleString()} {t('tokenPacks.tokens')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('tokenPacks.approx', { fixes: Math.floor(pack.tokens / 2000) })}
                  </div>
                </div>
                <StripeBuyButton
                  buyButtonId={pack.stripeBuyButtonId}
                  className="w-full"
                />
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('tokenPacks.neverExpire')}
        </p>
      </div>
    </div>
  );
}
