// lib/db/seed.ts
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { stripe } from '../payments/stripe';
import { getDb } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';

const db = getDb();

async function createStripeProducts() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Skipping Stripe seed: STRIPE_SECRET_KEY not set');
    return;
  }

  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan'
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800,
    currency: 'usd',
    recurring: { interval: 'month', trial_period_days: 7 }
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan'
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200,
    currency: 'usd',
    recurring: { interval: 'month', trial_period_days: 7 }
  });

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const email = process.env.SEED_EMAIL ?? 'test@test.com';
  const password = process.env.SEED_PASSWORD ?? 'admin123';
  const passwordHash = await hashPassword(password);

  // Use a real Clerk user id if you have one, otherwise a deterministic local one.
  const clerkUserId =
    process.env.SEED_CLERK_USER_ID ?? `local-seed-${randomUUID()}`;

  // Create user (required fields: email, passwordHash, clerkUserId)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: 'owner',
      language: 'en',
      clerkUserId
    })
    .returning();

  console.log('Seed user created:', user?.id, email);

  // Create team and membership
  const [team] = await db
    .insert(teams)
    .values({ name: 'Test Team' })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner'
  });

  await createStripeProducts();
}

seed()
  .then(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  });
