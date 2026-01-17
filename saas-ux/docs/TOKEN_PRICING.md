# Token-Based Pricing System

## Overview

GetSafe 360 uses an innovative pricing model that combines:

- **Unlimited free site analyses** - Remove all barriers to entry
- **Token-based AI fix pricing** - Pay only for AI work, not analyses
- **Fair usage caps** - Soft limits for Pro users, hard limits for Free users

## Pricing Tiers

### Free Plan (€0/month)
- ✅ Unlimited site analyses
- 🎟️ 5,000 tokens/month (~2-3 AI fixes)
- Hard cap: No fixes when tokens run out

### Pro Plan (€19/month)
- ✅ Unlimited site analyses
- 🎟️ 100,000 tokens/month (~50 AI fixes)
- Soft cap: Throttled when tokens run out (still works, just slower)
- Stripe Price ID: `price_1SpxHnCs6GUQsp1IUuZiUj99`

### Agency Plan (€49/month)
- ✅ Unlimited site analyses
- 🎟️ 300,000 tokens/month (~150 AI fixes)
- Soft cap: Throttled when tokens run out
- Stripe Price ID: `price_1SpxuBCs6GUQsp1IriBKXbat`

## Token Packs (One-Time Purchases)

Users can purchase additional tokens that **never expire**:

| Pack | Tokens | Price | Price ID |
|------|--------|-------|----------|
| Small | 10,000 (~5 fixes) | €5 | `price_1SqaxtCs6GUQsp1IL0d9dOgV` |
| Medium | 25,000 (~12 fixes) | €10 | `price_1SqazKCs6GUQsp1IP9mYvV5n` |
| Large | 40,000 (~20 fixes) | €15 | `price_1Sqb0CCs6GUQsp1INNhNduLq` |

## Token Economics

- **Average tokens per AI fix**: ~2,000 tokens
- **Average API cost per fix**: ~$0.04
- **Site analyses**: Free (0 tokens)

## Database Schema

### Teams Table

```typescript
{
  // Plan configuration
  planName: 'free' | 'pro' | 'agency'
  subscriptionStatus: 'active' | 'canceled' | 'past_due'

  // Token tracking
  tokensIncluded: number        // Monthly allowance based on plan
  tokensUsedThisMonth: number   // Resets each billing cycle
  tokensPurchased: number       // One-time packs (never expire)

  // Billing cycle
  billingCycleStart: Date       // When current cycle started

  // Usage alerts
  notifiedAt80Percent: boolean  // Alert sent at 80% usage
  notifiedAt100Percent: boolean // Alert sent at 100% usage

  // Stripe integration
  stripeCustomerId: string
  stripeSubscriptionId: string
}
```

## Usage Tracking

### Calculating Available Tokens

```typescript
const totalTokens = tokensIncluded + tokensPurchased;
const available = totalTokens - tokensUsedThisMonth;
```

### Usage Thresholds

- **80%** - Send warning notification
- **100%** - Send critical alert (hard cap for free users)

## Implementation

### Core Files

1. **`lib/plans/config.ts`** - Plan configurations and Stripe price IDs
2. **`lib/usage/tokens.ts`** - Token tracking functions
3. **`lib/db/schema/auth/teams.ts`** - Database schema with token fields
4. **`lib/auth/sync-clerk-user.ts`** - Sets default free plan on signup

### Key Functions

#### Get Token Balance
```typescript
import { getTokenBalance } from '@/lib/usage/tokens';

const balance = await getTokenBalance(teamId);
// Returns: { tokensAvailable, usagePercentage, needsAlert, ... }
```

#### Check Availability
```typescript
import { checkTokenAvailability } from '@/lib/usage/tokens';

const { available, balance } = await checkTokenAvailability(teamId, 2000);
if (!available) {
  // Show "Buy tokens" UI
}
```

#### Deduct Tokens
```typescript
import { deductTokens } from '@/lib/usage/tokens';

const newBalance = await deductTokens(teamId, 2000, 'AI fix applied');
if (!newBalance) {
  // Insufficient tokens
}
```

#### Add Purchased Tokens
```typescript
import { addPurchasedTokens } from '@/lib/usage/tokens';

await addPurchasedTokens(teamId, 10000, stripePaymentIntentId);
```

## Stripe Integration

### Webhooks to Handle

1. **`checkout.session.completed`** - Handle subscription or token pack purchases
2. **`customer.subscription.updated`** - Update plan when subscription changes
3. **`customer.subscription.deleted`** - Downgrade to free when subscription canceled
4. **`invoice.payment_succeeded`** - Reset monthly tokens on billing cycle

### Example Webhook Handler

```typescript
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;

  if (session.mode === 'subscription') {
    // Handle subscription purchase
    const plan = getPlanByPriceId(session.line_items[0].price.id);
    await updatePlanTokens(teamId, plan.name);
  } else {
    // Handle token pack purchase
    const pack = getTokenPackByPriceId(session.line_items[0].price.id);
    await addPurchasedTokens(teamId, pack.tokens);
  }
}
```

## Billing Cycle Management

Monthly tokens should reset at the start of each billing cycle:

```typescript
import { resetMonthlyUsage } from '@/lib/usage/tokens';

// Call this via cron job at billing cycle start
await resetMonthlyUsage(teamId);
```

**Note**: Set up a daily cron job to check `billingCycleStart` dates and reset usage for teams that have reached their next billing cycle.

## Usage Alerts

Monitor token usage and send alerts:

```typescript
import { getTeamsNeedingAlerts, markNotificationSent } from '@/lib/usage/tokens';

// Call via cron job (e.g., hourly)
const teams = await getTeamsNeedingAlerts();

for (const team of teams) {
  if (team.alertType === 'warning') {
    // Send 80% warning email
    await sendUsageWarningEmail(team);
    await markNotificationSent(team.teamId, 'warning');
  } else {
    // Send 100% critical alert
    await sendCriticalAlertEmail(team);
    await markNotificationSent(team.teamId, 'critical');
  }
}
```

## Migration Steps

### 1. Update Database Schema

```bash
cd saas-ux
pnpm db:push
```

This will add the new token tracking columns to the `teams` table.

### 2. Set Defaults for Existing Teams

```sql
UPDATE teams
SET
  plan_name = 'free',
  subscription_status = 'active',
  tokens_included = 5000,
  tokens_used_this_month = 0,
  tokens_purchased = 0,
  billing_cycle_start = CURRENT_DATE,
  notified_at_80_percent = false,
  notified_at_100_percent = false
WHERE plan_name IS NULL;
```

### 3. Test the Integration

1. Create a new user → Should get 5K tokens
2. Check token balance → Should show correct values
3. Deduct tokens → Should decrease available tokens
4. Purchase token pack (test mode) → Should add to balance

## Testing with Stripe

Use Stripe test mode with these test cards:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

## Production Checklist

- [ ] Update Stripe webhook endpoint in Stripe Dashboard
- [ ] Add webhook secret to environment variables
- [ ] Test subscription purchase flow
- [ ] Test token pack purchase flow
- [ ] Set up cron jobs for:
  - [ ] Monthly usage resets
  - [ ] Usage alert notifications
- [ ] Configure email templates for alerts
- [ ] Test upgrade/downgrade flows
- [ ] Monitor token deduction accuracy

## Future Enhancements

- **Analytics Dashboard**: Show token usage over time
- **Usage Predictions**: Estimate when team will run out of tokens
- **Auto Top-Up**: Automatically purchase token packs when low
- **Team Sharing**: Share tokens across team members
- **Custom Plans**: Enterprise plans with custom token amounts
