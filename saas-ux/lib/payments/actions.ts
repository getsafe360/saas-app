'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { toSupportedLocale } from '@/lib/server/payments/locale';
import { createCustomerPortalSession } from './stripe';
import { createCheckoutSession } from '@/lib/server/payments/checkout';
import { withTeam } from '@/lib/auth/middleware';
import { getUser } from '@/lib/db/queries';
import { targetForPriceId } from '@/config/billing/catalogue';

export const checkoutAction = withTeam(async (formData, team) => {
    const priceId = formData.get('priceId') as string;
    const user = await getUser();

    if (!team || !user) {
        redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
    }

    // Validate priceId against the catalogue (plans: monthly + yearly, and packs)
    const target = targetForPriceId(priceId);
    if (!target) {
        throw new Error(`Invalid priceId: ${priceId}. Must match a valid plan or token pack.`);
    }

    const mode = target.kind === 'plan' ? 'subscription' : 'payment';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const session = await createCheckoutSession({
        customerId: team.stripeCustomerId || undefined,
        customerEmail: user.email || undefined,
        priceId,
        mode,
        successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/plans`,
        teamId: team.id,
        planSlug: target.kind === 'plan' ? target.plan : undefined,
        billing: target.kind === 'plan' ? target.billing : undefined,
        packSlug: target.kind === 'pack' ? target.pack : undefined,
        allowPromotionCodes: true,
    });

    // Validate session URL before redirect
    if (!session.url) {
        throw new Error('Stripe session created but no checkout URL was returned');
    }

    redirect(session.url);
});

export const customerPortalAction = withTeam(async (_, team) => {
    const locale = toSupportedLocale(await getLocale().catch(() => undefined));
    const portalSession = await createCustomerPortalSession(team, locale);
    redirect(portalSession.url);
});