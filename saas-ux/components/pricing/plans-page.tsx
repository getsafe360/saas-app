'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LOGICAL_PLANS } from '@/config/billing/plans';
import { TOKEN_PACKS } from '@/config/billing/token-packs';
import { TOKENS_PER_FIX_UNIT } from '@/config/billing/token-economy';

export interface PricingViewerState {
  isLoggedIn: boolean;
  currentPlan?: string | null;
  shouldSuggestProUpgrade?: boolean;
  showLowTokenBanner?: boolean;
}

export function PlansPageContent({ state }: { state: PricingViewerState }) {
  const t = useTranslations('pricing');

  return (
    <main className="flex flex-col py-12 px-4 sm:px-6 lg:px-8 min-h-[90vh] bg-[--page-bg] transition-colors">
      <div className="max-w-7xl w-full mx-auto space-y-12">
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('heroTitle')}</h1>
          <p className="text-lg text-muted-foreground">{t('heroSubtitle')}</p>
        </section>

        {state.shouldSuggestProUpgrade && (
          <section className="rounded-xl border border-blue-300 bg-blue-50/70 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{t('upgradeBannerTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('upgradeBannerBody')}</p>
            </div>
            <Button asChild><Link href={state.isLoggedIn ? (LOGICAL_PLANS.find((p) => p.id === "pro")?.stripeCheckoutUrl ?? "/sign-up?plan=pro") : "/sign-up?plan=pro"}>{t('upgradeBannerCta')}</Link></Button>
          </section>
        )}


        {state.showLowTokenBanner && (
          <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">
            {t('autoReplenishTitle')}: {t('autoReplenishDescription')}
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {LOGICAL_PLANS.map((plan) => {
            const isCurrent = state.currentPlan === plan.id || (state.currentPlan === 'agency' && plan.id === 'agent');
            const cta = plan.id === 'free' ? t('ctaStartFree') : plan.id === 'pro' ? t('ctaStartPro') : plan.id === 'agent' ? t('ctaStartAgent') : t('ctaContactSales');
            const isSubscribed = state.currentPlan === 'pro' || state.currentPlan === 'agent' || state.currentPlan === 'agency';
            const href = (() => {
              if (plan.id === 'business') return '/contact';
              if (!state.isLoggedIn) return `/sign-up?plan=${plan.id}`;
              if (plan.id === 'free') return '/sign-up?plan=free';
              return plan.stripeCheckoutUrl ?? `/sign-up?plan=${plan.id}`;
            })();

            return (
              <Card key={plan.id} className={isCurrent ? 'border-blue-500 shadow-lg' : ''}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="text-2xl font-bold">{plan.monthlyPriceEur === null ? 'Custom' : t('pricePerMonth', { price: `€${plan.monthlyPriceEur}` })}</p>
                  <p className="text-sm text-muted-foreground">{t(`plan${plan.name}Description`)}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />{feature}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="space-y-2">
                      <Button disabled className="w-full">Current plan</Button>
                      {isSubscribed && <Button asChild variant="outline" className="w-full"><Link href="/dashboard/settings">Manage billing</Link></Button>}
                    </div>
                  ) : (
                    <Button asChild className="w-full"><Link href={href}>{cta}</Link></Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-center">{t('sectionTokensTitle')}</h2>
          <p className="text-center text-muted-foreground">{t('sectionTokensSubtitle')}</p>
          <div className="grid md:grid-cols-3 gap-4">
            {TOKEN_PACKS.map((pack) => (
              <Card key={pack.id} className={pack.highlight ? 'border-blue-500' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t(pack.id === 'small' ? 'tokenPackSmallName' : pack.id === 'medium' ? 'tokenPackMediumName' : 'tokenPackLargeName')}</span>
                    {pack.highlight && <span className="text-xs bg-blue-100 px-2 py-1 rounded">{t('tokenPackBestValue')}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold">€{pack.priceEur}</p>
                  <p>{pack.tokens.toLocaleString()} tokens</p>
                  <p className="text-sm text-muted-foreground">{t('tokenPackApproxFixes', { count: Math.floor(pack.tokens / TOKENS_PER_FIX_UNIT) })}</p>
                  <p className="text-xs text-muted-foreground">{t('tokenNoteFixUnits')}</p>
                  <Button asChild className="w-full" variant="outline"><a href={pack.stripeCheckoutUrl} target="_blank">{t('buyTokens')}</a></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-lg border p-4 text-sm text-muted-foreground">
          <p>{t('autoReplenishDescription')}</p>
          <Link href="/dashboard/settings" className="text-blue-600 underline">{t('manageAutoReplenish')}</Link>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold">{t('faqTitle')}</h3>
          {['Tokens', 'FixUnits', 'SwitchPlans', 'TokensExpire'].map((k) => (
            <details key={k} className="rounded border p-4">
              <summary className="font-medium">{t(`faq${k}Question`)}</summary>
              <p className="text-sm text-muted-foreground mt-2">{t(`faq${k}Answer`)}</p>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}
