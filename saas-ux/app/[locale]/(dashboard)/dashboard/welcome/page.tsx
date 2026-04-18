import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { WelcomeClient } from './WelcomeClient';

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

function buildPublicUrlFromKey(key: string) {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL || process.env.BLOB_PUBLIC_BASE;
  if (!base) return null;
  return new URL(key, base).toString();
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; stash?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const sp = await searchParams;
  const stashUrl = sp?.u?.trim();
  const stashKey = sp?.stash?.trim();

  const resolvedStashUrl = stashUrl || (stashKey ? buildPublicUrlFromKey(stashKey) : null);

  return (
    <Suspense>
      <WelcomeClient stashUrl={resolvedStashUrl ?? null} />
    </Suspense>
  );
}
