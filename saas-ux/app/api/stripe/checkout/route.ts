// app/api/stripe/checkout/route.ts
//
// Legacy success URL. It used to read a Checkout Session and call setSession()
// for the user whose id was in session.client_reference_id, i.e. it signed a
// visitor in knowing nothing but a session id. client_reference_id now carries a
// TEAM id, so that lookup could even log a buyer in as a different user.
//
// Fulfilment is done by the Stripe webhook and sign-in by Clerk, so this route
// only forwards to the success page (kept so old links and in-flight sessions
// do not 404).
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id') ?? '';
  const target = new URL('/checkout/success', request.url);
  if (/^cs_[A-Za-z0-9_]+$/.test(sessionId)) target.searchParams.set('session_id', sessionId);
  return NextResponse.redirect(target);
}
