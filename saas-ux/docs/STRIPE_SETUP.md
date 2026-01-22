# Stripe Checkout Setup Guide

This guide explains how to configure Stripe Payment Links to work seamlessly with the GetSafe 360 authentication flow.

## Overview

The checkout flow works as follows:

1. **User clicks "Subscribe"** → Redirects to Stripe Checkout (no authentication required)
2. **User completes payment** → Stripe redirects to success page with session ID
3. **Success page prompts authentication** → User signs up or signs in
4. **Purchase is linked** → Webhook or API links Stripe customer to user account
5. **User is redirected to dashboard** → Full access to purchased features

## Stripe Configuration

### 1. Configure Payment Link Success URLs

For each Payment Link in your Stripe dashboard, set the **After payment** redirect URL:

#### Pro Plan
```
https://yourdomain.com/checkout/success?session_id={CHECKOUT_SESSION_ID}
```

#### Agency Plan
```
https://yourdomain.com/checkout/success?session_id={CHECKOUT_SESSION_ID}
```

#### Token Packs (Small, Medium, Large)
```
https://yourdomain.com/checkout/success?session_id={CHECKOUT_SESSION_ID}
```

> **Important:** `{CHECKOUT_SESSION_ID}` is a Stripe template variable that will be automatically replaced with the actual session ID.

### 2. Get the Payment Link URLs

After creating each Payment Link, Stripe provides a shareable URL like:
```
https://buy.stripe.com/XXXXXXXXXX
```

Update these URLs in `/lib/plans/config.ts`:

```typescript
// For Pro Plan
stripeCheckoutUrl: 'https://buy.stripe.com/XXXXXXXXXX',

// For Agency Plan
stripeCheckoutUrl: 'https://buy.getsafe360.ai/b/14AbJ09s61mE2cF5W2bAs01?locale=en',

// For Token Packs
stripeCheckoutUrl: 'https://buy.stripe.com/YYYYYYYYYY',
```

## How It Works

### User Flow Without Account

1. User clicks subscribe button
2. Redirected to Stripe checkout (opens in new tab)
3. Completes payment with email: `user@example.com`
4. Redirected to `/checkout/success?session_id=cs_xxx`
5. Sees success message with prompt to create account
6. **Critical:** User must sign up with **same email** (`user@example.com`)
7. API links Stripe customer to user account via email match
8. User is redirected to dashboard with active subscription

### User Flow With Existing Account

1. User clicks subscribe button
2. Redirected to Stripe checkout
3. Completes payment
4. Redirected to `/checkout/success?session_id=cs_xxx`
5. Already signed in → API automatically links purchase
6. Redirected to dashboard immediately

## Important Email Matching

The system uses **email matching** to link Stripe purchases to user accounts:

- Stripe customer email: `user@example.com`
- User must sign up/sign in with: `user@example.com`
- System matches these emails to link the purchase

**Note to users on success page:**
> "Use the same email address you used for your Stripe payment to ensure your purchase is automatically linked to your account."

## Webhook Integration (Future Enhancement)

For production, consider adding a Stripe webhook to handle:

1. `checkout.session.completed` - Link customer immediately after payment
2. `customer.subscription.created` - Create subscription in your database
3. `invoice.paid` - Handle recurring payments
4. `customer.subscription.deleted` - Handle cancellations

The webhook can automatically link purchases even before the user signs up, making the process smoother.

## Testing

### Test the Flow

1. **Create test payment links** in Stripe test mode
2. **Update config** with test URLs
3. **Complete test purchase** using test card: `4242 4242 4242 4242`
4. **Verify redirect** to success page
5. **Sign up with same email** used in test checkout
6. **Verify purchase is linked** to account

### Test Cards

- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0027 6000 3184`
- Decline: `4000 0000 0000 0002`

## Security Considerations

1. **Session verification** - API verifies session ID with Stripe before linking
2. **Email matching** - Only links if emails match exactly
3. **Authentication required** - Can't access purchase without account
4. **Metadata tracking** - Stores Clerk user ID in Stripe customer metadata

## Troubleshooting

### Purchase not linking to account

- **Check:** User signed up with same email as Stripe payment
- **Check:** Session ID is present in URL
- **Check:** API endpoint `/api/stripe/link-purchase` is working
- **Check:** Stripe API key is configured in environment variables

### Redirect not working

- **Check:** Payment Link success URL is configured in Stripe
- **Check:** URL includes `{CHECKOUT_SESSION_ID}` template variable
- **Check:** Domain matches your production/staging environment

### Email mismatch

- **Solution:** User must use the same email for both Stripe and account signup
- **Alternative:** Implement webhook to link by customer ID instead

## Environment Variables

Required in `.env.local`:

```bash
# Stripe API keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Clerk (authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

## Next Steps

1. ✅ Configure Stripe Payment Link success URLs
2. ✅ Update payment link URLs in `/lib/plans/config.ts`
3. ✅ Test the complete flow in test mode
4. ⬜ Consider implementing webhook for automatic linking
5. ⬜ Add database integration to store subscription details
6. ⬜ Monitor and optimize the conversion funnel
