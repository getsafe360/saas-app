// app/[locale]/(dashboard)/dashboard/sites/[id]/seo-analysis/page.tsx
// Full-page SEO GEO Analysis report — streams live findings in a tabbed layout.

import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { getDbUserFromClerk, findCurrentUserTeam } from "@/lib/auth/current";
import { SEOAnalysisPage } from "@/components/site-cockpit/cards/seo/SEOAnalysisPage";
import { PLAN_FEATURES } from "@/lib/plans/config";
import type { PlanName } from "@/lib/plans/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SeoAnalysisPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { locale, id } = await params;
  const { start } = await searchParams;

  // Resolve current user — gates the entire page
  const dbUser = await getDbUserFromClerk();
  if (!dbUser) return notFound();

  // Fetch site scoped to this user to prevent cross-tenant data exposure
  const db = getDb();
  const [site] = await db
    .select({ id: sites.id, siteUrl: sites.siteUrl, connectionStatus: sites.connectionStatus, cms: sites.cms })
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.userId, dbUser.id)))
    .limit(1);

  if (!site) return notFound();

  // Fetch token balance server-side so it always reflects pre-analysis state,
  // avoiding a race condition when autoStart triggers the stream simultaneously.
  const team = await findCurrentUserTeam();
  // Read all three fields directly from DB — never derive tokensUsedThisMonth from
  // tokensIncluded - tokensRemaining because tokensRemaining can exceed tokensIncluded
  // when admin bonuses or purchased packs have been applied.
  const tokensUsedThisMonth = team?.tokensUsedThisMonth ?? 0;
  const tokensAvailable = team?.tokensRemaining ?? (team?.tokensIncluded ?? 5000);
  // Total budget = what's been used + what's still available (the bar denominator)
  const tokensTotal = tokensAvailable + tokensUsedThisMonth;

  const planName = (team?.planName ?? "free") as PlanName;
  const showTokenCost = PLAN_FEATURES[planName]?.showTokenCost ?? true;

  return (
    <SEOAnalysisPage
      siteId={id}
      siteUrl={site.siteUrl}
      locale={locale}
      autoStart={start === "true"}
      tokensIncluded={tokensTotal}
      tokensUsedThisMonth={tokensUsedThisMonth}
      showTokenCost={showTokenCost}
      connectionStatus={(site.connectionStatus ?? "disconnected") as "connected" | "disconnected"}
      cmsType={site.cms ?? undefined}
    />
  );
}
