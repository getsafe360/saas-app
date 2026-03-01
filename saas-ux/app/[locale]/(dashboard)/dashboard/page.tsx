// app/[locale]/(dashboard)/dashboard/page.tsx (SERVER)
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { users } from "@/lib/db/schema/auth/users";
import { teams, teamMembers } from "@/lib/db/schema/auth";
import { and, eq, desc } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DashboardMeta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

function normalizeSiteUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("missing URL");
  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(value).toString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ testedUrl?: string; testId?: string }>;
}) {
  const params = await searchParams;
  const testedUrl = params.testedUrl?.trim();

  // Get Clerk user
  const clerkUser = await currentUser();
  if (!clerkUser) {
    redirect("/sign-in");
  }

  const db = getDb();

  // Get app user from database
  const [appUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1);

  if (!appUser) {
    console.error("[Dashboard] User not found in database");
    redirect("/sign-in");
  }

  if (testedUrl) {
    try {
      const siteUrl = normalizeSiteUrl(testedUrl);
      const parsed = new URL(siteUrl);
      const canonicalHost = parsed.hostname;
      const canonicalRoot = `${parsed.protocol}//${parsed.hostname}`;

      const [existingSite] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.siteUrl, siteUrl), eq(sites.userId, appUser.id)))
        .limit(1);

      const siteId =
        existingSite?.id ??
        (
          await db
            .insert(sites)
            .values({
              siteUrl,
              userId: appUser.id,
              status: "connected",
              canonicalHost,
              canonicalRoot,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .returning({ id: sites.id })
        )[0]?.id;

      if (siteId) {
        redirect(`/dashboard/sites/${siteId}/cockpit`);
      }
    } catch {
      // Ignore handoff failure and continue to dashboard.
    }
  }

  // Get user's team (for plan and token info)
  const [teamMembership] = await db
    .select({
      team: teams,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, appUser.id))
    .limit(1);

  const team = teamMembership?.team;

  // Get user's sites (ordered by most recently updated)
  const userSites = await db
    .select()
    .from(sites)
    .where(eq(sites.userId, appUser.id))
    .orderBy(desc(sites.updatedAt));

  // Prepare data for client
  const dashboardData = {
    user: {
      id: appUser.id,
      name: appUser.name || "User",
      email: appUser.email,
    },
    team: team
      ? {
          id: team.id,
          name: team.name,
          planName: team.planName || "free",
          tokensRemaining: team.tokensRemaining || 0,
          tokensIncluded: team.tokensIncluded || 5000,
          tokensUsed: team.tokensUsedThisMonth || 0,
          subscriptionStatus: team.subscriptionStatus || "active",
        }
      : null,
    sites: userSites.map((site) => ({
      id: site.id,
      url: site.siteUrl,
      domain: site.canonicalHost || new URL(site.siteUrl).hostname,
      status: site.status,
      cms: site.cms,
      overallScore: site.lastScores ? (site.lastScores as any).overall || 0 : 0,
      scores: site.lastScores as any,
      findingCount: site.lastFindingCount || 0,
      lastUpdated: site.updatedAt?.toISOString() || site.createdAt.toISOString(),
      faviconUrl: site.lastFaviconUrl,
      connectionStatus: site.connectionStatus || "disconnected",
    })),
  };

  return <DashboardClient data={dashboardData} />;
}
