'use server';

import { redirect } from 'next/navigation';
import { createCustomerPortalSession } from './stripe';
import { createCheckoutSession } from '@/lib/server/payments/checkout';
import { withTeam } from '@/lib/auth/middleware';
import { getUser } from '@/lib/db/queries';
import { TOKEN_PACKS, PLANS } from '@/lib/plans/config';

export const checkoutAction = withTeam(async (formData, team) => {
    const priceId = formData.get('priceId') as string;
    const user = await getUser();

    if (!team || !user) {
        redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
    }

    // Validate priceId against known plans and packs
    const isSubscription = Object.values(PLANS).some(plan => plan.stripePriceId === priceId);
    const tokenPack = TOKEN_PACKS.find(pack => pack.stripePriceId === priceId);

    if (!isSubscription && !tokenPack) {
        throw new Error(`Invalid priceId: ${priceId}. Must match a valid plan or token pack.`);
    }

    const mode = isSubscription ? 'subscription' : 'payment';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const session = await createCheckoutSession({
        customerId: team.stripeCustomerId || undefined,
        customerEmail: user.email || undefined,
        priceId,
        mode,
        successUrl: `${baseUrl}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/plans`,
        teamId: team.id,
        planSlug: isSubscription ? Object.values(PLANS).find(p => p.stripePriceId === priceId)?.name : undefined,
        packSlug: tokenPack?.id,
        allowPromotionCodes: true,
    });

    // Validate session URL before redirect
    if (!session.url) {
        throw new Error('Stripe session created but no checkout URL was returned');
    }

    redirect(session.url);
});

export const customerPortalAction = withTeam(async (_, team) => {
    const portalSession = await createCustomerPortalSession(team);
    redirect(portalSession.url);
});