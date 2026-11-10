import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getOwnedSite } from "@/lib/auth/site-access";
import { parseStoredSite } from "@/lib/cockpit/stored";
import type { Metadata } from "next";
import { SiteCockpitLoader } from "@/components/site-cockpit/SiteCockpitLoader";
import { siteConnectionStatus } from "@/lib/wordpress/connection-status";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toConnectionStatus(site: Awaited<ReturnType<typeof getSiteFromDB>>): ConnectionStatus {
  return siteConnectionStatus(site);
}

function getSiteFromDB(id: string) {
  return getOwnedSite(id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = await getSiteFromDB(id);

  return {
    title: site ? `WordPress Optimization Agent | ${site.siteUrl}` : "WordPress Optimization Agent",
    description: site
      ? `Focused WordPress telemetry and remediation workspace for ${site.siteUrl}.`
      : "Focused WordPress telemetry and remediation workspace.",
  };
}

export default async function WordPressAgentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const site = await getSiteFromDB(id);

  if (!site) {
    return notFound();
  }

  return (
    <SiteCockpitLoader
      siteId={id}
      siteUrl={site.siteUrl}
      stored={parseStoredSite(site.lastScores)}
      storedCms={site.cms ?? site.lastCms}
      siteSummary={site.lastSummary ?? undefined}
      wordpressConnectionStatus={toConnectionStatus(site)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
      wordpressOnly
      wpVersion={site.wpVersion ?? undefined}
      pluginVersion={site.pluginVersion ?? undefined}
    />
  );
}
