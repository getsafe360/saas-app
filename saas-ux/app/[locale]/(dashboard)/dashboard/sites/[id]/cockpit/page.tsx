// saas-ux/app/[locale]/(dashboard)/dashboard/sites/[id]/cockpit/page.tsx
import { sites } from "@/lib/db/schema/sites";
import { getOwnerPlan } from "@/lib/plans/owner-plan";
import { getOwnedSite } from "@/lib/auth/site-access";
import { parseStoredSite } from "@/lib/cockpit/stored";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteCockpitLoader } from "@/components/site-cockpit/SiteCockpitLoader";
import { siteConnectionStatus } from "@/lib/wordpress/connection-status";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOCALE = "en";

function toConnectionStatus(site: Awaited<ReturnType<typeof getSiteFromDB>>): ConnectionStatus {
  return siteConnectionStatus(site);
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
      stored={parseStoredSite(site.lastScores)}
      storedCms={site.cms ?? site.lastCms}
      siteSummary={site.lastSummary ?? undefined}
      wordpressConnectionStatus={toConnectionStatus(site)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
      wpVersion={site.wpVersion ?? undefined}
      pluginVersion={site.pluginVersion ?? undefined}
    />
  );
}
