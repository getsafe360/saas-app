// lib/server/isAdminRequest.ts
// Works in both Edge and Node runtimes — no DB roundtrip.
// Add Clerk user IDs to ADMIN_CLERK_USER_IDS (comma-separated) to grant bypass.
import { auth } from '@clerk/nextjs/server';

export async function isAdminRequest(): Promise<boolean> {
  const raw = process.env.ADMIN_CLERK_USER_IDS ?? '';
  if (!raw.trim()) return false;
  const adminIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (adminIds.length === 0) return false;
  const { userId } = await auth();
  return !!userId && adminIds.includes(userId);
}
