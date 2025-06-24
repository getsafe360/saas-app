'use server';

import { redirect } from 'next/navigation';
// import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withTeam } from '@/lib/auth/middleware';

export const checkoutAction = withTeam(async (formData, team) => {
// For now, just return a dummy object or message
    return { success: false, message: "Payments temporarily disabled." };
//  const priceId = formData.get('priceId') as string;
//  await createCheckoutSession({ team: team, priceId });
});

export const customerPortalAction = withTeam(async (_, team) => {
// Redirect to a dummy page or display a message
// Example: redirect('/billing-unavailable');
    return { success: false, message: "Customer portal unavailable." };
//  const portalSession = await createCustomerPortalSession(team);
//  redirect(portalSession.url);
});
