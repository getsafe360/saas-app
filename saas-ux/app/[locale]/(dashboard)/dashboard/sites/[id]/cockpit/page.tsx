// saas-ux/app/[locale]/(dashboard)/dashboard/sites/[id]/cockpit/page.tsx
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { teams, teamMembers } from "@/lib/db/schema";
import { isPlanName, type PlanName } from "@/lib/plans/config";
import { eq } from "drizzle-orm";
import { getOwnedSite } from "@/lib/auth/site-access";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteCockpitLoader } from "@/components/site-cockpit/SiteCockpitLoader";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOCALE = "en";

function toConnectionStatus(site: Awaited<ReturnType<typeof getSiteFromDB>>): ConnectionStatus {
  if (!site) return "disconnected";
  // connectionStatus is authoritative when the column has been written by any write path
  const cs = site.connectionStatus;
  if (cs === "connected") return "connected";
  if (cs === "reconnecting") return "reconnecting";
  if (cs === "error") return "error";
  if (cs === "pending") return "pending";
  if (cs === "disconnected") return "disconnected";
  // cs is NULL: pre-migration row — fall back to isConnected flag then legacy status enum
  if (site.isConnected) return "connected";
  if (site.status === "connected") return "connected";
  return "disconnected";
}


// ============================================
// Metadata Generation
// ============================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "SiteCockpit" });

  // Only the owner gets the site URL in the title
  let siteUrl: string | null = null;
  try {
    siteUrl = (await getOwnedSite(id))?.siteUrl ?? null;
  } catch {
    // ignore DB errors in metadata
  }

  const title = siteUrl ? t("title", { url: siteUrl }) : t("notFoundTitle");
  const description = siteUrl
    ? t("description", { url: siteUrl })
    : t("notFoundDescription");

  const path = `/dashboard/sites/${id}/cockpit`;
  const canonicalPath = locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalPath,
    },
    alternates: {
      canonical: canonicalPath,
    },
  };
}

// ============================================
// Data Fetching Helpers
// ============================================

function getSiteFromDB(id: string) {
  return getOwnedSite(id);
}


// Plan of the team that owns the site; drives which report features the card promises.
async function getOwnerPlan(userId: number | null): Promise<PlanName> {
  if (!userId) return "free";
  const db = getDb();
  const [row] = await db
    .select({ planName: teams.planName })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return isPlanName(row?.planName) ? row.planName : "free";
}

// ============================================
// Main Page Component
// ============================================

export default async function SiteCockpitPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;

  // Validate the site exists; all analysis happens client-side via SiteCockpitLoader
  const site = await getSiteFromDB(id);
  if (!site) {
    return notFound();
  }

  const planName = await getOwnerPlan(site.userId ?? null);

  return (
    <SiteCockpitLoader
      siteId={id}
      planName={planName}
      siteUrl={site.siteUrl}
      siteSummary={site.lastSummary ?? undefined}
      wordpressConnectionStatus={toConnectionStatus(site)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
      wpVersion={site.wpVersion ?? undefined}
      pluginVersion={site.pluginVersion ?? undefined}
    />
  );
}
