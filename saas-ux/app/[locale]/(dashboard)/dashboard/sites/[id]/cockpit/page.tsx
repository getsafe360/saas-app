// saas-ux/app/[locale]/(dashboard)/dashboard/sites/[id]/cockpit/page.tsx
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
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
  // isConnected flag or new connectionStatus field both indicate an active connection
  if (site.isConnected || site.connectionStatus === "connected" || site.status === "connected") {
    return "connected";
  }
  const v = site.connectionStatus;
  if (v === "reconnecting" || v === "error" || v === "pending") return v;
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

  // Get site info from DB
  let siteUrl: string | null = null;
  try {
    const db = getDb();
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
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

async function getSiteFromDB(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);
  return row ?? null;
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

  return (
    <SiteCockpitLoader
      siteId={id}
      siteUrl={site.siteUrl}
      siteSummary={site.lastSummary ?? undefined}
      wordpressConnectionStatus={toConnectionStatus(site)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
      wpVersion={site.wpVersion ?? undefined}
      pluginVersion={site.pluginVersion ?? undefined}
    />
  );
}
