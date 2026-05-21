// app/api/auth/sync/route.ts
// Provisions a Clerk user in our DB on first login.
// Called client-side from the dashboard layout after sign-in.
// Idempotent — safe to call on every load.
import { NextResponse } from 'next/server';
import { syncClerkUserToDatabase } from '@/lib/auth/sync-clerk-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const userId = await syncClerkUserToDatabase();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'sync_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, userId });
  } catch {
    return NextResponse.json({ ok: false, error: 'sync_error' }, { status: 500 });
  }
}
