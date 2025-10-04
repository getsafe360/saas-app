// app/[locale]/(dashboard)/dashboard/sites/page.tsx  (server component)
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/drizzle';
import { sites } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getDbUserFromClerk } from '@/lib/auth/current';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const user = await getDbUserFromClerk();
  if (!user) redirect('/sign-in');

  const db = getDb();
  const rows = await db
    .select()
    .from(sites)
    .where(eq(sites.userId, user.id))
    .orderBy(desc(sites.updatedAt));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">My Websites</h1>

      {rows.length === 0 ? (
        <div className="rounded-lg border p-4">No sites yet. Connect one to get started.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id} className="rounded-lg border p-4 bg-white/60 dark:bg-slate-900/40">
              <div className="font-medium">{s.siteUrl}</div>
              <div className="text-sm opacity-70 mt-1">Status: {s.status}</div>
              <a
                className="inline-block mt-3 text-blue-600 hover:underline"
                href={`/dashboard/sites/${s.id}`}
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
