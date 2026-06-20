import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteCockpitLoader } from "@/components/site-cockpit/SiteCockpitLoader";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toConnectionStatus(site: Awaited<ReturnType<typeof getSiteFromDB>>): ConnectionStatus {
  if (!site) return "disconnected";
  const cs = site.connectionStatus;
  if (cs === "connected") return "connected";
  if (cs === "reconnecting") return "reconnecting";
  if (cs === "error") return "error";
  if (cs === "pending") return "pending";
  if (cs === "disconnected") return "disconnected";
  if (site.isConnected) return "connected";
  if (site.status === "connected") return "connected";
  return "disconnected";
}

async function getSiteFromDB(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);
  return row ?? null;
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
      siteSummary={site.lastSummary ?? undefined}
      wordpressConnectionStatus={toConnectionStatus(site)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
      wordpressOnly
      wpVersion={site.wpVersion ?? undefined}
      pluginVersion={site.pluginVersion ?? undefined}
    />
  );
}
