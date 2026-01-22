// app/api/stripe/link-purchase/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the session ID from request body
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get customer ID from session
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    if (!customerId) {
      return NextResponse.json(
        { error: 'No customer found in session' },
        { status: 400 }
      );
    }

    // Update Stripe customer metadata with Clerk user ID
    await stripe.customers.update(customerId, {
      metadata: {
        clerkUserId: userId,
      },
    });

    // If this is a subscription, update subscription metadata too
    if (session.subscription) {
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          clerkUserId: userId,
        },
      });
    }

    // TODO: Update your database with the subscription/purchase details
    // This is where you'd create or update records in your database:
    // - Link the Stripe customer ID to the user
    // - Create subscription record if applicable
    // - Add tokens if it's a token pack purchase

    return NextResponse.json({
      success: true,
      message: 'Purchase linked successfully',
    });
  } catch (error) {
    console.error('Error linking purchase:', error);
    return NextResponse.json(
      { error: 'Failed to link purchase' },
      { status: 500 }
    );
  }
}
