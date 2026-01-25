// app/[locale]/(dashboard)/dashboard/page.tsx (SERVER)
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { users } from "@/lib/db/schema/auth/users";
import { teams, teamMembers } from "@/lib/db/schema/auth";
import { eq, desc } from "drizzle-orm";
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

export default async function DashboardPage() {
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
      overallScore: site.lastScores
        ? (site.lastScores as any).overall || 0
        : 0,
      scores: site.lastScores as any,
      findingCount: site.lastFindingCount || 0,
      lastUpdated: site.updatedAt?.toISOString() || site.createdAt.toISOString(),
      faviconUrl: site.lastFaviconUrl,
      connectionStatus: site.connectionStatus || "disconnected",
    })),
  };

  return <DashboardClient data={dashboardData} />;
}
